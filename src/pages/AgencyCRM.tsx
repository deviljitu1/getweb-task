import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Building2, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardList, FileText, Handshake, Loader2, Mail, MessageSquare, Phone, Plus, Search, Target, TrendingUp, Users, X } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import LeadForm from '@/components/crm/LeadForm';
import AgencyAccounts from '@/components/crm/AgencyAccounts';
import LeadPipeline from '@/components/crm/LeadPipeline';
import { LEAD_STAGES, type AgencyLead, type LeadActivity, type LeadInsert } from '@/types/crm';
import { followUpDue, isOpenLead, money, pipelineSummary } from '@/lib/crm';
import { cn } from '@/lib/utils';
import Seo from '@/components/Seo';

const dateLabel = (value: string) => isValid(new Date(value)) ? format(new Date(value), 'dd MMM, h:mm a') : 'Choose a date';

export default function AgencyCRM() {
  const { user } = useAuth();
  const { members, refreshClients, refreshProjects } = useData();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('pipeline');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<AgencyLead | 'new' | null>(params.get('new') === '1' ? 'new' : null);
  useEffect(() => { if (params.get('new') === '1') { setEditing('new'); setParams({}, { replace: true }); } }, [params, setParams]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<LeadActivity['kind']>('Note');
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const leadsQuery = useQuery({ queryKey: ['agency-leads', user?.userId], enabled: user?.role === 'admin', queryFn: async () => {
    const { data, error } = await supabase.from('agency_leads').select('*').order('created_at', { ascending: false });
    if (error) throw error; return data;
  } });
  const activitiesQuery = useQuery({ queryKey: ['lead-activities', selectedId, user?.userId], enabled: !!selectedId && user?.role === 'admin', queryFn: async () => {
    const { data, error } = await supabase.from('lead_activities').select('*').eq('lead_id', selectedId!).order('created_at', { ascending: false });
    if (error) throw error; return data;
  } });
  const leads = leadsQuery.data || [];
  const selected = leads.find(lead => lead.id === selectedId);
  const stats = pipelineSummary(leads, now);
  const filtered = leads.filter(lead => `${lead.company} ${lead.name} ${lead.email || ''} ${lead.services.join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (source === 'all' || lead.source === source));
  const followUps = filtered.filter(lead => isOpenLead(lead) && lead.next_follow_up).sort((a, b) => a.next_follow_up!.localeCompare(b.next_follow_up!));
  async function refresh() { await queryClient.invalidateQueries({ queryKey: ['agency-leads'] }); await queryClient.invalidateQueries({ queryKey: ['lead-activities'] }); }
  async function saveLead(input: LeadInsert) {
    const request = editing && editing !== 'new' ? supabase.from('agency_leads').update(input).eq('id', editing.id) : supabase.from('agency_leads').insert({ ...input, created_by: user!.userId });
    const { error } = await request; if (error) throw error;
    await refresh(); toast.success(editing === 'new' ? 'Opportunity added' : 'Opportunity updated');
  }
  async function mutate(action: () => Promise<void>, message: string) {
    setPending(true);
    try { await action(); await refresh(); toast.success(message); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save changes. Please try again.'); }
    finally { setPending(false); }
  }
  async function updateStage(lead: AgencyLead, stage: string) {
    await mutate(async () => { const { error } = await supabase.from('agency_leads').update({ stage: stage as AgencyLead['stage'] }).eq('id', lead.id); if (error) throw error; }, 'Stage updated');
  }
  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const leadCard = (lead: AgencyLead) => <button key={lead.id} onClick={() => { setSelectedId(lead.id); setNote(''); }} className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="mb-3 flex items-start justify-between gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></div><Badge variant="secondary" className="text-[10px] font-medium">{lead.source}</Badge></div>
    <h3 className="break-words font-semibold">{lead.company}</h3><p className="mt-0.5 text-xs text-muted-foreground">{lead.name}</p>
    <div className="mt-3 flex flex-wrap gap-1">{lead.services.slice(0, 2).map(service => <span key={service} className="rounded-md bg-muted px-1.5 py-1 text-[10px] text-muted-foreground">{service}</span>)}{lead.services.length > 2 && <span className="text-xs text-muted-foreground">+{lead.services.length - 2}</span>}</div>
    <div className="mt-4 flex items-center justify-between border-t pt-3"><span className="text-sm font-semibold">{money(Number(lead.monthly_value))}<span className="ml-0.5 text-[10px] font-normal text-muted-foreground">/mo</span></span><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" /></div>
    {lead.next_follow_up && isOpenLead(lead) && <p className={cn('mt-3 flex items-center gap-1.5 text-xs', followUpDue(lead, now) ? 'font-medium text-destructive' : 'text-muted-foreground')}><CalendarClock className="h-3 w-3" />{dateLabel(lead.next_follow_up)}</p>}
    {lead.owner_id && <p className="mt-2 truncate text-[10px] text-muted-foreground">Owner · {members.find(member => member.user_id === lead.owner_id)?.name || 'Team member'}</p>}
  </button>;

  return <div className="space-y-6 pb-16">
    <Seo title="Agency CRM — GetWebApp" description="Agency sales pipeline, client relationships, and project delivery." path="/crm" noindex />
    <header className="flex flex-col justify-between gap-4 pr-8 sm:flex-row sm:items-center"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Handshake className="h-4 w-4" />Agency workspace</p><h1 className="text-3xl font-bold tracking-tight">Relationships that grow.</h1><p className="mt-2 text-sm text-muted-foreground">From the first conversation to your next long-term client.</p></div><Button onClick={() => setEditing('new')} className="w-fit gap-2"><Plus className="h-4 w-4" />New opportunity</Button></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: 'Open pipeline', value: money(stats.value), detail: `${stats.open} active opportunities / month`, icon: TrendingUp, color: 'text-primary bg-primary/10' },
      { label: 'Follow-ups due', value: stats.due, detail: 'Conversations waiting for you', icon: CalendarClock, color: 'text-amber-600 bg-amber-500/10' },
      { label: 'Won retainers', value: money(stats.won), detail: 'Monthly value of won opportunities', icon: CircleDollarSign, color: 'text-emerald-600 bg-emerald-500/10' },
      { label: 'Win rate', value: `${stats.winRate}%`, detail: 'Won ÷ all closed opportunities', icon: Target, color: 'text-blue-600 bg-blue-500/10' },
    ].map(stat => <Card key={stat.label}><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-muted-foreground">{stat.label}</p><div className={cn('rounded-lg p-2', stat.color)}><stat.icon className="h-4 w-4" /></div></div><p className="mt-3 break-words text-xl font-bold tracking-tight sm:text-2xl">{stat.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{stat.detail}</p></CardContent></Card>)} </div>
    <Tabs value={tab} onValueChange={setTab} className="space-y-5"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto">{[{ id: 'pipeline', label: 'Pipeline', icon: TrendingUp }, { id: 'followups', label: 'Follow-ups', icon: CalendarClock }, { id: 'clients', label: 'Clients', icon: Users }, { id: 'projects', label: 'Projects', icon: ClipboardList }].map(item => <TabsTrigger value={item.id} key={item.id} className="gap-2 px-4 py-2.5"><item.icon className="h-4 w-4" />{item.label}{item.id === 'followups' && stats.due > 0 && <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] text-destructive">{stats.due}</span>}</TabsTrigger>)}</TabsList>
      {['pipeline', 'followups'].includes(tab) && <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search opportunities" value={search} onChange={event => setSearch(event.target.value)} className="bg-card pl-9" placeholder="Search company, contact, or service…" /></div><Select value={source} onValueChange={setSource}><SelectTrigger className="bg-card sm:w-44" aria-label="Filter by source"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{[...new Set(leads.map(lead => lead.source))].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>{(search || source !== 'all') && <Button variant="ghost" onClick={() => { setSearch(''); setSource('all'); }}><X className="mr-1 h-4 w-4" />Clear</Button>}</div>}
      {leadsQuery.isError && <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-5"><p className="font-medium">Could not load opportunities.</p><p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => leadsQuery.refetch()}>Retry</Button></div>}
      <TabsContent value="pipeline" className="mt-0">
        {leadsQuery.isLoading ? <div className="flex items-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading pipeline…</div> : !leads.length && !leadsQuery.isError ? <div className="rounded-2xl border border-dashed bg-card px-6 py-16 text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10"><Handshake className="h-7 w-7 text-primary" /></div><h2 className="text-xl font-semibold">Your next client starts here</h2><p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-muted-foreground">Add a prospect, capture their brief, and plan the next conversation.</p><Button onClick={() => setEditing('new')}><Plus className="mr-2 h-4 w-4" />Add your first opportunity</Button></div> : <LeadPipeline leads={filtered} renderCard={leadCard} onMove={updateStage} busy={pending} />}
      </TabsContent>
      <TabsContent value="followups" className="space-y-3">{followUps.map(lead => <button key={lead.id} onClick={() => { setSelectedId(lead.id); setNote(''); }} className="flex w-full flex-wrap items-center gap-4 rounded-xl border bg-card p-4 text-left hover:border-primary/40"><div className={cn('rounded-xl p-3', followUpDue(lead, now) ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}><CalendarClock className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{lead.company}</p><p className="text-sm text-muted-foreground">{lead.name} · {lead.stage}</p></div><div className="text-sm"><p className={followUpDue(lead, now) ? 'text-destructive' : ''}>{dateLabel(lead.next_follow_up!)}</p><p className="mt-1 text-xs text-muted-foreground">{followUpDue(lead, now) ? 'Due now' : 'Upcoming'}</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></button>)}{!followUps.length && <div className="rounded-xl border border-dashed bg-card p-12 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" /><h2 className="font-semibold">No follow-ups scheduled</h2><p className="mt-1 text-sm text-muted-foreground">Set the next follow-up on an opportunity to see it here.</p></div>}</TabsContent>
      <TabsContent value="clients"><AgencyAccounts mode="clients" /></TabsContent><TabsContent value="projects"><AgencyAccounts mode="projects" /></TabsContent>
    </Tabs>
    {editing && <LeadForm key={editing === 'new' ? 'new' : editing.id} lead={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={saveLead} />}
    <Sheet open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null); }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader><SheetTitle className="pr-7 text-2xl">{selected?.company}</SheetTitle><SheetDescription>{selected?.name} · {selected?.source}</SheetDescription></SheetHeader>{selected && <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between"><p className="text-2xl font-bold">{money(Number(selected.monthly_value))}<span className="text-sm font-normal text-muted-foreground"> / month</span></p><Button size="sm" variant="outline" onClick={() => setEditing(selected)}><FileText className="mr-2 h-4 w-4" />Edit details</Button></div>
      <Select value={selected.stage} disabled={pending} onValueChange={value => updateStage(selected, value)}><SelectTrigger aria-label="Update opportunity stage"><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map(stage => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select>
      <div className="space-y-2 text-sm">{selected.email && <a className="flex items-center gap-2 text-primary hover:underline" href={`mailto:${selected.email}`}><Mail className="h-4 w-4" />{selected.email}</a>}{selected.phone && <a className="flex items-center gap-2 text-primary hover:underline" href={`tel:${selected.phone}`}><Phone className="h-4 w-4" />{selected.phone}</a>}<div className="flex flex-wrap gap-1 pt-2">{selected.services.map(service => <Badge variant="secondary" key={service}>{service}</Badge>)}</div></div>
      {selected.notes && <div className="rounded-xl bg-muted/60 p-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client brief</h3><p className="whitespace-pre-wrap break-words text-sm">{selected.notes}</p></div>}
      {selected.next_follow_up && <div className="rounded-xl border p-4"><p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4 text-primary" />Next follow-up · {dateLabel(selected.next_follow_up)}</p><Button variant="outline" size="sm" className="mt-3" disabled={pending} onClick={() => mutate(async () => { const { error } = await supabase.from('agency_leads').update({ next_follow_up: null }).eq('id', selected.id); if (error) throw error; }, 'Follow-up completed')}><CheckCircle2 className="mr-2 h-4 w-4" />Mark complete</Button></div>}
      {!selected.client_id && <Button className="w-full gap-2" disabled={pending} onClick={() => mutate(async () => { const { error } = await supabase.rpc('convert_agency_lead', { lead_id: selected.id }); if (error) throw error; await Promise.all([refreshClients(), refreshProjects()]); }, 'Client and onboarding project created')}><Handshake className="h-4 w-4" />Convert to client & start onboarding</Button>}{selected.client_id && <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Converted to client · onboarding project created</p>}
      <div className="border-t pt-5"><h3 className="mb-3 flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-primary" />Activity timeline</h3><form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!note.trim()) return; void mutate(async () => { const { error } = await supabase.from('lead_activities').insert({ lead_id: selected.id, kind, body: note.trim(), created_by: user.userId }); if (error) throw error; setNote(''); }, 'Activity logged'); }}><Select value={kind} onValueChange={value => setKind(value as LeadActivity['kind'])}><SelectTrigger aria-label="Activity type"><SelectValue /></SelectTrigger><SelectContent>{['Note', 'Call', 'Email', 'Meeting'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Textarea aria-label="Activity note" value={note} onChange={event => setNote(event.target.value)} required maxLength={10000} placeholder="What happened? Capture the next step…" /><Button size="sm" disabled={pending || !note.trim()}>{pending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}Log activity</Button></form>
      <div className="mt-5 space-y-4">{activitiesQuery.isError && <p role="alert" className="text-sm text-destructive">Could not load activity. <button className="underline" onClick={() => activitiesQuery.refetch()}>Retry</button></p>}{activitiesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading activity…</p>}{activitiesQuery.data?.map(activity => <div key={activity.id} className="border-l-2 border-primary/20 pl-4"><div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground"><span className="font-medium text-primary">{activity.kind}</span><time>{dateLabel(activity.created_at)}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm">{activity.body}</p></div>)}{activitiesQuery.data?.length === 0 && <p className="text-sm text-muted-foreground">No activity yet. Start with your first conversation.</p>}</div></div>
    </div>}</SheetContent></Sheet>
  </div>;
}
