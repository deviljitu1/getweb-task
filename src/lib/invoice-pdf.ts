import type { Invoice, InvoicePayment } from '@/types/finance';
import { calculateInvoice } from '@/lib/invoice';
import { exportFile } from '@/lib/export-file';

export async function createInvoicePDF(invoice: Invoice, payments: InvoicePayment[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const received = payments.filter(payment => !payment.voided).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totals = calculateInvoice(invoice, received);
  const left = 17, right = 193;
  let y = 22;
  const amount = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  // Built-in PDF fonts cover Latin text. Refuse unsupported glyphs rather than corrupting the invoice.
  const content = JSON.stringify([invoice.seller, invoice.customer, invoice.items, invoice.terms, invoice.notes, invoice.payment_instructions]);
  if ([...content].some(character => character.codePointAt(0)! > 255)) throw new Error('PDF export currently supports Latin text. Use English text in invoice fields before exporting.');
  function text(value: string, x: number, top: number, size = 10, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(30, 41, 59); doc.text(value, x, top);
  }
  function pageSpace(height: number) {
    if (y + height > 271) { doc.addPage(); y = 22; text(invoice.number || 'DRAFT', left, y, 9, true); y += 10; }
  }
  function paragraph(value: string, width = 176, size = 9) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
    const lines = doc.splitTextToSize(value || '', width) as string[];
    for (const line of lines) { pageSpace(5); text(line, left, y, size); y += 4.8; }
  }
  doc.setFillColor(91, 50, 195); doc.rect(0, 0, 210, 6, 'F');
  text(invoice.status === 'draft' ? 'DRAFT INVOICE' : invoice.status === 'void' ? 'VOID INVOICE' : 'INVOICE', left, y, 22, true);
  text(invoice.number || `Draft ${invoice.id.slice(0, 8)}`, 143, y, 10, true); y += 11;
  text(`Issued: ${invoice.issue_date}`, left, y, 9); text(`Due: ${invoice.due_date || 'As agreed'}`, 143, y, 9); y += 13;
  const partyTop = y;
  let partyBottom = y;
  for (const [party, x, label] of [[invoice.seller, left, 'FROM'], [invoice.customer, 111, 'BILL TO']] as const) {
    let py = partyTop; text(label, x, py, 8, true); py += 7;
    const values = [party.name, party.address, party.email, party.phone, party.tax_id ? `Tax ID: ${party.tax_id}` : ''].filter(Boolean);
    for (const value of values) {
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(value, 79) as string[];
      for (const line of lines) { text(line, x, py, 9, value === party.name); py += 4.8; }
    }
    partyBottom = Math.max(partyBottom, py);
  }
  y = partyBottom + 9;
  function tableHeader() {
    pageSpace(12); doc.setFillColor(242, 240, 249); doc.roundedRect(left, y - 5, 176, 9, 1, 1, 'F');
    text('SERVICE / DELIVERABLE', 20, y, 8, true); text('QTY', 124, y, 8, true); text('RATE', 141, y, 8, true); text('AMOUNT', 169, y, 8, true); y += 10;
  }
  tableHeader();
  for (const line of invoice.items) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const label = `${line.description}${line.project ? `\n${line.project}` : ''}`;
    const lines = doc.splitTextToSize(label, 96) as string[];
    const rowHeight = lines.length * 4.7 + 8;
    if (rowHeight < 225 && y + rowHeight > 265) { doc.addPage(); y = 22; tableHeader(); }
    let offset = 0;
    while (offset < lines.length) {
      if (y + 9 > 271) { doc.addPage(); y = 22; tableHeader(); }
      const count = Math.max(1, Math.floor((265 - y) / 4.7));
      const part = lines.slice(offset, offset + count);
      part.forEach((value, index) => text(value, 20, y + index * 4.7, 9));
      if (!offset) {
        text(String(line.quantity), 124, y, 9);
        doc.text(amount(line.rate).replace('INR ', ''), 163, y, { align: 'right' });
        doc.text(amount(Math.round((line.quantity * line.rate + Number.EPSILON) * 100) / 100).replace('INR ', ''), 190, y, { align: 'right' });
      }
      y += part.length * 4.7 + 5; offset += part.length;
    }
    doc.setDrawColor(229, 231, 235); doc.line(left, y - 2, right, y - 2); y += 3;
  }
  const summaries: [string, number, boolean?][] = [['Subtotal', totals.subtotal], [`Discount (${invoice.discount_percent}%)`, -totals.discount], [`Tax (${invoice.tax_percent}%)`, totals.tax], ['Invoice total', totals.total, true], ['Payments received', totals.received], ['Balance outstanding', totals.balance, true], ['Due now', totals.dueNow, true]];
  if (invoice.advance_kind !== 'none') summaries.push(['Remaining after due-now payment', totals.later]);
  pageSpace(summaries.length * 7 + 5);
  y += 3;
  for (const [label, value, bold] of summaries) {
    text(label, 104, y, 9, bold); doc.text(amount(value), right, y, { align: 'right' }); y += 7;
  }
  y += 7;
  if (invoice.payment_instructions) { pageSpace(12); text('PAYMENT DETAILS', left, y, 8, true); y += 7; paragraph(invoice.payment_instructions); y += 6; }
  if (invoice.terms) { pageSpace(12); text('TERMS', left, y, 8, true); y += 7; paragraph(invoice.terms); y += 6; }
  if (invoice.notes) { pageSpace(12); text('NOTES', left, y, 8, true); y += 7; paragraph(invoice.notes); }
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setDrawColor(229, 231, 235); doc.line(left, 282, right, 282);
    text(`${invoice.number || 'Draft'} | Amounts in INR`, left, 288, 8);
    doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, right, 288, { align: 'right' });
  }
  return doc.output('blob');
}

export async function exportInvoicePDF(invoice: Invoice, payments: InvoicePayment[]) {
  const blob = await createInvoicePDF(invoice, payments);
  await exportFile(blob, `${invoice.number || `Draft-${invoice.id.slice(0, 8)}`}.pdf`);
}
