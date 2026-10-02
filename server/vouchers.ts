import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db.js';
import { requireBranch, requirePermission } from './auth.js';

export const voucherRouter = Router();

// Purchase date wins; creation time breaks ties. Editing an old bill cannot
// replace the cost from a newer purchase. Only update this branch's variants.
async function syncLatestPurchasePrices(tx: Prisma.TransactionClient, organizationId: string, branchId: string, variantIds: string[]) {
  const pending = new Set(variantIds);
  const purchases = await tx.voucher.findMany({
    where: { organizationId, branchId, type: 'Purchase Invoice' },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    select: { items: true },
  });
  for (const purchase of purchases) {
    const items = purchase.items as Array<{variantId?: string; price: number}>;
    for (const item of items) {
      if (!item.variantId || !pending.has(item.variantId)) continue;
      await tx.productVariant.updateMany({ where: { id: item.variantId, product: { organizationId, branchId } }, data: { purchasePrice: item.price } });
      pending.delete(item.variantId);
    }
    if (!pending.size) break;
  }
}
const types = z.enum(['Quotation', 'Sales Return', 'Credit Note', 'Delivery Challan', 'Proforma Invoice', 'Purchase Invoice', 'Payment Out', 'Purchase Return', 'Debit Note', 'Purchase Order']);
const inputSchema = z.object({
  id: z.string().min(1).max(100), type: types,
  number: z.string().trim().min(1).max(100), date: z.coerce.date(),
  party: z.string().trim().min(1).max(160), amount: z.number().finite().nonnegative(),
  status: z.enum(['Open', 'Paid']).default('Open'), dueIn: z.string().max(100).optional(), notes: z.string().max(1000).optional(),
  items: z.array(z.object({ variantId: z.string().optional(), name: z.string().min(1), hsn: z.string(), qty: z.number().positive(), price: z.number().nonnegative(), amount: z.number().nonnegative(), mrp: z.number().nonnegative().optional(), discount: z.number().nonnegative().optional(), tax: z.number().min(0).max(100).optional() })).default([]),
  details: z.object({ paidAmount: z.number().nonnegative().default(0), paymentMode: z.string().max(40).default('Cash'), terms: z.string().max(5000).optional(), additionalCharges: z.number().nonnegative().default(0), discount: z.number().nonnegative().default(0), roundOff: z.boolean().default(false), dueDate: z.string().optional(), signatureUrl: z.string().max(500000).optional(), signatoryName: z.string().max(160).optional() }).default({ paidAmount: 0, paymentMode: 'Cash', additionalCharges: 0, discount: 0, roundOff: false }),
});
const permission = (type: string) => ['Purchase Invoice', 'Purchase Return', 'Purchase Order', 'Payment Out', 'Debit Note'].includes(type) ? 'products.write' : 'sales.write';

voucherRouter.get('/next-number', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const type = types.parse(req.query.type);
  const prefix = z.string().max(100).parse(req.query.prefix);
  const vouchers = await db.voucher.findMany({ where: { organizationId: req.session!.organizationId, branchId, type, number: { startsWith: prefix } }, select: { number: true } });
  const receipts = type === 'Purchase Invoice' ? await db.stockMovement.findMany({ where: { branchId, referenceType: 'PurchaseInvoice', type: 'PURCHASE', referenceId: { startsWith: prefix } }, select: { referenceId: true } }) : [];
  const numbers = [...vouchers.map(row => row.number), ...receipts.map(row => row.referenceId ?? '')];
  const next = numbers.reduce((max, number) => {
    const suffix = number.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
  }, 0) + 1;
  res.json({ number: String(next) });
});

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
  if (input.details.paidAmount > input.amount) return res.status(400).json({ error: 'Paid amount cannot exceed the invoice total.' });
  if (input.type === 'Purchase Invoice' && (!input.items.length || input.items.some(i => !i.variantId))) {
    return res.status(400).json({ error: 'Purchase items must reference inventory products.' });
  }
  const result = await db.$transaction(async tx => {
    const existing = await tx.voucher.findUnique({ where: { id: input.id } });
    if (existing) {
      if (existing.organizationId !== organizationId || existing.branchId !== branchId || existing.type !== input.type) throw new Error('Voucher ID already in use');
      return existing;
    }
    const duplicate = await tx.voucher.findFirst({ where: { organizationId, branchId, type: input.type, number: input.number } });
    if (duplicate) throw new Error('This number is already saved in this branch. Open the existing record or use the next number.');
    const row = await tx.voucher.create({ data: { ...input, organizationId, branchId, items: input.items as Prisma.InputJsonValue } });
    if (input.type === 'Purchase Invoice') {
      const prior = await tx.stockMovement.count({ where: { branchId, referenceType: 'PurchaseInvoice', referenceId: input.number, type: 'PURCHASE' } });
      if (prior) throw new Error('A stock receipt already exists with this purchase number.');
      for (const item of input.items) {
        const variant = await tx.productVariant.findFirst({ where: { id: item.variantId, product: { organizationId, branchId } } });
        if (!variant) throw new Error('Purchase item does not belong to this organization');
        await tx.stockBalance.upsert({ where: { branchId_variantId: { branchId, variantId: variant.id } }, create: { branchId, variantId: variant.id, quantity: item.qty }, update: { quantity: { increment: item.qty } } });
        await tx.stockMovement.create({ data: { branchId, variantId: variant.id, type: 'PURCHASE', quantity: item.qty, unitCost: item.price, referenceType: 'PurchaseInvoice', referenceId: input.number, occurredAt: input.date } });
      }
      if (input.details.paidAmount > 0) await tx.payment.create({ data: { organizationId, branchId, direction: 'OUT', mode: input.details.paymentMode, amount: input.details.paidAmount, reference: `Voucher:${row.id}`, paidAt: input.date } });
    }
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: 'voucher.created', entityType: 'Voucher', entityId: row.id, metadata: { type: input.type, number: input.number } } });
    if (input.type === 'Purchase Invoice') await syncLatestPurchasePrices(tx, organizationId, branchId, input.items.map(i => i.variantId!));
    return row;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json({ ...result, amount: Number(result.amount) });
});

