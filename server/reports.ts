import { Router } from 'express';
import { db } from './db.js';
import { requireBranch, requirePermission } from './auth.js';
import { reportQuery, reportBounds, matchesReportTime, summarizeItems } from './report-data.js';
import { reportTablesRouter } from './report-tables.js';

export const reportsRouter = Router();
reportsRouter.use(requirePermission('reports.read'));
reportsRouter.use('/table', reportTablesRouter);
reportsRouter.get('/item-summary', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const q = reportQuery.parse(req.query);
  const bounds = reportBounds(q);
  const organizationId = req.session!.organizationId;
  const [variants, invoices, purchases] = await db.$transaction([
    db.productVariant.findMany({ where: { product: { organizationId, branchId } }, include: { product: true } }),
    db.salesInvoice.findMany({ where: { organizationId, branchId, status: 'POSTED', invoiceDate: bounds.where }, include: { lines: true } }),
    db.voucher.findMany({ where: { organizationId, branchId, type: 'Purchase Invoice', date: bounds.where } }),
  ], { isolationLevel: 'RepeatableRead' });
  const rows = summarizeItems(
    variants.map(v => ({ id: v.id, name: v.product.name, sku: v.sku, category: v.product.category, size: v.size || '' })),
    invoices.filter(i => matchesReportTime(i.invoiceDate, i.createdAt, q)).flatMap(i => i.lines.map(l => ({ variantId: l.variantId, itemName: l.itemName, sku: l.sku, quantity: Number(l.quantity), total: Number(l.total) }))),
    purchases.filter(p => matchesReportTime(p.date, p.createdAt, q)).flatMap(p => p.items as Array<{ variantId?: string; name: string; qty: number; amount: number }>),
  );
  res.json({ rows, from: bounds.from, to: bounds.to });
});
