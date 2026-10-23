import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, Plus, Trash2, Check, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import ToolHeader from '@/components/tools/ToolHeader';
import { campaignUrl } from '@/lib/marketing-tools';
import { todayStr } from '@/lib/utils';
import { WORKSPACE_TOOLS } from '@/lib/tool-registry';

type Draft = { fields: Record<string, string>; notes: string; checks: { id: string; title: string; done: boolean }[] };
const blank: Draft = { fields: {}, notes: '', checks: [] };
export default function DailyTools() {
  const { tool = '' } = useParams();
  const { user } = useAuth();
  return <DailyTool key={`${user?.userId}:${tool}`} tool={tool} userId={user?.userId || ''} />;
}
function DailyTool({ tool, userId }: { tool: string; userId: string }) {
  const config = WORKSPACE_TOOLS.find(value => value.id === tool);
  const { addTask } = useData();
  const key = `getweb-tool:${userId}:${tool}`;
  const [draft, setDraft] = useState<Draft>(() => { try { return JSON.parse(localStorage.getItem(key) || 'null') || blank; } catch { return blank; } });
  const [newCheck, setNewCheck] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { const timeout = setTimeout(() => { try { localStorage.setItem(key, JSON.stringify(draft)); } catch { toast.error('Device storage is full. Copy your work before leaving.'); } }, 400); return () => clearTimeout(timeout); }, [draft, key]);
  const value = (name: string) => draft.fields[name] || '';
  function field(name: string, label: string, type = 'text', placeholder = '') {
    return <div className="space-y-1.5" key={name}><Label htmlFor={name}>{label}</Label><Input id={name} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined} placeholder={placeholder} value={value(name)} onChange={event => setDraft(previous => ({ ...previous, fields: { ...previous.fields, [name]: event.target.value } }))} /></div>;
  }
  const output = useMemo(() => {
    const f = draft.fields;
    if (tool === 'utm') { try { return campaignUrl({ url: f.url || '', source: f.source || '', medium: f.medium || '', campaign: f.campaign || '', content: f.content, term: f.term }); } catch { return ''; } }
    if (tool === 'brief') return `CAMPAIGN BRIEF\n\nClient / product: ${f.client || '—'}\nCampaign: ${f.campaign || '—'}\nObjective: ${f.goal || '—'}\nAudience: ${f.audience || '—'}\nOffer / message: ${f.offer || '—'}\nChannels: ${f.channels || '—'}\nBudget (INR): ${f.budget || '—'}\nDeadline: ${f.deadline || '—'}\nSuccess metric: ${f.metric || '—'}\n\nDelivery checklist\n[ ] Confirm scope and tracking\n[ ] Prepare and review assets\n[ ] Get client approval\n[ ] Launch and check tracking\n[ ] Review results and report`;
    return `${draft.notes}\n\n${draft.checks.map(check => `[${check.done ? 'x' : ' '}] ${check.title}`).join('\n')}`.trim();
  }, [draft, tool]);
  async function copy() { try { await navigator.clipboard.writeText(output); toast.success('Copied'); } catch { toast.error('Clipboard unavailable. Select and copy the text below.'); } }
  async function makeTask() {
    if (!value('campaign').trim()) { toast.error('Add a campaign name first.'); return; }
    setSaving(true);
    try { await addTask({ title: value('campaign'), description: output, category: 'Marketing', date: todayStr(), due_date: value('deadline') || null }); toast.success('Campaign task created'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Task could not be saved.'); }
    finally { setSaving(false); }
  }
  if (!config) return <ToolHeader title="Tool not found" description="Choose a tool from the workspace toolkit." />;
  const spend = Number(value('spend')), revenue = Number(value('revenue')), customers = Number(value('customers'));
  const hours = Number(value('hours')), rate = Number(value('rate')), cost = Number(value('cost'));
  return <div className="space-y-5"><ToolHeader title={config.name} description={config.description} /><p className="text-xs text-muted-foreground">Working drafts save on this device for your account.</p>
    {tool === 'utm' && <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]"><div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">{field('url', 'Destination URL', 'url', 'https://example.com/offer')}{field('source', 'Source *', 'text', 'instagram')}{field('medium', 'Medium *', 'text', 'paid_social')}{field('campaign', 'Campaign *', 'text', 'october_launch')}{field('content', 'Content (optional)', 'text', 'reel_a')}{field('term', 'Keyword (optional)')}</div><div className="space-y-3 rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">Campaign URL</h2><Textarea aria-label="Generated campaign URL" readOnly value={output} rows={6} className="break-all font-mono text-xs" placeholder="Enter a website URL, source, medium and campaign." /><Button disabled={!output} onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy link</Button></div></div>}
    {tool === 'brief' && <div className="grid gap-5 lg:grid-cols-2"><div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">{field('client', 'Client / product')}{field('campaign', 'Campaign name *')}{field('goal', 'Objective')}{field('audience', 'Target audience')}{field('offer', 'Offer / key message')}{field('channels', 'Channels')}{field('budget', 'Budget (INR)', 'number')}{field('deadline', 'Deadline', 'date')}{field('metric', 'Success metric', 'text', 'Qualified leads, activation rate…')}</div><div className="space-y-3 rounded-xl border bg-card p-4"><Textarea aria-label="Campaign brief output" readOnly value={output} rows={19} className="font-mono text-xs" /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy brief</Button><Button disabled={saving} onClick={makeTask}><ClipboardList className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Create campaign task'}</Button></div></div></div>}
    {tool === 'calculator' && <div className="grid gap-4 lg:grid-cols-2"><section className="space-y-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">Campaign performance</h2><div className="grid gap-4 sm:grid-cols-2">{field('spend', 'Ad spend (INR)', 'number')}{field('revenue', 'Attributed revenue (INR)', 'number')}{field('customers', 'Acquired customers', 'number')}</div><div className="grid grid-cols-2 gap-3"><Metric label="ROAS" value={spend > 0 ? `${(revenue / spend).toFixed(2)}x` : '—'} /><Metric label="Acquisition cost" value={customers > 0 ? `₹${(spend / customers).toFixed(2)}` : '—'} /></div></section><section className="space-y-4 rounded-xl border bg-card p-4"><h2 className="font-semibold">Project estimate</h2><div className="grid gap-4 sm:grid-cols-2">{field('hours', 'Estimated hours', 'number')}{field('rate', 'Client rate / hour (INR)', 'number')}{field('cost', 'Delivery cost / hour (INR)', 'number')}</div><div className="grid grid-cols-2 gap-3"><Metric label="Project revenue" value={`₹${(hours * rate).toFixed(2)}`} /><Metric label="Gross margin before overhead" value={rate > 0 ? `${((rate - cost) / rate * 100).toFixed(1)}%` : '—'} /></div></section></div>}
    {tool === 'notes' && <div className="grid gap-4 lg:grid-cols-2"><section className="space-y-3 rounded-xl border bg-card p-4"><Label htmlFor="quick-notes">Working notes</Label><Textarea id="quick-notes" value={draft.notes} onChange={event => setDraft(previous => ({ ...previous, notes: event.target.value }))} rows={13} maxLength={30000} placeholder="Meeting notes, ideas, next steps…" /><Button variant="outline" disabled={!output} onClick={copy}><Copy className="mr-2 h-4 w-4" />Copy notes & checklist</Button></section><section className="space-y-3 rounded-xl border bg-card p-4"><h2 className="text-sm font-semibold">Personal checklist</h2><form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (!newCheck.trim()) return; setDraft(previous => ({ ...previous, checks: [...previous.checks, { id: crypto.randomUUID(), title: newCheck.trim(), done: false }] })); setNewCheck(''); }}><Input aria-label="New checklist item" value={newCheck} onChange={event => setNewCheck(event.target.value)} maxLength={300} placeholder="Add a step…" /><Button size="icon" aria-label="Add checklist item"><Plus className="h-4 w-4" /></Button></form><div className="divide-y">{draft.checks.map(check => <div className="flex items-center gap-2 py-2.5" key={check.id}><button aria-label={`Mark ${check.title} ${check.done ? 'incomplete' : 'complete'}`} aria-pressed={check.done} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${check.done ? 'bg-primary text-primary-foreground' : ''}`} onClick={() => setDraft(previous => ({ ...previous, checks: previous.checks.map(item => item.id === check.id ? { ...item, done: !item.done } : item) }))}>{check.done && <Check className="h-4 w-4" />}</button><span className={`min-w-0 flex-1 break-words text-sm ${check.done ? 'text-muted-foreground line-through' : ''}`}>{check.title}</span><Button variant="ghost" size="icon" aria-label={`Remove ${check.title}`} onClick={() => setDraft(previous => ({ ...previous, checks: previous.checks.filter(item => item.id !== check.id) }))}><Trash2 className="h-4 w-4" /></Button></div>)}</div>{!draft.checks.length && <p className="py-6 text-center text-xs text-muted-foreground">Add your next small step.</p>}</section></div>}
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }
