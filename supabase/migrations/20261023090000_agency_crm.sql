BEGIN;

CREATE TABLE public.agency_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  company text NOT NULL CHECK (length(trim(company)) > 0),
  email text,
  phone text,
  source text NOT NULL DEFAULT 'Referral',
  services text[] NOT NULL DEFAULT '{}',
  stage text NOT NULL DEFAULT 'New' CHECK (stage IN ('New','Contacted','Discovery','Proposal','Negotiation','Won','Lost')),
  monthly_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_value >= 0),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  next_follow_up timestamptz,
  notes text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.agency_leads(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'Note' CHECK (kind IN ('Note','Call','Email','Meeting')),
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agency_leads_follow_up_idx ON public.agency_leads(next_follow_up) WHERE stage NOT IN ('Won','Lost');
CREATE INDEX lead_activities_lead_idx ON public.lead_activities(lead_id, created_at DESC);
CREATE TRIGGER agency_leads_updated_at BEFORE UPDATE ON public.agency_leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.agency_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency admins manage leads" ON public.agency_leads TO authenticated
USING (public.is_admin() AND public.is_active_user()) WITH CHECK (public.is_admin() AND public.is_active_user());
CREATE POLICY "Agency admins manage activities" ON public.lead_activities TO authenticated
USING (public.is_admin() AND public.is_active_user()) WITH CHECK (public.is_admin() AND public.is_active_user());
REVOKE ALL ON public.agency_leads, public.lead_activities FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_leads, public.lead_activities TO authenticated;
GRANT ALL ON public.agency_leads, public.lead_activities TO service_role;

-- Row locking makes conversion atomic and safe to retry.
CREATE FUNCTION public.convert_agency_lead(lead_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE lead public.agency_leads; new_client_id uuid;
BEGIN
  IF NOT public.is_admin() OR NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Active administrator access required';
  END IF;
  SELECT * INTO lead FROM public.agency_leads WHERE id = lead_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
  IF lead.client_id IS NOT NULL THEN RETURN lead.client_id; END IF;
  INSERT INTO public.clients(name, company, contact_email, contact_phone, notes, created_by)
  VALUES(lead.name, lead.company, lead.email, lead.phone,
    concat_ws(E'\n', 'Services: ' || array_to_string(lead.services, ', '), 'Monthly retainer (INR): ' || lead.monthly_value, lead.notes), auth.uid())
  RETURNING id INTO new_client_id;
  INSERT INTO public.projects(client_id, name, description, created_by)
  VALUES(new_client_id, lead.company || ' — onboarding', 'Services: ' || array_to_string(lead.services, ', '), auth.uid());
  UPDATE public.agency_leads SET client_id = new_client_id, stage = 'Won', next_follow_up = NULL WHERE id = lead_id;
  INSERT INTO public.lead_activities(lead_id, body, created_by)
  VALUES(lead_id, 'Converted to client. Onboarding project created.', auth.uid());
  RETURN new_client_id;
END;
$$;
REVOKE ALL ON FUNCTION public.convert_agency_lead(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_agency_lead(uuid) TO authenticated;
COMMIT;
