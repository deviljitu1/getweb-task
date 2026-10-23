import { describe, expect, it } from 'vitest';
import { followUpDue, pipelineSummary } from './crm';
import type { AgencyLead } from '@/types/crm';

const now = new Date('2026-10-23T10:00:00Z');
const lead = (overrides: Partial<AgencyLead> = {}): AgencyLead => ({ id: 'lead', name: 'Contact', company: 'Company', email: null, phone: null, source: 'Referral', services: [], stage: 'New', monthly_value: 10000, owner_id: null, next_follow_up: null, notes: null, client_id: null, created_by: null, created_at: now.toISOString(), updated_at: now.toISOString(), ...overrides });

describe('agency pipeline', () => {
  it('excludes won and lost deals from the open pipeline and calculates monthly won value', () => {
    const stats = pipelineSummary([lead(), lead({ stage: 'Proposal', monthly_value: 25000 }), lead({ stage: 'Won', monthly_value: 50000 }), lead({ stage: 'Lost', monthly_value: 90000 })], now);
    expect(stats).toMatchObject({ open: 2, value: 35000, won: 50000, winRate: 50 });
  });
  it('handles an empty pipeline without NaN', () => {
    expect(pipelineSummary([], now)).toEqual({ open: 0, value: 0, won: 0, winRate: 0, due: 0 });
  });
  it('counts only open opportunities whose follow-up time has arrived', () => {
    const due = now.toISOString();
    expect(pipelineSummary([lead({ next_follow_up: due }), lead({ next_follow_up: '2026-10-24T10:00:00Z' }), lead({ stage: 'Won', next_follow_up: due }), lead({ stage: 'Lost', next_follow_up: due })], now).due).toBe(1);
  });
  it('does not mark missing or invalid dates as due', () => {
    expect(followUpDue(lead(), now)).toBe(false);
    expect(followUpDue(lead({ next_follow_up: 'invalid' }), now)).toBe(false);
  });
});
