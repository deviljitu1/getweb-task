import { useState, useRef, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import type { Invoice, InvoiceParty, InvoicePayment } from '@/types/finance';
import { calculateInvoice, newInvoice } from '@/lib/invoice';
import { todayStr } from '@/lib/utils';
import { money } from '@/lib/crm';
import ToolHeader from '@/components/tools/ToolHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';
const message = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'The operation could not be completed.';
export default function Invoices() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const newDraft = useRef<Invoice | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const query = useQuery({ queryKey: ['invoices', user?.userId, limit], enabled: user?.role === 'admin', queryFn: async () => {
    const { data, error, count } = await supabase.from('agency_invoices').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(limit);
    if (error) throw error; return { invoices: data, count: count || 0 };
  } });
  if (user?.role !== 'admin') return <ToolHeader title="Invoice studio" description="Invoices are available to administrators." />;
  if (params.get('new') === '1' && !newDraft.current) newDraft.current = newInvoice(query.data?.invoices[0]?.seller);
  const editing = selected || (params.get('new') === '1' ? newDraft.current : null);
  const records = (query.data?.invoices || []).filter(invoice => `${invoice.number || 'draft'} ${invoice.customer.name}`.toLowerCase().includes(search.toLowerCase()));
  if (editing) return <InvoiceEditor key={editing.id} invoice={editing} saved={!!selected} onBack={() => { newDraft.current = null; setSelected(null); setParams({}, { replace: true }); }} onSaved={async invoice => { newDraft.current = null; setSelected(invoice); setParams({}, { replace: true }); await queryClient.invalidateQueries({ queryKey: ['invoices'] }); }} />;
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><ToolHeader title="Invoice studio" description="Create client invoices, request advances, track payments and export a professional PDF." /><Button className="w-fit" onClick={() => setParams({ new: '1' })}><Plus className="mr-2 h-4 w-4" />New invoice</Button></div><div className="relative max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="bg-card pl-9" aria-label="Search loaded invoices" placeholder="Search invoice or client…" value={search} onChange={event => setSearch(event.target.value)} /></div>
    {query.isLoading && <p role="status" className="p-6 text-sm text-muted-foreground">Loading invoices…</p>}{query.error && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">{query.error.message}<Button variant="outline" size="sm" className="ml-2" onClick={() => { void query.refetch(); }}>Retry</Button></div>}
    <div className="grid gap-3 lg:grid-cols-2">{records.map(invoice => <button key={invoice.id} className="rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50" onClick={() => setSelected(invoice)}><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 shrink-0 text-primary" />{invoice.number || 'Draft invoice'}</span><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${invoice.status === 'issued' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{invoice.status}</span></div><p className="mt-3 truncate text-sm">{invoice.customer.name || 'Client not added'}</p><div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground"><span>{invoice.issue_date}{invoice.due_date && ` · Due ${invoice.due_date}`}</span><span className="font-semibold text-foreground">{money(Number(invoice.total))}</span></div></button>)}</div>
    {!query.isLoading && !query.error && !records.length && <div className="rounded-xl border border-dashed bg-card py-12 text-center"><FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /><p className="text-sm font-semibold">Your invoices, organised.</p><p className="mt-1 text-xs text-muted-foreground">Create your first draft to get started.</p></div>}{query.data && query.data.count > limit && <Button variant="outline" onClick={() => setLimit(value => value + 100)}>Load more invoices</Button>}
  </div>;
}

function InvoiceEditor({ invoice, saved, onBack, onSaved }: { invoice: Invoice; saved: boolean; onBack: () => void; onSaved: (invoice: Invoice) => Promise<void> }) {
  const { user } = useAuth();
  const { clients, projects } = useData();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(invoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [correction, setCorrection] = useState<InvoicePayment | null>(null);
  const locked = draft.status !== 'draft';
  const paymentQuery = useQuery({ queryKey: ['invoice-payments', invoice.id, user?.userId], enabled: saved, queryFn: async () => { const { data, error } = await supabase.from('invoice_payments').select('*').eq('invoice_id', invoice.id).order('paid_on', { ascending: false }); if (error) throw error; return data; } });
  const payments = paymentQuery.data || [];
  const received = payments.filter(payment => !payment.voided).reduce((sum, payment) => sum + Number(payment.amount), 0);
  let totals: ReturnType<typeof calculateInvoice> | null = null;
  let calculationError = '';
  try { totals = calculateInvoice(draft, received); } catch (err) { calculationError = message(err); }
  const change = <K extends keyof Invoice>(key: K, value: Invoice[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  async function save(issue = false) {
    if (!user) return; setBusy(true); setError('');
    try {
      calculateInvoice(draft, received);
      if (!draft.items.length || !draft.seller.name.trim() || !draft.customer.name.trim()) throw new Error('Add your business name, client name and at least one service.');
      const { seller, customer, items, client_id, project_id, issue_date, due_date, discount_percent, tax_percent, advance_kind, advance_value, payment_instructions, terms, notes } = draft;
      const input = { seller, customer, items, client_id, project_id, issue_date, due_date, discount_percent, tax_percent, advance_kind, advance_value, payment_instructions, terms, notes };
      const response = saved ? await supabase.from('agency_invoices').update(input).eq('id', draft.id).eq('updated_at', draft.updated_at).select('*').single() : await supabase.from('agency_invoices').insert({ ...input, id: draft.id, created_by: user.userId }).select('*').single();
      if (response.error) throw response.error;
      let stored = response.data;
      // Preserve a successful save even if issuing later fails; retry cannot duplicate the draft.
      setDraft(stored); await onSaved(stored);
      if (issue) {
        const result = await supabase.rpc('issue_agency_invoice', { invoice_id: stored.id });
        if (result.error) throw result.error;
        const issued = await supabase.from('agency_invoices').select('*').eq('id', stored.id).single();
        if (issued.error) throw issued.error;
        stored = issued.data; setDraft(stored); await onSaved(stored);
      }
      toast.success(issue ? 'Invoice issued. It has not been sent to the client.' : 'Draft saved');
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  async function exportPDF() {
    setBusy(true); setError('');
    try { const { exportInvoicePDF } = await import('@/lib/invoice-pdf'); await exportInvoicePDF(draft, payments); }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.rpc('record_invoice_payment', { invoice_id: draft.id, payment_id: paymentId, payment_amount: Number(form.get('amount')), payment_date: String(form.get('date')), payment_reference: String(form.get('reference') || '').trim(), payment_notes: String(form.get('notes') || '').trim() });
      if (error) throw error;
      setPaymentOpen(false); setPaymentId(crypto.randomUUID()); await queryClient.invalidateQueries({ queryKey: ['invoice-payments', draft.id] }); toast.success('Payment recorded');
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  async function correctPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!correction) return; setBusy(true);
    const form = new FormData(event.currentTarget);
    try { const { error } = await supabase.rpc('void_invoice_payment', { payment_id: correction.id, reason: String(form.get('reason') || '').trim() }); if (error) throw error; setCorrection(null); await queryClient.invalidateQueries({ queryKey: ['invoice-payments', draft.id] }); toast.success('Payment marked void; its audit record is preserved'); }
    catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }
  function party(kind: 'seller' | 'customer', title: string) {
    return <section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">{title}</h2><div className="grid gap-3 sm:grid-cols-2">{(['name','email','phone','tax_id'] as const).map(key => <div key={key} className="space-y-1"><Label htmlFor={`${kind}-${key}`}>{key === 'tax_id' ? 'Tax ID (optional)' : key === 'name' ? 'Name / business *' : key[0].toUpperCase() + key.slice(1)}</Label><Input id={`${kind}-${key}`} type={key === 'email' ? 'email' : 'text'} value={draft[kind][key]} maxLength={200} onChange={event => change(kind, { ...draft[kind], [key]: event.target.value } as InvoiceParty)} /></div>)}</div><div className="space-y-1"><Label htmlFor={`${kind}-address`}>Address</Label><Textarea id={`${kind}-address`} value={draft[kind].address} maxLength={1000} rows={2} onChange={event => change(kind, { ...draft[kind], address: event.target.value })} /></div></section>;
  }
  return <div className="space-y-5"><header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><Button variant="link" className="mb-1 h-auto p-0 text-xs text-muted-foreground" onClick={onBack}><ArrowLeft className="mr-1 h-3.5 w-3.5" />All invoices</Button><h1 className="text-2xl font-bold">{draft.number || 'New invoice'}</h1><p className="mt-1 text-xs text-muted-foreground">{locked ? 'Issued invoice · client and amounts are locked' : 'Draft · save before leaving this screen'}</p></div><div className="flex flex-wrap gap-2">{!locked && <><Button variant="outline" disabled={busy} onClick={() => { void save(); }}>Save draft</Button><Button disabled={busy} onClick={() => { void save(true); }}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Issue invoice</Button></>}<Button variant="outline" disabled={busy || !!calculationError || !!paymentQuery.error || paymentQuery.isLoading} onClick={exportPDF}><Download className="mr-2 h-4 w-4" />PDF</Button></div></header>
    {(error || calculationError) && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error || calculationError}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]"><fieldset disabled={locked || busy} className="min-w-0 space-y-4 disabled:opacity-90"><section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="invoice-client">Existing client (optional)</Label><select id="invoice-client" value={draft.client_id || ''} className={selectClass} onChange={event => { const client = clients.find(value => value.id === event.target.value); setDraft(previous => ({ ...previous, client_id: client?.id || null, project_id: null, customer: client ? { ...previous.customer, name: client.company || client.name, email: client.contact_email || '', phone: client.contact_phone || '' } : previous.customer })); }}><option value="">Enter client manually</option>{clients.filter(client => client.is_active || client.id === draft.client_id).map(client => <option value={client.id} key={client.id}>{client.company || client.name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="invoice-project">Project</Label><select id="invoice-project" value={draft.project_id || ''} disabled={!draft.client_id || locked} className={selectClass} onChange={event => change('project_id', event.target.value || null)}><option value="">No project</option>{projects.filter(project => project.client_id === draft.client_id).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div><div className="space-y-1"><Label htmlFor="invoice-date">Issue date</Label><Input id="invoice-date" type="date" value={draft.issue_date} onChange={event => change('issue_date', event.target.value)} /></div><div className="space-y-1"><Label htmlFor="invoice-due">Due date</Label><Input id="invoice-due" type="date" min={draft.issue_date} value={draft.due_date || ''} onChange={event => change('due_date', event.target.value || null)} /></div></section>
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">{party('seller','Your business')}{party('customer','Bill to')}</div>
    <section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Services & deliverables</h2><Button type="button" variant="outline" size="sm" disabled={locked || draft.items.length >= 100} onClick={() => change('items', [...draft.items, { id: crypto.randomUUID(), description: '', project: '', quantity: 1, rate: 0 }])}><Plus className="mr-1 h-3.5 w-3.5" />Add service</Button></div>{draft.items.map((line, index) => { const update = (values: Partial<typeof line>) => change('items', draft.items.map(item => item.id === line.id ? { ...item, ...values } : item)); return <div key={line.id} className="space-y-3 rounded-lg border bg-muted/20 p-3"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">Service {index + 1}</span><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove service ${index + 1}`} onClick={() => change('items', draft.items.filter(item => item.id !== line.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div><Input aria-label={`Service ${index + 1} description`} placeholder="Service / deliverable *" value={line.description} maxLength={1000} onChange={event => update({ description: event.target.value })} /><Input aria-label={`Service ${index + 1} project`} placeholder="Brand / project / scope (optional)" value={line.project} maxLength={500} onChange={event => update({ project: event.target.value })} /><div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor={`qty-${line.id}`}>Quantity</Label><Input id={`qty-${line.id}`} type="number" min="0.001" max="1000000" step="0.001" value={line.quantity} onChange={event => update({ quantity: Number(event.target.value) })} /></div><div className="space-y-1"><Label htmlFor={`rate-${line.id}`}>Unit rate (INR)</Label><Input id={`rate-${line.id}`} type="number" min="0" max="100000000" step="0.01" value={line.rate} onChange={event => update({ rate: Number(event.target.value) })} /></div></div></div>; })}</section>
    <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="invoice-discount">Discount %</Label><Input id="invoice-discount" type="number" min="0" max="100" step="0.01" value={draft.discount_percent} onChange={event => change('discount_percent', Number(event.target.value))} /></div><div className="space-y-1"><Label htmlFor="invoice-tax">Tax %</Label><Input id="invoice-tax" type="number" min="0" max="100" step="0.01" value={draft.tax_percent} onChange={event => change('tax_percent', Number(event.target.value))} /></div><div className="space-y-1"><Label htmlFor="invoice-advance">Payment requested</Label><select id="invoice-advance" className={selectClass} value={draft.advance_kind} onChange={event => { change('advance_kind', event.target.value as Invoice['advance_kind']); change('advance_value', 0); }}><option value="none">Full amount</option><option value="percent">Advance percentage</option><option value="fixed">Fixed advance</option></select></div>{draft.advance_kind !== 'none' && <div className="space-y-1"><Label htmlFor="invoice-advance-value">{draft.advance_kind === 'percent' ? 'Advance %' : 'Advance amount (INR)'}</Label><Input id="invoice-advance-value" type="number" min="0" max={draft.advance_kind === 'percent' ? '100' : undefined} step="0.01" value={draft.advance_value} onChange={event => change('advance_value', Number(event.target.value))} /></div>}</section>
    <section className="space-y-3 rounded-xl border bg-card p-4">{(['payment_instructions','terms','notes'] as const).map(key => <div key={key} className="space-y-1"><Label htmlFor={`invoice-${key}`}>{key === 'payment_instructions' ? 'Payment details / bank / UPI' : key === 'terms' ? 'Terms' : 'Notes'}</Label><Textarea id={`invoice-${key}`} maxLength={10000} rows={3} value={draft[key]} onChange={event => change(key, event.target.value)} /></div>)}</section></fieldset>
    <aside className="space-y-4 xl:sticky xl:top-4"><section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Invoice summary</h2><p className="mt-1 text-xs text-muted-foreground">Amounts in INR</p>{totals && <dl className="mt-4 space-y-2.5 text-sm">{[['Subtotal',totals.subtotal],['Discount',-totals.discount],['Tax',totals.tax],['Invoice total',totals.total],['Payments received',totals.received],['Balance outstanding',totals.balance],['Due now',totals.dueNow],...(draft.advance_kind !== 'none' ? [['Remaining after due-now payment',totals.later]] : [])].map(([label,value]) => <div key={label} className={`flex justify-between gap-4 ${['Invoice total','Due now','Balance outstanding'].includes(String(label)) ? 'border-t pt-3 font-semibold' : 'text-muted-foreground'}`}><dt className="text-xs">{label}</dt><dd className="shrink-0">{money(Number(value))}</dd></div>)}</dl>}<p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">An advance request does not count as received money. Record payments after they are received.</p></section>
    <section className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Payment history</h2>{draft.status === 'issued' && totals && totals.balance > 0 && <Button variant="outline" size="sm" disabled={busy || paymentQuery.isLoading || !!paymentQuery.error} onClick={() => setPaymentOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" />Record</Button>}</div>{paymentQuery.isLoading && <p className="text-xs text-muted-foreground">Loading payments…</p>}{paymentQuery.error && <p role="alert" className="text-xs text-destructive">Payment history could not be loaded. Refresh before exporting.</p>}{!payments.length && !paymentQuery.isLoading && <p className="text-xs text-muted-foreground">{locked ? 'No payments recorded.' : 'Issue this invoice before recording a payment.'}</p>}{payments.map(payment => <div key={payment.id} className="border-t pt-3"><div className="flex justify-between gap-2 text-xs"><span>{payment.paid_on}</span><span className={payment.voided ? 'line-through text-muted-foreground' : 'font-semibold'}>{money(Number(payment.amount))}</span></div><p className="mt-1 break-words text-xs text-muted-foreground">{payment.reference || 'No reference'}{payment.voided && ` · Void: ${payment.void_reason}`}</p>{!payment.voided && <button className="mt-1 text-[10px] text-muted-foreground underline" onClick={() => setCorrection(payment)}>Correct this payment</button>}</div>)}</section></aside></div>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>Record received payment</DialogTitle><DialogDescription>This records money already received. It does not charge the client.</DialogDescription></DialogHeader><form onSubmit={recordPayment} className="space-y-3"><Label htmlFor="payment-amount">Amount received (INR)</Label><Input id="payment-amount" name="amount" required type="number" min="0.01" step="0.01" max={totals?.balance} /><Label htmlFor="payment-date">Date received</Label><Input id="payment-date" name="date" required type="date" defaultValue={todayStr()} /><Label htmlFor="payment-reference">Payment reference</Label><Input id="payment-reference" name="reference" maxLength={500} /><Label htmlFor="payment-notes">Notes</Label><Textarea id="payment-notes" name="notes" rows={2} maxLength={5000} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy}>{busy ? 'Saving…' : 'Record payment'}</Button></form></DialogContent></Dialog>
    <Dialog open={!!correction} onOpenChange={open => { if (!open) setCorrection(null); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Correct a payment record</DialogTitle><DialogDescription>The original record remains in history and will be excluded from received payments. This does not refund money.</DialogDescription></DialogHeader><form onSubmit={correctPayment} className="space-y-3"><Label htmlFor="payment-reason">Reason *</Label><Textarea id="payment-reason" name="reason" required maxLength={2000} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button variant="destructive" disabled={busy}>{busy ? 'Saving…' : 'Mark payment void'}</Button></form></DialogContent></Dialog>
  </div>;
}
