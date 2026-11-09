import { Router } from 'express';
import { db } from './db.js';
import { requireBranch } from './auth.js';
import { preliminaryBalances } from './preliminary-balances.js';
export const balanceSummaryRouter = Router();
balanceSummaryRouter.get('/', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const scope = { organizationId: req.session!.organizationId, branchId };
  const result = await db.$transaction(async tx => {
    const [stock, invoices, parties, purchases, payments] = await Promise.all([
      tx.stockBalance.findMany({ where: { branchId, branch: { organizationId: scope.organizationId } }, select: { quantity: true, variant: { select: { purchasePrice: true } } } }),
      tx.salesInvoice.findMany({ where: { ...scope, status: 'POSTED' }, select: { grandTotal: true, paidAmount: true, creditNotes: { where: scope, select: { amount: true } } } }),
      tx.party.findMany({ where: scope, select: { openingBalance: true, openingBalanceType: true } }),
      tx.voucher.findMany({ where: { ...scope, type: 'Purchase Invoice' }, select: { amount: true, details: true } }),
      tx.payment.findMany({ where: scope, select: { direction: true, amount: true } }),
    ]);
    return preliminaryBalances({ stock, invoices, parties, purchases, payments });
  }, { isolationLevel: 'RepeatableRead' });
  res.json({ ...result, generatedAt: new Date().toISOString() });
});
