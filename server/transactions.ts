import { Router } from 'express';
import { db } from './db.js';
import { requireBranch } from './auth.js';

export const transactionsRouter = Router();
transactionsRouter.get('/', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const where = { organizationId: req.session!.organizationId, branchId };
  const [sales, vouchers, payments, expenses, credits] = await Promise.all([
    db.salesInvoice.findMany({ where, include: { party: { select: { name: true } } } }),
    db.voucher.findMany({ where }),
    db.payment.findMany({ where, include: { allocations: { include: { salesInvoice: { include: { party: { select: { name: true } } } } } } } }),
    db.expense.findMany({ where }),
    db.creditNote.findMany({ where, include: { party: { select: { name: true } } } }),
  ]);
  const rows = [
    ...sales.map(r => ({ id: `sale:${r.id}`, sourceId: r.id, type: 'Sales Invoice', number: r.invoiceNumber, date: r.invoiceDate, recordedAt: r.createdAt, party: r.party?.name ?? 'Walk-in Customer', amount: Number(r.grandTotal) })),
    ...vouchers.map(r => ({ id: `voucher:${r.id}`, sourceId: r.id, type: r.type, number: r.number, date: r.date, recordedAt: r.createdAt, party: r.party, amount: Number(r.amount) })),
    ...payments.map(r => ({ id: `payment:${r.id}`, sourceId: r.id, type: r.direction === 'IN' ? 'Payment In' : 'Payment Out', number: r.reference || r.id, date: r.paidAt, recordedAt: r.paidAt, party: [...new Set(r.allocations.map(a => a.salesInvoice.party?.name || 'Walk-in Customer'))].join(', ') || 'Unallocated payment', amount: Number(r.amount) })),
    ...expenses.map(r => ({ id: `expense:${r.id}`, sourceId: r.id, type: 'Expense', number: r.id, date: r.expenseDate, recordedAt: r.createdAt, party: r.paidTo || r.category, amount: Number(r.amount) })),
    ...credits.map(r => ({ id: `credit:${r.id}`, sourceId: r.id, type: 'Credit Note', number: r.creditNoteNumber, date: r.date, recordedAt: r.createdAt, party: r.party.name, amount: Number(r.amount) })),
  ];
  rows.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime() || b.id.localeCompare(a.id));
  res.json(rows);
});
