import type { AgencyLead } from '@/types/crm';

export const money = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
export const isOpenLead = (lead: AgencyLead) => !['Won', 'Lost'].includes(lead.stage);
export const followUpDue = (lead: AgencyLead, now = new Date()) => isOpenLead(lead) && !!lead.next_follow_up && new Date(lead.next_follow_up).getTime() <= now.getTime();
export function pipelineSummary(leads: AgencyLead[], now = new Date()) {
  const open = leads.filter(isOpenLead);
  const won = leads.filter(lead => lead.stage === 'Won');
  const closed = leads.filter(lead => ['Won', 'Lost'].includes(lead.stage));
  return {
    open: open.length,
    value: open.reduce((sum, lead) => sum + Number(lead.monthly_value), 0),
    due: leads.filter(lead => followUpDue(lead, now)).length,
    won: won.reduce((sum, lead) => sum + Number(lead.monthly_value), 0),
    winRate: closed.length ? Math.round(won.length / closed.length * 100) : 0,
  };
}