voucherRouter.put('/:id', requirePermission('products.write'), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const parsed = inputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid purchase details' });
  const input = parsed.data;
  if (input.type !== 'Purchase Invoice' || input.id !== req.params.id || !input.items.length || input.items.some(i => !i.variantId)) return res.status(400).json({ error: 'Valid purchase items are required' });
  const round = (n: number) => Math.round(n * 100) / 100;
  const items = input.items.map(i => { const base = Math.max(0, i.qty * i.price - (i.discount || 0)); return { ...i, amount: round(base + base * (i.tax || 0) / 100) }; });
  const net = Math.max(0, items.reduce((s, i) => s + i.amount, 0) + input.details.additionalCharges - input.details.discount);
  const amount = input.details.roundOff ? Math.round(net) : round(net);
  if (Math.abs(amount - input.amount) > 0.01 || input.details.paidAmount > amount) return res.status(400).json({ error: 'Check invoice total and paid amount' });
  try {
    const result = await db.$transaction(async tx => {
      const old = await tx.voucher.findFirst({ where: { id: input.id, organizationId, branchId, type: 'Purchase Invoice' } });
      if (!old) throw new Error('Purchase invoice not found');
      if (old.number !== input.number) throw new Error('Invoice number cannot be changed');
      const movements = await tx.stockMovement.findMany({ where: { branchId, referenceType: { in: ['PurchaseInvoice', 'PurchaseInvoiceEdit'] }, referenceId: old.number } });
      if (!movements.length) throw new Error('Original stock receipt is missing; review this invoice before editing');
      const oldQty = new Map<string, number>();
      const newQty = new Map<string, number>();
      for (const m of movements) oldQty.set(m.variantId, (oldQty.get(m.variantId) || 0) + Number(m.quantity));
      for (const i of items) newQty.set(i.variantId!, (newQty.get(i.variantId!) || 0) + i.qty);
      for (const id of new Set([...oldQty.keys(), ...newQty.keys()])) {
        const variant = await tx.productVariant.findFirst({ where: { id, product: { organizationId, branchId } } });
        if (!variant) throw new Error('Item does not belong to this branch');
        const delta = (newQty.get(id) || 0) - (oldQty.get(id) || 0);
        if (!delta) continue;
        if (delta < 0) {
          const changed = await tx.stockBalance.updateMany({ where: { branchId, variantId: id, quantity: { gte: -delta } }, data: { quantity: { increment: delta } } });
          if (changed.count !== 1) throw new Error('Not enough stock to reduce this purchase quantity');
        } else await tx.stockBalance.upsert({ where: { branchId_variantId: { branchId, variantId: id } }, create: { branchId, variantId: id, quantity: delta }, update: { quantity: { increment: delta } } });
        await tx.stockMovement.create({ data: { branchId, variantId: id, type: delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', quantity: delta, referenceType: 'PurchaseInvoiceEdit', referenceId: old.number } });
      }
      const payments = await tx.payment.findMany({ where: { organizationId, branchId, reference: `Voucher:${old.id}` }, include: { allocations: true } });
      if (payments.length > 1 || payments.some(p => p.allocations.length)) throw new Error('Linked payments require review before editing');
      if (payments[0]) await tx.payment.update({ where: { id: payments[0].id }, data: { amount: input.details.paidAmount, mode: input.details.paymentMode, paidAt: input.date } });
      else if (input.details.paidAmount > 0) await tx.payment.create({ data: { organizationId, branchId, direction: 'OUT', mode: input.details.paymentMode, amount: input.details.paidAmount, reference: `Voucher:${old.id}`, paidAt: input.date } });
      const updated = await tx.voucher.update({ where: { id: old.id }, data: { date: input.date, party: input.party, amount, status: input.details.paidAmount >= amount ? 'Paid' : 'Open', dueIn: input.dueIn, notes: input.notes, items: items as Prisma.InputJsonValue, details: input.details } });
      await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: 'purchase.edited', entityType: 'Voucher', entityId: old.id, metadata: { before: JSON.parse(JSON.stringify(old)), after: JSON.parse(JSON.stringify(updated)) } } });
      await syncLatestPurchasePrices(tx, organizationId, branchId, [...new Set([...oldQty.keys(), ...newQty.keys()])]);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ ...result, amount: Number(result.amount) });
  } catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : 'Purchase edit failed; reload and try again' }); }
});

voucherRouter.delete('/:id', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const row = await db.voucher.findFirst({ where: { id: String(req.params.id), organizationId, branchId } });
  if (!row) return res.status(404).json({ error: 'Voucher not found' });
  if (row.type === 'Purchase Invoice') return res.status(409).json({ error: 'Saved purchases cannot be deleted. Use Edit for corrections.' });
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
    await tx.payment.deleteMany({ where: { organizationId, branchId, reference: `Voucher:${row.id}` } });
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: 'voucher.deleted', entityType: 'Voucher', entityId: row.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.json({ ok: true });
});
