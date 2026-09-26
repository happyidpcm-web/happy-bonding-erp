import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db.js';
import { requireBranch, requirePermission } from './auth.js';

export const voucherRouter = Router();
const types = z.enum(['Quotation', 'Sales Return', 'Credit Note', 'Delivery Challan', 'Proforma Invoice', 'Purchase Invoice', 'Payment Out', 'Purchase Return', 'Debit Note', 'Purchase Order']);
const inputSchema = z.object({
  id: z.string().min(1).max(100), type: types,
  number: z.string().trim().min(1).max(100), date: z.coerce.date(),
  party: z.string().trim().min(1).max(160), amount: z.number().finite().nonnegative(),
  status: z.enum(['Open', 'Paid']).default('Open'), dueIn: z.string().max(100).optional(), notes: z.string().max(1000).optional(),
  items: z.array(z.object({ variantId: z.string().optional(), name: z.string().min(1), hsn: z.string(), qty: z.number().positive(), price: z.number().nonnegative(), amount: z.number().nonnegative() })).default([]),
});
const permission = (type: string) => ['Purchase Invoice', 'Purchase Return', 'Purchase Order', 'Payment Out', 'Debit Note'].includes(type) ? 'products.write' : 'sales.write';

voucherRouter.get('/', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const type = types.parse(req.query.type);
  const rows = await db.voucher.findMany({ where: { organizationId: req.session!.organizationId, branchId, type }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] });
  res.json(rows.map(row => ({ ...row, amount: Number(row.amount) })));
});

voucherRouter.post('/', async (req, res, next) => {
  const type = types.parse(req.body?.type);
  requirePermission(permission(type))(req, res, next);
}, async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = inputSchema.parse(req.body);
  const organizationId = req.session!.organizationId;
  if (input.type === 'Purchase Invoice' && (!input.items.length || input.items.some(i => !i.variantId))) {
    return res.status(400).json({ error: 'Purchase items must reference inventory products.' });
  }
  const result = await db.$transaction(async tx => {
    const existing = await tx.voucher.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.organizationId !== organizationId || existing.branchId !== branchId || existing.type !== input.type) throw new Error('Voucher ID already in use');
      return existing;
    }
    const row = await tx.voucher.create({ data: { ...input, organizationId, branchId, items: input.items as Prisma.InputJsonValue } });
    if (input.type === 'Purchase Invoice') {
      const prior = await tx.stockMovement.count({ where: { branchId, referenceType: 'PurchaseInvoice', referenceId: input.number, type: 'PURCHASE' } });
      if (prior) throw new Error('A stock receipt already exists with this purchase number.');
      for (const item of input.items) {
        const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, product: { organizationId } } });
        if (!variant) throw new Error('Purchase item does not belong to this organization');
        await tx.stockBalance.upsert({ where: { branchId_variantId: { branchId, variantId: variant.id } }, create: { branchId, variantId: variant.id, quantity: item.qty }, update: { quantity: { increment: item.qty } } });
        await tx.stockMovement.create({ data: { branchId, variantId: variant.id, type: 'PURCHASE', quantity: item.qty, unitCost: item.price, referenceType: 'PurchaseInvoice', referenceId: input.number, occurredAt: input.date } });
      }
    }
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: 'voucher.created', entityType: 'Voucher', entityId: row.id, metadata: { type: input.type, number: input.number } } });
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ ...result, amount: Number(result.amount) });
});

voucherRouter.delete('/:id', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const row = await db.voucher.findFirst({ where: { id: String(req.params.id), organizationId, branchId } });
  if (!row) return res.status(404).json({ error: 'Voucher not found' });
  if (!req.session!.permissions.some(p => p === '*' || p === permission(row.type))) return res.status(403).json({ error: 'Permission denied' });
  await db.$transaction(async tx => {
    if (row.type === 'Purchase Invoice') {
      const movements = await tx.stockMovement.findMany({ where: { branchId, referenceType: 'PurchaseInvoice', referenceId: row.number, type: 'PURCHASE' } });
      for (const move of movements) {
        const changed = await tx.stockBalance.updateMany({ where: { branchId, variantId: move.variantId, quantity: { gte: move.quantity } }, data: { quantity: { decrement: move.quantity } } });
        if (changed.count !== 1) throw new Error('Insufficient stock to reverse this purchase.');
        await tx.stockMovement.create({ data: { branchId, variantId: move.variantId, type: 'ADJUSTMENT_OUT', quantity: move.quantity.negated(), unitCost: move.unitCost, referenceType: 'PurchaseInvoiceDelete', referenceId: row.id } });
      }
    }
    await tx.voucher.delete({ where: { id: row.id } });
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: 'voucher.deleted', entityType: 'Voucher', entityId: row.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ ok: true });
});
