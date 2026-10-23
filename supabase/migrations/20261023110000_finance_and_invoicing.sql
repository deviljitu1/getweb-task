BEGIN;
CREATE SEQUENCE public.invoice_number_seq;
CREATE TABLE public.agency_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','issued','void')),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  issue_date date NOT NULL DEFAULT current_date, due_date date,
  seller jsonb NOT NULL, customer jsonb NOT NULL, items jsonb NOT NULL DEFAULT '[]',
  discount_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
  tax_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK(tax_percent BETWEEN 0 AND 100),
  advance_kind text NOT NULL DEFAULT 'none' CHECK(advance_kind IN ('none','percent','fixed')),
  advance_value numeric(14,2) NOT NULL DEFAULT 0 CHECK(advance_value >= 0),
  subtotal numeric(14,2) NOT NULL DEFAULT 0, discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  tax_amount numeric(14,2) NOT NULL DEFAULT 0, total numeric(14,2) NOT NULL DEFAULT 0,
  payment_instructions text NOT NULL DEFAULT '', terms text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK(due_date IS NULL OR due_date >= issue_date),
  CHECK(jsonb_typeof(seller)='object' AND jsonb_typeof(customer)='object' AND jsonb_typeof(items)='array')
);
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.agency_invoices(id),
  amount numeric(14,2) NOT NULL CHECK(amount > 0), paid_on date NOT NULL,
  reference text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), voided boolean NOT NULL DEFAULT false, void_reason text
);
CREATE INDEX invoice_payments_invoice_idx ON public.invoice_payments(invoice_id);
CREATE INDEX agency_invoices_date_idx ON public.agency_invoices(issue_date DESC);

CREATE FUNCTION public.validate_agency_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; qty numeric; rate numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.status <> 'draft' AND
    (to_jsonb(NEW) - ARRAY['status','updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at']) THEN
    RAISE EXCEPTION 'Issued invoices are locked. Create a new draft for changes.';
  END IF;
  IF TG_OP='UPDATE' AND OLD.status <> 'draft' AND NEW.status='draft' THEN RAISE EXCEPTION 'An issued invoice cannot become a draft'; END IF;
  IF NEW.project_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=NEW.project_id AND client_id=NEW.client_id) THEN RAISE EXCEPTION 'Project must belong to the selected client'; END IF;
  IF jsonb_typeof(NEW.items)<>'array' OR jsonb_array_length(NEW.items)>100 THEN RAISE EXCEPTION 'Maximum 100 invoice lines'; END IF;
  NEW.subtotal := 0;
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    qty := (item->>'quantity')::numeric; rate := (item->>'rate')::numeric;
    IF coalesce(length(trim(item->>'description')),0)=0 OR qty IS NULL OR rate IS NULL OR qty<=0 OR rate<0 OR qty>1000000 OR rate>100000000 OR qty::text IN ('NaN','Infinity','-Infinity') OR rate::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid invoice line'; END IF;
    NEW.subtotal := NEW.subtotal + round(qty*rate,2);
  END LOOP;
  NEW.discount_amount := round(NEW.subtotal*NEW.discount_percent/100,2);
  NEW.tax_amount := round((NEW.subtotal-NEW.discount_amount)*NEW.tax_percent/100,2);
  NEW.total := NEW.subtotal-NEW.discount_amount+NEW.tax_amount;
  IF (NEW.advance_kind='percent' AND NEW.advance_value>100) OR (NEW.advance_kind='fixed' AND NEW.advance_value>NEW.total) THEN RAISE EXCEPTION 'Advance exceeds invoice total'; END IF;
  IF NEW.status='issued' AND (jsonb_array_length(NEW.items)=0 OR coalesce(length(trim(NEW.seller->>'name')),0)=0 OR coalesce(length(trim(NEW.customer->>'name')),0)=0 OR NEW.number IS NULL) THEN RAISE EXCEPTION 'Invoice requires seller, client, services and an allocated number'; END IF;
  IF TG_OP='INSERT' AND (NEW.status<>'draft' OR NEW.number IS NOT NULL) THEN RAISE EXCEPTION 'Create a draft before issuing an invoice'; END IF;
  NEW.updated_at := now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_invoice BEFORE INSERT OR UPDATE ON public.agency_invoices FOR EACH ROW EXECUTE FUNCTION public.validate_agency_invoice();

