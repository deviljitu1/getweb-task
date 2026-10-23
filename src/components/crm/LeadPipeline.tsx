import { useEffect, useState, type ReactNode } from 'react';
import { GripVertical } from 'lucide-react';
import { LEAD_STAGES, type AgencyLead, type LeadStage } from '@/types/crm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { money } from '@/lib/crm';
import { cn } from '@/lib/utils';

type Props = { leads: AgencyLead[]; renderCard: (lead: AgencyLead) => ReactNode; onMove: (lead: AgencyLead, stage: LeadStage) => Promise<void>; busy: boolean };
export default function LeadPipeline({ leads, renderCard, onMove, busy }: Props) {
  const [desktop, setDesktop] = useState(false);
  const [stage, setStage] = useState('all');
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);
  useEffect(() => { const query = matchMedia('(min-width: 768px) and (pointer: fine)'); const update = () => setDesktop(query.matches); update(); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  if (!desktop) return <div className="space-y-3">
    <Select value={stage} onValueChange={setStage}><SelectTrigger aria-label="Filter pipeline stage" className="bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stages · {leads.length}</SelectItem>{LEAD_STAGES.map(value => <SelectItem value={value} key={value}>{value} · {leads.filter(lead => lead.stage === value).length}</SelectItem>)}</SelectContent></Select>
    {leads.filter(lead => stage === 'all' || lead.stage === stage).map(lead => <div key={lead.id} className="space-y-2">{renderCard(lead)}<Select value={lead.stage} disabled={busy} onValueChange={value => { void onMove(lead, value as LeadStage); }}><SelectTrigger className="h-9 bg-card text-xs" aria-label={`Move ${lead.company} to stage`}><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>)}
    {!leads.some(lead => stage === 'all' || lead.stage === stage) && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No opportunities in this stage.</p>}
  </div>;
  return <div className="min-w-0 space-y-3"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><GripVertical className="h-3.5 w-3.5" />Drag a card to change its stage, or open it to use the stage menu.</p><div role="region" aria-label="Sales pipeline board" className="flex max-w-full gap-3 overflow-x-auto pb-4">
    {LEAD_STAGES.map(value => { const group = leads.filter(lead => lead.stage === value); return <section key={value} aria-label={`${value} opportunities`} onDragOver={event => { if (dragged && !busy) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(value); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(null); }} onDrop={event => { event.preventDefault(); const lead = leads.find(item => item.id === event.dataTransfer.getData('text/plain')); setDragged(null); setOver(null); if (lead && lead.stage !== value && !busy) void onMove(lead, value); }} className={cn('w-[250px] shrink-0 rounded-xl border bg-muted/40 p-3 transition-colors', over === value && 'border-primary bg-primary/5 ring-1 ring-primary')}>
      <div className="mb-1 flex items-center justify-between"><h2 className="text-sm font-semibold">{value}</h2><span className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground">{group.length}</span></div><p className="mb-3 text-xs text-muted-foreground">{money(group.reduce((sum, lead) => sum + Number(lead.monthly_value), 0))} /mo</p>
      <div className="min-h-32 space-y-3">{group.map(lead => <div key={lead.id} draggable={!busy} onDragStart={event => { event.dataTransfer.setData('text/plain', lead.id); event.dataTransfer.effectAllowed = 'move'; setDragged(lead.id); }} onDragEnd={() => { setDragged(null); setOver(null); }} className={cn('cursor-grab active:cursor-grabbing', dragged === lead.id && 'opacity-40')}>{renderCard(lead)}</div>)}{!group.length && <p className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">{dragged ? 'Drop opportunity here' : 'No opportunities'}</p>}</div>
    </section>; })}
  </div></div>;
}
