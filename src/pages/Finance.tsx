import { useSearchParams } from 'react-router-dom';
import { useState, useEffect, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Search, FileDown, Receipt, Wallet, RefreshCw, Package, Users, Landmark } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import type { FinanceEntry, FinanceEntryInsert, FinanceKind } from '@/types/finance';
import ToolHeader from '@/components/tools/ToolHeader';
import InfoHint from '@/components/InfoHint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { money } from '@/lib/crm';
import { exportFile } from '@/lib/export-file';
import { todayStr } from '@/lib/utils';

const config = {
  expense: { label: 'Expenses', singular: 'expense', icon: Receipt, statuses: ['pending', 'paid', 'void'], hint: 'Record actual business spending. Paid records count as spending; pending records do not.' },
  subscription: { label: 'Subscriptions', singular: 'subscription', icon: RefreshCw, statuses: ['active', 'paused'], hint: 'Track recurring commitments and renewals. Record a separate paid expense when a bill is paid.' },
  asset: { label: 'Assets', singular: 'asset', icon: Package, statuses: ['in_use', 'retired'], hint: 'Maintain purchase cost, custodian, serial number and warranty. Purchase cost is not current market value.' },
  settlement: { label: 'Team settlements', singular: 'settlement', icon: Users, statuses: ['open', 'settled', 'void'], hint: 'Track reimbursements and advances with a clear direction: company owes a member, or member owes the company.' },
  investment: { label: 'Investments', singular: 'investment record', icon: Landmark, statuses: ['recorded', 'void'], hint: 'Record contributions, withdrawals and investment purchases or sales separately from operating expenses.' },
};
const pretty = (value: string) => value.replace(/_/g, ' ').replace(/^./, text => text.toUpperCase());
const selectClass = 'flex h-10 w-full rounded-md border bg-background px-3 text-sm';
export default function Finance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<FinanceKind>('expense');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(200);
  const [editing, setEditing] = useState<FinanceEntry | 'new' | null>(null);
  useEffect(() => { if (params.get('new') === 'expense') { setKind('expense'); setEditing('new'); setParams({}, { replace: true }); } }, [params, setParams]);
  const query = useQuery({ queryKey: ['finance-entries', user?.userId, kind, limit], enabled: user?.role === 'admin', queryFn: async () => {
    const { data, error, count } = await supabase.from('finance_entries').select('*', { count: 'exact' }).eq('kind', kind).order('date', { ascending: false }).limit(limit);
    if (error) throw error;
    return { entries: data, count: count || 0 };
  } });
  if (user?.role !== 'admin') return <ToolHeader title="Finance workspace" description="Finance records are available to administrators." />;
  const entries = (query.data?.entries || []).filter(entry => `${entry.title} ${entry.counterparty} ${entry.category}`.toLowerCase().includes(search.toLowerCase()));
  const activeRecords = entries.filter(entry => !['void', 'paused', 'retired', 'settled', 'pending'].includes(entry.status));
  const companyOwes = activeRecords.filter(entry => entry.direction === 'company_owes').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const memberOwes = activeRecords.filter(entry => entry.direction === 'member_owes').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const monthlyCost = activeRecords.reduce((sum, entry) => sum + Number(entry.amount) * (entry.frequency === 'yearly' ? 1 / 12 : entry.frequency === 'quarterly' ? 1 / 3 : entry.frequency === 'weekly' ? 52 / 12 : 1), 0);
  const total = entries.filter(entry => !['void', 'paused', 'retired', 'settled', 'pending'].includes(entry.status)).reduce((sum, entry) => sum + Number(entry.amount), 0);
  async function openReceipt(path: string) {
    const { data, error } = await supabase.storage.from('finance-receipts').createSignedUrl(path, 120);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }
  async function exportCSV() {
    const rows = [['Type', 'Title', 'Amount INR', 'Date', 'Status', 'Category', 'Vendor / counterparty', 'Direction', 'Frequency', 'Renewal', 'Notes'], ...entries.map(entry => [entry.kind, entry.title, String(entry.amount), entry.date, entry.status, entry.category, entry.counterparty, entry.direction || '', entry.frequency || '', entry.next_due || '', entry.notes])];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`).join(',')).join('\r\n');
    try { await exportFile(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }), `getweb-${kind}-${todayStr()}.csv`); }
    catch { toast.error('The export could not be saved or shared.'); }
  }
  return <div className="space-y-5"><ToolHeader title="Finance workspace" description="Keep business spending and team money records in one place. All amounts are in INR." />
    <div className="grid grid-cols-5 gap-1 rounded-xl border bg-card p-1.5">{(Object.keys(config) as FinanceKind[]).map(value => { const item = config[value]; return <button key={value} onClick={() => { setKind(value); setSearch(''); setLimit(200); }} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium sm:flex-row sm:justify-center sm:gap-2 sm:text-xs ${value === kind ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'}`}><item.icon className="h-4 w-4 shrink-0" /><span className="truncate max-w-full">{value === 'settlement' ? 'Settlements' : config[value].label}</span></button>; })}</div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"><div className="flex items-center gap-1"><h2 className="font-semibold">{config[kind].label}</h2><InfoHint title={config[kind].label}>{config[kind].hint}</InfoHint></div><Button onClick={() => setEditing('new')} className="w-fit shrink-0"><Plus className="mr-2 h-4 w-4" />Add {config[kind].singular}</Button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search loaded finance records" className="bg-card pl-9" placeholder="Search loaded records…" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{entries.length} shown · {kind === 'subscription' ? `${money(monthlyCost)} / month planned` : kind === 'settlement' ? `${money(companyOwes)} company owes · ${money(memberOwes)} team owes` : `${money(total)} ${kind === 'investment' ? 'gross activity' : kind === 'asset' ? 'purchase cost' : 'paid'}`}</span><Button variant="outline" size="sm" onClick={exportCSV} disabled={!entries.length}><FileDown className="mr-1.5 h-4 w-4" />CSV</Button></div></div>
    {query.isLoading && <p role="status" className="p-6 text-sm text-muted-foreground">Loading financial records…</p>}
    {query.error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>Financial records could not be loaded. {query.error.message}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => { void query.refetch(); }}>Retry</Button></div>}
    <div className="grid gap-3 lg:grid-cols-2">{entries.map(entry => <article key={entry.id} className="rounded-xl border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold">{entry.title}</h3><p className="mt-1 text-xs text-muted-foreground">{entry.date} · {entry.counterparty || entry.category || 'Business record'}</p></div><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Edit ${entry.title}`} onClick={() => setEditing(entry)}><Pencil className="h-3.5 w-3.5" /></Button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-lg font-semibold">{money(Number(entry.amount))}{entry.frequency && <span className="ml-1 text-xs font-normal text-muted-foreground">/ {entry.frequency.replace('ly', '')}</span>}</p><span className={`rounded-full px-2 py-1 text-[10px] font-medium ${['paid','active','settled','recorded'].includes(entry.status) ? 'bg-emerald-500/10 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{pretty(entry.status)}</span></div>{entry.direction && <p className="mt-2 text-xs text-muted-foreground">{pretty(entry.direction)}</p>}{entry.next_due && <p className="mt-2 text-xs text-muted-foreground">Next renewal: {entry.next_due}</p>}{entry.serial_number && <p className="mt-2 text-xs text-muted-foreground">Serial: {entry.serial_number}{entry.warranty_until && ` · Warranty until ${entry.warranty_until}`}</p>}{entry.notes && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{entry.notes}</p>}{entry.receipt_path && <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" onClick={() => { void openReceipt(entry.receipt_path!); }}>View receipt / document</Button>}</article>)}</div>
    {!query.isLoading && !query.error && !entries.length && <div className="rounded-xl border border-dashed bg-card py-12 text-center"><Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" /><h3 className="text-sm font-semibold">No {config[kind].label.toLowerCase()} yet</h3><p className="mt-1 text-xs text-muted-foreground">Add your first record to start tracking.</p></div>}
    {query.data && query.data.count > limit && <Button variant="outline" onClick={() => setLimit(previous => previous + 200)}>Load more ({query.data.count - limit} remaining)</Button>}
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing === 'new' ? 'Add' : 'Edit'} {config[kind].singular}</DialogTitle><DialogDescription>Recordkeeping only. Saving a record does not move money.</DialogDescription></DialogHeader>{editing && <FinanceForm key={editing === 'new' ? `new-${kind}` : editing.id} kind={kind} entry={editing === 'new' ? undefined : editing} onSaved={async () => { setEditing(null); await queryClient.invalidateQueries({ queryKey: ['finance-entries'] }); }} />}</DialogContent></Dialog>
  </div>;
}

function FinanceForm({ kind, entry, onSaved }: { kind: FinanceKind; entry?: FinanceEntry; onSaved: () => Promise<void> }) {
  const { user } = useAuth();
  const { members, clients, projects } = useData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clientId, setClientId] = useState(entry?.client_id || '');
  const [projectId, setProjectId] = useState(entry?.project_id || '');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user) return; setSaving(true); setError('');
    const form = new FormData(event.currentTarget);
    const str = (name: string) => String(form.get(name) || '').trim();
    try {
      const amount = Number(str('amount'));
      if (!Number.isFinite(amount) || amount < 0 || amount > 1e10 || !str('title')) throw new Error('Add a title and valid amount.');
      let receiptPath = entry?.receipt_path || null;
      const file = form.get('receipt');
      if (file instanceof File && file.size) {
        if (file.size > 10 * 1024 * 1024 || !['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Receipts must be PDF, JPG, PNG or WebP, up to 10 MB.');
        receiptPath = `${user.userId}/${crypto.randomUUID()}.${file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1]}`;
        const { error: uploadError } = await supabase.storage.from('finance-receipts').upload(receiptPath, file);
        if (uploadError) throw uploadError;
      }
      const input: FinanceEntryInsert = { kind, title: str('title'), amount, date: str('date'), status: str('status'), category: str('category'), counterparty: str('counterparty'), member_id: str('member') || null, client_id: clientId || null, project_id: projectId || null, notes: str('notes'), receipt_path: receiptPath,
        frequency: kind === 'subscription' ? str('frequency') as FinanceEntry['frequency'] : null, next_due: kind === 'subscription' ? str('next_due') || null : null,
        direction: ['settlement','investment'].includes(kind) ? str('direction') as FinanceEntry['direction'] : null,
        serial_number: kind === 'asset' ? str('serial_number') : '', warranty_until: kind === 'asset' ? str('warranty_until') || null : null };
      const response = entry ? await supabase.from('finance_entries').update(input).eq('id', entry.id).eq('updated_at', entry.updated_at).select('id').single() : await supabase.from('finance_entries').insert({ ...input, created_by: user.userId }).select('id').single();
      if (response.error) throw response.error;
      toast.success('Financial record saved'); await onSaved();
    } catch (err) { setError(err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Could not save. Reload if another administrator edited this record.'); }
    finally { setSaving(false); }
  }
  const field = (name: string, label: string, value: string | number = '', type = 'text', required = false) => <div className="space-y-1.5"><Label htmlFor={`finance-${name}`}>{label}</Label><Input id={`finance-${name}`} name={name} defaultValue={value} type={type} required={required} maxLength={type === 'text' ? 500 : undefined} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} /></div>;
  return <form onSubmit={save} className="space-y-4"><fieldset disabled={saving} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{field('title','Title *',entry?.title || '', 'text',true)}{field('amount',kind === 'subscription' ? 'Cost per billing period (INR) *' : 'Amount (INR) *',entry?.amount ?? '', 'number',true)}{field('date',kind === 'asset' ? 'Purchase date *' : 'Record date *',entry?.date || todayStr(),'date',true)}<div className="space-y-1.5"><Label htmlFor="finance-status">Status</Label><select id="finance-status" name="status" className={selectClass} defaultValue={entry?.status || config[kind].statuses[0]}>{config[kind].statuses.map(value => <option key={value} value={value}>{pretty(value)}</option>)}</select></div>{field('category','Category',entry?.category || '', 'text')}{field('counterparty',kind === 'subscription' ? 'Provider' : kind === 'investment' ? 'Investor / asset / institution' : 'Vendor / counterparty',entry?.counterparty || '')}
      <div className="space-y-1.5"><Label htmlFor="finance-member">{kind === 'asset' ? 'Custodian' : kind === 'settlement' ? 'Team member' : 'Paid by / owner'}</Label><select id="finance-member" name="member" className={selectClass} defaultValue={entry?.member_id || ''}><option value="">Company / unassigned</option>{members.map(member => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}</select></div>
      {['settlement','investment'].includes(kind) && <div className="space-y-1.5"><Label htmlFor="finance-direction">Direction *</Label><select id="finance-direction" name="direction" className={selectClass} defaultValue={entry?.direction || (kind === 'settlement' ? 'company_owes' : 'contribution')}>{(kind === 'settlement' ? ['company_owes','member_owes'] : ['contribution','withdrawal','purchase','sale']).map(value => <option key={value} value={value}>{pretty(value)}</option>)}</select></div>}
      {kind === 'subscription' && <><div className="space-y-1.5"><Label htmlFor="finance-frequency">Billing frequency</Label><select id="finance-frequency" name="frequency" className={selectClass} defaultValue={entry?.frequency || 'monthly'}>{['monthly','yearly','quarterly','weekly'].map(value => <option key={value}>{value}</option>)}</select></div>{field('next_due','Next renewal *',entry?.next_due || todayStr(),'date',true)}</>}
      {kind === 'asset' && <>{field('serial_number','Serial / asset tag',entry?.serial_number || '')}{field('warranty_until','Warranty until',entry?.warranty_until || '','date')}</>}
      <div className="space-y-1.5"><Label htmlFor="finance-client">Client (optional)</Label><select id="finance-client" className={selectClass} value={clientId} onChange={event => { setClientId(event.target.value); setProjectId(''); }}><option value="">Internal business</option>{clients.map(client => <option key={client.id} value={client.id}>{client.company || client.name}</option>)}</select></div><div className="space-y-1.5"><Label htmlFor="finance-project">Project (optional)</Label><select id="finance-project" className={selectClass} value={projectId} onChange={event => setProjectId(event.target.value)} disabled={!clientId}><option value="">No project</option>{projects.filter(project => project.client_id === clientId).map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
    </div><div className="space-y-1.5"><Label htmlFor="finance-notes">Notes / payment reference</Label><Textarea id="finance-notes" name="notes" rows={3} maxLength={10000} defaultValue={entry?.notes || ''} /></div><div className="space-y-1.5"><Label htmlFor="finance-receipt">Receipt / document (optional)</Label><Input id="finance-receipt" name="receipt" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /><p className="text-[11px] text-muted-foreground">PDF, JPG, PNG or WebP · up to 10 MB · private to admins</p></div></fieldset>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end"><Button disabled={saving}>{saving ? 'Saving…' : 'Save record'}</Button></div></form>;
}
