import type { Invoice, InvoiceLine, InvoiceParty } from '@/types/finance';
import { todayStr } from '@/lib/utils';

export const emptyParty = (): InvoiceParty => ({ name: '', address: '', email: '', phone: '', tax_id: '' });
export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
export function calculateInvoice(input: { items: InvoiceLine[]; discount_percent: number; tax_percent: number; advance_kind: Invoice['advance_kind']; advance_value: number }, received = 0) {
  for (const item of input.items) {
    if (!item.description.trim() || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1000000 || !Number.isFinite(item.rate) || item.rate < 0 || item.rate > 100000000) throw new Error('Each service needs a description, valid positive quantity and non-negative rate.');
    if (Math.abs(cents(item.rate) / 100 - item.rate) > 1e-8 || Math.abs(Math.round(item.quantity * 1000) / 1000 - item.quantity) > 1e-8) throw new Error('Use up to two decimal places for rates and three for quantities.');
  }
  for (const percent of [input.discount_percent, input.tax_percent]) if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Tax and discount must be between 0 and 100%.');
  for (const percent of [input.discount_percent, input.tax_percent]) if (Math.abs(cents(percent) / 100 - percent) > 1e-8) throw new Error('Use up to two decimal places for percentages.');
  const subtotal = input.items.reduce((sum, line) => sum + cents(line.quantity * line.rate), 0);
  const discount = Math.round(subtotal * input.discount_percent / 100);
  const tax = Math.round((subtotal - discount) * input.tax_percent / 100);
  const total = subtotal - discount + tax;
  if (!Number.isSafeInteger(total) || total > 99999999999999) throw new Error('Invoice total exceeds the supported amount.');
  const value = input.advance_value;
  if (!Number.isFinite(value) || value < 0 || (input.advance_kind === 'percent' && value > 100) || (input.advance_kind === 'fixed' && cents(value) > total)) throw new Error('The requested advance must be within the invoice total.');
  if (!Number.isFinite(received) || received < 0 || cents(received) > total) throw new Error('Payments cannot exceed the invoice total.');
  const requested = input.advance_kind === 'none' ? total : input.advance_kind === 'percent' ? Math.round(total * value / 100) : cents(value);
  const paid = cents(received);
  const dueNow = Math.max(requested - paid, 0);
  return { subtotal: subtotal / 100, discount: discount / 100, tax: tax / 100, total: total / 100, requested: requested / 100, received: paid / 100, dueNow: dueNow / 100, balance: (total - paid) / 100, later: (total - paid - dueNow) / 100 };
}
export function newInvoice(seller?: InvoiceParty): Invoice {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), number: null, status: 'draft', client_id: null, project_id: null, issue_date: todayStr(), due_date: null, seller: seller || { ...emptyParty(), name: 'GetWebDigital' }, customer: emptyParty(), items: [{ id: crypto.randomUUID(), description: '', project: '', quantity: 1, rate: 0 }], discount_percent: 0, tax_percent: 0, advance_kind: 'none', advance_value: 0, subtotal: 0, discount_amount: 0, tax_amount: 0, total: 0, payment_instructions: '', terms: '', notes: '', created_by: null, created_at: now, updated_at: now };
}
