export type InvoiceParty = { name: string; address: string; email: string; phone: string; tax_id: string };
export type InvoiceLine = { id: string; description: string; project: string; quantity: number; rate: number };
export type Invoice = {
  id: string; number: string | null; status: 'draft' | 'issued' | 'void';
  client_id: string | null; project_id: string | null;
  issue_date: string; due_date: string | null; seller: InvoiceParty; customer: InvoiceParty;
  items: InvoiceLine[]; discount_percent: number; tax_percent: number;
  advance_kind: 'none' | 'percent' | 'fixed'; advance_value: number;
  subtotal: number; discount_amount: number; tax_amount: number; total: number;
  payment_instructions: string; terms: string; notes: string;
  created_by: string | null; created_at: string; updated_at: string;
};
export type InvoiceInsert = Pick<Invoice, 'seller' | 'customer' | 'items' | 'issue_date'> & Partial<Omit<Invoice, 'seller' | 'customer' | 'items' | 'issue_date'>>;
export type InvoicePayment = { id: string; invoice_id: string; amount: number; paid_on: string; reference: string; notes: string; created_by: string | null; created_at: string; voided: boolean; void_reason: string | null };
export const FINANCE_KINDS = ['expense', 'subscription', 'asset', 'settlement', 'investment'] as const;
export type FinanceKind = typeof FINANCE_KINDS[number];
export type FinanceEntry = {
  id: string; kind: FinanceKind; title: string; amount: number; date: string; status: string;
  category: string; counterparty: string; member_id: string | null; client_id: string | null; project_id: string | null;
  frequency: 'monthly' | 'yearly' | 'quarterly' | 'weekly' | null; next_due: string | null;
  direction: 'company_owes' | 'member_owes' | 'contribution' | 'withdrawal' | 'purchase' | 'sale' | null;
  serial_number: string; warranty_until: string | null; receipt_path: string | null; notes: string;
  created_by: string | null; created_at: string; updated_at: string;
};
export type FinanceEntryInsert = Pick<FinanceEntry, 'kind' | 'title' | 'amount' | 'date' | 'status'> & Partial<Omit<FinanceEntry, 'kind' | 'title' | 'amount' | 'date' | 'status'>>;