CREATE FUNCTION public.issue_agency_invoice(invoice_id uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.agency_invoices; allocated text;
BEGIN
  IF NOT public.is_admin() OR NOT public.is_active_user() THEN RAISE EXCEPTION 'Active admin required'; END IF;
  SELECT * INTO inv FROM public.agency_invoices WHERE id=invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.status='issued' THEN RETURN inv.number; END IF;
  IF inv.status<>'draft' THEN RAISE EXCEPTION 'Only drafts can be issued'; END IF;
  allocated := 'INV-' || extract(year FROM inv.issue_date)::text || '-' || lpad(nextval('public.invoice_number_seq')::text,5,'0');
  UPDATE public.agency_invoices SET status='issued', number=allocated WHERE id=invoice_id;
  RETURN allocated;
END $$;

CREATE FUNCTION public.record_invoice_payment(invoice_id uuid, payment_id uuid, payment_amount numeric, payment_date date, payment_reference text DEFAULT '', payment_notes text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.agency_invoices; received numeric; existing public.invoice_payments;
BEGIN
  IF NOT public.is_admin() OR NOT public.is_active_user() THEN RAISE EXCEPTION 'Active admin required'; END IF;
  SELECT * INTO inv FROM public.agency_invoices WHERE id=invoice_id FOR UPDATE;
  IF NOT FOUND OR inv.status<>'issued' THEN RAISE EXCEPTION 'Payments require an issued invoice'; END IF;
  SELECT * INTO existing FROM public.invoice_payments WHERE id=payment_id;
  IF FOUND THEN
    IF existing.invoice_id=invoice_id AND existing.amount=round(payment_amount,2) AND existing.paid_on=payment_date AND existing.reference=payment_reference AND existing.notes=payment_notes AND NOT existing.voided THEN RETURN existing.id; END IF;
    RAISE EXCEPTION 'Payment ID already used';
  END IF;
  SELECT coalesce(sum(amount),0) INTO received FROM public.invoice_payments p WHERE p.invoice_id=inv.id AND NOT p.voided;
  IF payment_amount IS NULL OR payment_date IS NULL OR payment_amount::text IN ('NaN','Infinity','-Infinity') OR round(payment_amount,2)<=0 OR received+round(payment_amount,2)>inv.total THEN RAISE EXCEPTION 'Invalid payment or amount exceeds balance'; END IF;
  INSERT INTO public.invoice_payments(id,invoice_id,amount,paid_on,reference,notes) VALUES(payment_id,inv.id,round(payment_amount,2),payment_date,coalesce(payment_reference,''),coalesce(payment_notes,''));
  RETURN payment_id;
END $$;
CREATE FUNCTION public.void_invoice_payment(payment_id uuid, reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target uuid;
BEGIN
  IF NOT public.is_admin() OR NOT public.is_active_user() THEN RAISE EXCEPTION 'Active admin required'; END IF;
  IF coalesce(length(trim(reason)),0)=0 THEN RAISE EXCEPTION 'A correction reason is required'; END IF;
  SELECT invoice_id INTO target FROM public.invoice_payments WHERE id=payment_id;
  PERFORM 1 FROM public.agency_invoices WHERE id=target FOR UPDATE;
  UPDATE public.invoice_payments SET voided=true, void_reason=reason WHERE id=payment_id;
END $$;

CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK(kind IN ('expense','subscription','asset','settlement','investment')),
  title text NOT NULL CHECK(length(trim(title))>0), amount numeric(14,2) NOT NULL CHECK(amount>=0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
  date date NOT NULL DEFAULT current_date, status text NOT NULL,
  category text NOT NULL DEFAULT '', counterparty text NOT NULL DEFAULT '',
  member_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL, project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  frequency text CHECK(frequency IN ('monthly','yearly','quarterly','weekly')), next_due date,
  direction text CHECK(direction IN ('company_owes','member_owes','contribution','withdrawal','purchase','sale')),
  serial_number text NOT NULL DEFAULT '', warranty_until date, receipt_path text,
  notes text NOT NULL DEFAULT '', created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK((kind='expense' AND status IN ('pending','paid','void')) OR (kind='subscription' AND status IN ('active','paused')) OR (kind='asset' AND status IN ('in_use','retired')) OR (kind='settlement' AND status IN ('open','settled','void')) OR (kind='investment' AND status IN ('recorded','void'))),
  CHECK(kind<>'subscription' OR (frequency IS NOT NULL AND next_due IS NOT NULL)),
  CHECK(kind<>'settlement' OR direction IN ('company_owes','member_owes')),
  CHECK(kind<>'investment' OR direction IN ('contribution','withdrawal','purchase','sale'))
);
CREATE INDEX finance_entries_kind_date_idx ON public.finance_entries(kind,date DESC);
CREATE TRIGGER finance_entries_updated_at BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.agency_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active admins manage invoices" ON public.agency_invoices TO authenticated USING(public.is_admin() AND public.is_active_user()) WITH CHECK(public.is_admin() AND public.is_active_user());
CREATE POLICY "Active admins read payments" ON public.invoice_payments FOR SELECT TO authenticated USING(public.is_admin() AND public.is_active_user());
CREATE POLICY "Active admins manage finance" ON public.finance_entries TO authenticated USING(public.is_admin() AND public.is_active_user()) WITH CHECK(public.is_admin() AND public.is_active_user());
REVOKE ALL ON public.agency_invoices,public.invoice_payments,public.finance_entries FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agency_invoices,public.finance_entries TO authenticated;
GRANT SELECT ON public.invoice_payments TO authenticated;
GRANT ALL ON public.agency_invoices,public.invoice_payments,public.finance_entries TO service_role;
-- Status and number transitions are only available through the checked issuance RPC.
REVOKE UPDATE ON public.agency_invoices FROM authenticated;
GRANT UPDATE(client_id,project_id,issue_date,due_date,seller,customer,items,discount_percent,tax_percent,advance_kind,advance_value,payment_instructions,terms,notes) ON public.agency_invoices TO authenticated;
REVOKE ALL ON FUNCTION public.issue_agency_invoice(uuid),public.record_invoice_payment(uuid,uuid,numeric,date,text,text),public.void_invoice_payment(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_agency_invoice(uuid),public.record_invoice_payment(uuid,uuid,numeric,date,text,text),public.void_invoice_payment(uuid,text) TO authenticated;
REVOKE ALL ON SEQUENCE public.invoice_number_seq FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('finance-receipts','finance-receipts',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
CREATE POLICY "Admins read finance receipts" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='finance-receipts' AND public.is_admin() AND public.is_active_user());
CREATE POLICY "Admins upload finance receipts" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='finance-receipts' AND (storage.foldername(name))[1]=auth.uid()::text AND public.is_admin() AND public.is_active_user());
NOTIFY pgrst,'reload schema';
COMMIT;
