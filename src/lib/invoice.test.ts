import { describe, expect, it } from 'vitest';
import { calculateInvoice } from './invoice';
const invoice = { items: [{ id: 'one', description: 'Retainer', project: '', quantity: 3, rate: 12000 }], discount_percent: 0, tax_percent: 0, advance_kind: 'percent' as const, advance_value: 50 };
describe('invoice balances', () => {
  it('keeps a requested advance separate from money received', () => {
    expect(calculateInvoice(invoice)).toMatchObject({ total: 36000, requested: 18000, received: 0, dueNow: 18000, later: 18000, balance: 36000 });
    expect(calculateInvoice(invoice, 5000)).toMatchObject({ dueNow: 13000, balance: 31000, later: 18000 });
    expect(calculateInvoice(invoice, 18000)).toMatchObject({ dueNow: 0, balance: 18000, later: 18000 });
    expect(calculateInvoice(invoice, 36000).balance).toBe(0);
  });
  it('supports a fixed advance', () => {
    expect(calculateInvoice({ ...invoice, advance_kind: 'fixed', advance_value: 7000 }).dueNow).toBe(7000);
  });
  it('rounds line items, discount and tax to currency precision', () => {
    const result = calculateInvoice({ ...invoice, items: [{ ...invoice.items[0], quantity: 3, rate: 199.99 }], discount_percent: 10, tax_percent: 18 });
    expect(result).toMatchObject({ subtotal: 599.97, discount: 60, tax: 97.19, total: 637.16, requested: 318.58 });
  });
  it('rejects invalid amounts rather than silently changing them', () => {
    expect(() => calculateInvoice({ ...invoice, discount_percent: 101 })).toThrow();
    expect(() => calculateInvoice({ ...invoice, items: [{ ...invoice.items[0], quantity: 0 }] })).toThrow();
    expect(() => calculateInvoice({ ...invoice, advance_kind: 'fixed', advance_value: 40000 })).toThrow();
    expect(() => calculateInvoice(invoice, 36001)).toThrow();
  });
});
