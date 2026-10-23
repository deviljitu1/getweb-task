import { useState, type FormEvent } from 'react';
import { Building2, CalendarDays, ClipboardList, Mail, Pencil, Phone, Plus, Search } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import type { Client, Project, ProjectStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AgencyAccounts({ mode }: { mode: 'clients' | 'projects' }) {
  const { clients, projects, tasks, addClient, updateClient, addProject, updateProject } = useData();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Client | Project | 'new' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('all');
  const records = (mode === 'clients' ? clients : projects).filter(record => `${record.name} ${'company' in record ? record.company || '' : ''}`.toLowerCase().includes(search.toLowerCase()) && (status === 'all' || ('is_active' in record ? (record.is_active ? 'Active' : 'Archived') : record.status) === status));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) || '').trim();
    setSaving(true); setError('');
    try {
      if (mode === 'clients') {
        const input = { name: field('name'), company: field('company') || null, contact_email: field('email') || null, contact_phone: field('phone') || null, hourly_rate: field('rate') ? Number(field('rate')) : null, notes: field('notes') || null, is_active: field('active') === 'Active' };
        if (editing && editing !== 'new') await updateClient(editing.id, input); else await addClient(input);
      } else {
        const input = { name: field('name'), client_id: field('client'), description: field('notes') || null, deadline: field('deadline') || null, budget_hours: field('hours') ? Number(field('hours')) : null, status: field('status') as ProjectStatus };
        if (editing && editing !== 'new') await updateProject(editing.id, input); else await addProject(input);
      }
      setEditing(null); toast.success(mode === 'clients' ? 'Client saved' : 'Project saved');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Please try again.'); }
    finally { setSaving(false); }
  }
  const client = editing && editing !== 'new' && 'is_active' in editing ? editing : undefined;
  const project = editing && editing !== 'new' && 'client_id' in editing ? editing : undefined;
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="text-lg font-semibold">{mode === 'clients' ? 'Client directory' : 'Delivery workspace'}</h2><p className="mt-1 text-sm text-muted-foreground">{mode === 'clients' ? 'Contacts, briefs, and relationships in one place.' : 'Track scope, deadlines, and progress for every client.'}</p></div><Button className="w-fit gap-2" onClick={() => { setError(''); setEditing('new'); }} disabled={mode === 'projects' && !clients.some(value => value.is_active)}><Plus className="h-4 w-4" />{mode === 'clients' ? 'Add client' : 'New project'}</Button></div>
    {mode === 'projects' && !clients.some(value => value.is_active) && <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Add an active client in the Clients tab first, or convert an opportunity from your pipeline.</p>}
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="bg-card pl-9" placeholder={`Search ${mode}…`} aria-label={`Search ${mode}`} value={search} onChange={event => setSearch(event.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="bg-card sm:w-44" aria-label={`Filter ${mode} status`}><SelectValue /></SelectTrigger><SelectContent>{['all', ...(mode === 'clients' ? ['Active', 'Archived'] : ['Active', 'On Hold', 'Completed'])].map(value => <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : value}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-4 lg:grid-cols-2">{records.map(record => {
      const isClient = 'is_active' in record;
      const linkedTasks = tasks.filter(task => isClient ? task.client_id === record.id : task.project_id === record.id);
      const finished = linkedTasks.filter(task => task.status === 'Finished').length;
      const percent = linkedTasks.length ? Math.round(finished / linkedTasks.length * 100) : 0;
      return <article key={record.id} className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary">{isClient ? <Building2 className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}</div><div className="min-w-0"><h3 className="break-words font-semibold">{record.name}</h3><p className="mt-1 text-xs text-muted-foreground">{isClient ? record.company || 'Independent client' : clients.find(value => value.id === record.client_id)?.company || clients.find(value => value.id === record.client_id)?.name || 'Client'}</p></div></div><Button variant="ghost" size="icon" aria-label={`Edit ${record.name}`} onClick={() => { setError(''); setEditing(record); }}><Pencil className="h-4 w-4" /></Button></div>
        <div className="my-4"><Badge variant={isClient ? (record.is_active ? 'secondary' : 'outline') : record.status === 'Completed' ? 'secondary' : 'outline'}>{isClient ? record.is_active ? 'Active' : 'Archived' : record.status}</Badge></div>
        {isClient ? <div className="space-y-2 text-sm">{record.contact_email && <a className="flex items-center gap-2 break-all text-muted-foreground hover:text-primary" href={`mailto:${record.contact_email}`}><Mail className="h-3.5 w-3.5 shrink-0" />{record.contact_email}</a>}{record.contact_phone && <a className="flex items-center gap-2 text-muted-foreground hover:text-primary" href={`tel:${record.contact_phone}`}><Phone className="h-3.5 w-3.5" />{record.contact_phone}</a>}<p className="pt-2 text-xs text-muted-foreground">{projects.filter(value => value.client_id === record.id && value.status === 'Active').length} active projects · {linkedTasks.length} linked tasks</p></div> : <><p className="mb-3 line-clamp-2 min-h-5 text-sm text-muted-foreground">{record.description || 'Add a scope and brief to align your team.'}</p><div className="flex justify-between text-xs text-muted-foreground"><span>{finished}/{linkedTasks.length} tasks finished</span><span>{percent}%</span></div><div role="progressbar" aria-label={`${record.name} task completion`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>{record.deadline && <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />Due {format(new Date(record.deadline + 'T00:00:00'), 'dd MMM yyyy')}</p>}</>}
      </article>;
    })}</div>
    {!records.length && <div className="rounded-xl border border-dashed bg-card p-12 text-center"><Building2 className="mx-auto mb-3 h-8 w-8 text-primary/60" /><h3 className="font-semibold">{search || status !== 'all' ? 'No matching records' : `No ${mode} yet`}</h3><p className="mt-1 text-sm text-muted-foreground">{search || status !== 'all' ? 'Try another search or status.' : 'Build your directory as your agency grows.'}</p></div>}
    <Dialog open={!!editing} onOpenChange={open => { if (!open && !saving) setEditing(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing === 'new' ? 'New' : 'Edit'} {mode === 'clients' ? 'client' : 'project'}</DialogTitle><DialogDescription>{mode === 'clients' ? 'Keep your client contact and brief up to date.' : 'Connect delivery to a client and a clear deadline.'}</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="account-name">{mode === 'clients' ? 'Contact name' : 'Project name'} *</Label><Input id="account-name" name="name" required maxLength={160} defaultValue={editing && editing !== 'new' ? editing.name : ''} /></div>
      {mode === 'clients' ? <><div className="space-y-2"><Label htmlFor="account-company">Company</Label><Input id="account-company" name="company" defaultValue={client?.company || ''} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="account-email">Email</Label><Input id="account-email" name="email" type="email" defaultValue={client?.contact_email || ''} /></div><div className="space-y-2"><Label htmlFor="account-phone">Phone</Label><Input id="account-phone" name="phone" type="tel" defaultValue={client?.contact_phone || ''} /></div><div className="space-y-2"><Label htmlFor="account-rate">Hourly rate (₹)</Label><Input id="account-rate" name="rate" type="number" min="0" step="0.01" defaultValue={client?.hourly_rate ?? ''} /></div><div className="space-y-2"><Label htmlFor="account-active">Status</Label><select id="account-active" name="active" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={client?.is_active === false ? 'Archived' : 'Active'}><option>Active</option><option>Archived</option></select></div></div></> : <><div className="space-y-2"><Label htmlFor="project-client">Client *</Label><select id="project-client" name="client" required defaultValue={project?.client_id || ''} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="" disabled>Choose a client</option>{clients.filter(value => value.is_active || value.id === project?.client_id).map(value => <option value={value.id} key={value.id}>{value.company || value.name}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="project-deadline">Deadline</Label><Input id="project-deadline" name="deadline" type="date" defaultValue={project?.deadline || ''} /></div><div className="space-y-2"><Label htmlFor="project-hours">Budget hours</Label><Input id="project-hours" name="hours" type="number" min="0" step="0.5" defaultValue={project?.budget_hours ?? ''} /></div></div><div className="space-y-2"><Label htmlFor="project-status">Status</Label><select id="project-status" name="status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" defaultValue={project?.status || 'Active'}>{['Active', 'On Hold', 'Completed'].map(value => <option key={value}>{value}</option>)}</select></div></>}
      <div className="space-y-2"><Label htmlFor="account-notes">{mode === 'clients' ? 'Brief & notes' : 'Scope & deliverables'}</Label><Textarea id="account-notes" name="notes" rows={4} maxLength={10000} defaultValue={client?.notes || project?.description || ''} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
    </form></DialogContent></Dialog>
  </div>;
}
