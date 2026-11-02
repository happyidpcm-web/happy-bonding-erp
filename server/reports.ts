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
  const productByVariant = new Map(variants.map(v => [v.id, v.productId]));
  const products = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const id = productByVariant.get(row.id) || row.id;
    const existing = products.get(id);
    if (existing) {
      existing.salesQty += row.salesQty; existing.purchaseQty += row.purchaseQty;
      existing.salesAmount += row.salesAmount; existing.purchaseAmount += row.purchaseAmount;
      existing.sku = [...new Set([...existing.sku.split(', '), row.sku].filter(Boolean))].join(', ');
    } else products.set(id, { ...row, id, size: '' });
  }
  const summary = [...products.values()].map(r => ({ ...r, salesQty: Number(r.salesQty.toFixed(3)), purchaseQty: Number(r.purchaseQty.toFixed(3)), salesAmount: Number(r.salesAmount.toFixed(2)), purchaseAmount: Number(r.purchaseAmount.toFixed(2)) })).sort((a, b) => b.salesQty - a.salesQty || a.name.localeCompare(b.name));
  res.json({ rows: summary, from: bounds.from, to: bounds.to });
});
