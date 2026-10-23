export const LEAD_STAGES = ['New', 'Contacted', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
export type LeadStage = typeof LEAD_STAGES[number];
export const AGENCY_SERVICES = ['SEO', 'Social media', 'Paid ads', 'Web development', 'Branding', 'Content', 'Video production', 'Email marketing'];
export const LEAD_SOURCES = ['Referral', 'Website', 'Instagram', 'LinkedIn', 'Outbound', 'Other'];
export type AgencyLead = {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  source: string;
  services: string[];
  stage: LeadStage;
  monthly_value: number;
  owner_id: string | null;
  next_follow_up: string | null;
  notes: string | null;
  client_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
export type LeadActivity = {
  id: string;
  lead_id: string;
  kind: 'Note' | 'Call' | 'Email' | 'Meeting';
  body: string;
  created_by: string | null;
  created_at: string;
}
export type CrmTable<Row, Insert> = { Row: Row; Insert: Insert; Update: Partial<Insert>; Relationships: [] };
export type LeadInsert = Pick<AgencyLead, 'name' | 'company'> & Partial<Omit<AgencyLead, 'name' | 'company'>>;
export type ActivityInsert = Pick<LeadActivity, 'lead_id' | 'body'> & Partial<Omit<LeadActivity, 'lead_id' | 'body'>>;
