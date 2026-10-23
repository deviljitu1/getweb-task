import { useState, type FormEvent } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '@/contexts/DataContext';
import { AGENCY_SERVICES, LEAD_SOURCES, LEAD_STAGES, type AgencyLead, type LeadInsert } from '@/types/crm';
import { cn } from '@/lib/utils';

export default function LeadForm({ lead, onClose, onSave }: { lead?: AgencyLead; onClose: () => void; onSave: (input: LeadInsert) => Promise<void> }) {
  const { members } = useData();
  const [services, setServices] = useState(lead?.services || []);
  const [stage, setStage] = useState(lead?.stage || 'New');
  const [source, setSource] = useState(lead?.source || 'Referral');
  const [owner, setOwner] = useState(lead?.owner_id || 'unassigned');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const followUp = lead?.next_follow_up ? new Date(new Date(lead.next_follow_up).getTime() - new Date(lead.next_follow_up).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError('');
    try {
      const next = String(form.get('follow_up') || '');
      await onSave({ name: String(form.get('name')).trim(), company: String(form.get('company')).trim(), email: String(form.get('email') || '').trim() || null, phone: String(form.get('phone') || '').trim() || null, monthly_value: Number(form.get('value') || 0), notes: String(form.get('notes') || '').trim() || null, source, stage, services, owner_id: owner === 'unassigned' ? null : owner, next_follow_up: next ? new Date(next).toISOString() : null });
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save lead. Please try again.'); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{lead ? 'Edit opportunity' : 'New opportunity'}</DialogTitle><DialogDescription>Keep the contact, scope, and next step in one place.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="lead-name">Contact name *</Label><Input id="lead-name" name="name" required maxLength={160} defaultValue={lead?.name} placeholder="Full name" /></div>
        <div className="space-y-2"><Label htmlFor="lead-company">Company *</Label><Input id="lead-company" name="company" required maxLength={160} defaultValue={lead?.company} placeholder="Business name" /></div>
        <div className="space-y-2"><Label htmlFor="lead-email">Email</Label><Input id="lead-email" name="email" type="email" defaultValue={lead?.email || ''} placeholder="contact@company.com" /></div>
        <div className="space-y-2"><Label htmlFor="lead-phone">Phone</Label><Input id="lead-phone" name="phone" type="tel" defaultValue={lead?.phone || ''} placeholder="+91" /></div>
        <div className="space-y-2"><Label htmlFor="lead-value">Monthly retainer (₹)</Label><Input id="lead-value" name="value" type="number" min="0" max="9999999999" step="0.01" defaultValue={lead?.monthly_value || 0} /></div>
        <div className="space-y-2"><Label htmlFor="lead-followup">Next follow-up</Label><Input id="lead-followup" name="follow_up" type="datetime-local" defaultValue={followUp} /></div>
        <div className="space-y-2"><Label>Stage</Label><Select value={stage} onValueChange={value => setStage(value as AgencyLead['stage'])}><SelectTrigger aria-label="Lead stage"><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Source</Label><Select value={source} onValueChange={setSource}><SelectTrigger aria-label="Lead source"><SelectValue /></SelectTrigger><SelectContent>{LEAD_SOURCES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label>Relationship owner</Label><Select value={owner} onValueChange={setOwner}><SelectTrigger aria-label="Relationship owner"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{members.filter(member => member.is_active).map(member => <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>)}</SelectContent></Select></div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Services of interest</legend><div className="flex flex-wrap gap-2">{AGENCY_SERVICES.map(service => <Button key={service} type="button" variant="outline" size="sm" aria-pressed={services.includes(service)} className={cn('rounded-full', services.includes(service) && 'border-primary bg-primary/10 text-primary')} onClick={() => setServices(current => current.includes(service) ? current.filter(value => value !== service) : [...current, service])}>{services.includes(service) && <Check className="mr-1 h-3 w-3" />}{service}</Button>)}</div></fieldset>
      <div className="space-y-2"><Label htmlFor="lead-notes">Brief & notes</Label><Textarea id="lead-notes" name="notes" rows={3} maxLength={10000} defaultValue={lead?.notes || ''} placeholder="Goals, scope, budget, and anything to remember…" /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save opportunity</Button></div>
    </form>
  </DialogContent></Dialog>;
}
