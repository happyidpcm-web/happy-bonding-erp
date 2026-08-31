import "dotenv/config";
import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import cors from "cors";
import helmet from "helmet";
import { compare, hash } from "bcryptjs";
import { Prisma, PaymentStatus } from "@prisma/client";
import { z, ZodError } from "zod";
import { db } from "./db.js";
import { createToken, requireAuth, requireBranch, requirePermission } from "./auth.js";
import { env } from "./env.js";
import { invoiceInput, invoiceSettingInput, loginInput, parseInput, partyInput, productInput, purchaseStockInput } from "./validation.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "happy-bonding-api" }));

async function ensureAdminUser() {
  try {
    const passwordHash = await hash("HappyBonding@2026", 12);
    const organization = await db.organization.upsert({
      where: { id: "happy-bonding" }, update: {},
      create: { id: "happy-bonding", name: "Happy Bonding Men's Wear", phone: "7708030903", gstin: "33CWZPS9715D1ZU", pan: "CWZPS9715D", stateCode: "33" },
    });
    const branch = await db.branch.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: "PAV" } }, update: {},
      create: { organizationId: organization.id, code: "PAV", name: "Pavoorchatram", address: "No. 10/901, West Bus Stand, Near Railway Gate, Pavoorchatram - 627808" },
    });
    const role = await db.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: "Owner" } },
      update: { permissions: ["*"] }, create: { organizationId: organization.id, name: "Owner", permissions: ["*"] },
    });
    const user = await db.user.upsert({
      where: { email: "admin@happybonding.in" }, update: { passwordHash, roleId: role.id },
      create: { organizationId: organization.id, roleId: role.id, name: "Saravana", email: "admin@happybonding.in", phone: "7708030903", passwordHash },
    });
    await db.userBranch.upsert({ where: { userId_branchId: { userId: user.id, branchId: branch.id } }, update: {}, create: { userId: user.id, branchId: branch.id } });
  } catch (err) {
    console.error("Auto admin user creation error:", err);
  }
}

app.post("/api/auth/login", async (req, res) => {
  await ensureAdminUser();
  const input = parseInput(loginInput, req.body);
  let user = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { role: true, branches: true } });
  if (!user) {
    await ensureAdminUser();
    user = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { role: true, branches: true } });
  }
  if (!user || !user.active || !(await compare(input.password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password" });
  const session = { userId: user.id, organizationId: user.organizationId, branchIds: user.branches.map(x => x.branchId), permissions: user.role.permissions, tokenVersion: user.tokenVersion };
  const branches = await db.branch.findMany({ where: { id: { in: session.branchIds } }, orderBy: { name: "asc" } });
  res.json({ token: await createToken(session), user: { id: user.id, name: user.name, email: user.email, role: user.role.name }, branchIds: session.branchIds, branches });
});

app.use("/api", requireAuth);

app.get("/api/branches", async (req, res) => {
  const isOwner = req.session!.permissions.includes("*");
  const rows = await db.branch.findMany({
    where: {
      organizationId: req.session!.organizationId,
      ...(isOwner ? {} : { id: { in: req.session!.branchIds } }),
    },
    orderBy: { name: "asc" },
  });
  res.json(rows);
});

app.post("/api/branches", requirePermission("settings.write"), async (req, res) => {
  const organizationId = req.session!.organizationId;
  const code = String(req.body?.code ?? "").trim().toUpperCase().slice(0, 12);
  const name = String(req.body?.name ?? "").trim();
  if (!code || !name) return res.status(400).json({ error: "Branch code and name are required" });
  const row = await db.branch.create({
    data: { organizationId, code, name, address: String(req.body?.address ?? ""), phone: String(req.body?.phone ?? "") },
  });
  await db.userBranch.upsert({ where: { userId_branchId: { userId: req.session!.userId, branchId: row.id } }, update: {}, create: { userId: req.session!.userId, branchId: row.id } });
  await audit(req, "branch.created", "Branch", row.id, { code, name });
  res.status(201).json(row);
});

app.get("/api/owner/summary", requirePermission("reports.read"), async (req, res) => {
  const organizationId = req.session!.organizationId;
  const branches = await db.branch.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  const summary = await Promise.all(branches.map(async branch => {
    const [salesAgg, paymentInAgg, paymentOutAgg, stockAgg, invoiceCount] = await Promise.all([
      db.salesInvoice.aggregate({ where: { organizationId, branchId: branch.id }, _sum: { grandTotal: true } }),
      db.payment.aggregate({ where: { organizationId, branchId: branch.id, direction: "IN" }, _sum: { amount: true } }),
      db.payment.aggregate({ where: { organizationId, branchId: branch.id, direction: "OUT" }, _sum: { amount: true } }),
      db.stockBalance.aggregate({ where: { branchId: branch.id }, _sum: { quantity: true } }),
      db.salesInvoice.count({ where: { organizationId, branchId: branch.id } }),
    ]);
    return {
      branchId: branch.id,
      branchName: branch.name,
      code: branch.code,
      salesTotal: Number(salesAgg._sum.grandTotal ?? 0),
      paymentIn: Number(paymentInAgg._sum.amount ?? 0),
      paymentOut: Number(paymentOutAgg._sum.amount ?? 0),
      stockQty: Number(stockAgg._sum.quantity ?? 0),
      invoiceCount,
    };
  }));
  res.json(summary);
});

app.get("/api/staff", requirePermission("settings.write"), async (req, res) => {
  const rows = await db.user.findMany({
    where: { organizationId: req.session!.organizationId, active: true },
    include: { role: true, branches: { include: { branch: true } } },
    orderBy: { name: "asc" },
  });
  res.json(rows.map(user => ({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role.name, branches: user.branches.map(x => x.branch) })));
});

app.post("/api/staff", requirePermission("settings.write"), async (req, res) => {
  const organizationId = req.session!.organizationId;
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const branchIds = Array.isArray(req.body?.branchIds) ? req.body.branchIds.map(String) : [];
  if (!name || !email || password.length < 8 || branchIds.length === 0) return res.status(400).json({ error: "Name, email, password and at least one branch are required" });
  const validBranches = await db.branch.findMany({ where: { organizationId, id: { in: branchIds } }, select: { id: true } });
  if (validBranches.length !== new Set(branchIds).size) return res.status(400).json({ error: "Invalid branch access" });
  const role = await db.role.upsert({
    where: { organizationId_name: { organizationId, name: "Staff" } },
    update: {},
    create: { organizationId, name: "Staff", permissions: ["parties.write", "products.write", "sales.write", "reports.read"] },
  });
  const user = await db.user.create({
    data: {
      organizationId,
      roleId: role.id,
      name,
      email,
      phone: String(req.body?.phone ?? ""),
      passwordHash: await hash(password, 12),
      branches: { create: branchIds.map((branchId: string) => ({ branchId })) },
    },
    include: { role: true, branches: { include: { branch: true } } },
  });
  await audit(req, "staff.created", "User", user.id, { email, branchIds });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role.name, branches: user.branches.map(x => x.branch) });
});

app.get("/api/sync/status", async (req, res) => {
  const rows = await db.offlineSyncQueue.groupBy({
    by: ["status"],
    where: { organizationId: req.session!.organizationId },
    _count: { _all: true },
  });
  res.json({ online: true, queue: rows.map(x => ({ status: x.status, count: x._count._all })) });
});

app.post("/api/sync/push", async (req, res) => {
  const organizationId = req.session!.organizationId;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const rows = await db.offlineSyncQueue.createMany({
    data: items.slice(0, 500).map((item: any) => ({
      organizationId,
      branchId: item.branchId ? String(item.branchId) : null,
      entityType: String(item.entityType ?? "Unknown"),
      entityId: String(item.entityId ?? randomUUID()),
      operation: String(item.operation ?? "UPSERT"),
      payload: item.payload ?? {},
      status: "SYNCED",
      syncedAt: new Date(),
    })),
  });
  res.json({ ok: true, accepted: rows.count });
});

app.get("/api/settings/invoice", async (req, res) => {
  const setting = await getInvoiceSetting(req.session!.organizationId);
  res.json(setting);
});

app.put("/api/settings/invoice", requirePermission("settings.write"), async (req, res) => {
  const input = parseInput(invoiceSettingInput, req.body);
  const row = await db.invoiceSetting.upsert({
    where: { organizationId: req.session!.organizationId },
    create: { ...input, organizationId: req.session!.organizationId },
    update: input,
  });
  await audit(req, "invoice_setting.updated", "InvoiceSetting", row.id);
  res.json(row);
});

app.get("/api/parties", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const limit = req.query.limit ? Number(req.query.limit) : 50000;
  const organizationId = req.session!.organizationId;
  const branchId = String(req.header("x-branch-id") || "");
  const rows = await db.party.findMany({ where: { organizationId, active: true, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}) }, orderBy: { name: "asc" }, take: limit });
  const partyIds = rows.map(row => row.id);
  const invoiceRows = partyIds.length ? await db.salesInvoice.findMany({
    where: { organizationId, ...(branchId ? { branchId } : {}), partyId: { in: partyIds }, status: "POSTED" },
    select: { partyId: true, grandTotal: true, paidAmount: true },
  }) : [];
  const invoiceDueByParty = new Map<string, number>();
  for (const invoice of invoiceRows) {
    if (!invoice.partyId) continue;
    const due = Math.max(0, Number(invoice.grandTotal) - Number(invoice.paidAmount));
    invoiceDueByParty.set(invoice.partyId, (invoiceDueByParty.get(invoice.partyId) || 0) + due);
  }
  res.json(rows.map(row => {
    const opening = Number(row.openingBalance);
    const salesDue = row.type === "CUSTOMER" ? (invoiceDueByParty.get(row.id) || 0) : 0;
    const balance = Math.round((opening + salesDue) * 100) / 100;
    return { ...row, openingBalance: balance.toFixed(2), outstandingBalance: balance.toFixed(2) };
  }));
});

app.post("/api/parties", requirePermission("parties.write"), async (req, res) => {
  const input = parseInput(partyInput, req.body);
  if (input.phone) {
    const norm = normalizePhone(input.phone);
    if (norm) {
      const existingPhone = await db.party.findFirst({ where: { organizationId: req.session!.organizationId, active: true, phone: norm } });
      if (existingPhone) return res.status(400).json({ error: `Mobile number ${norm} is already registered to customer '${existingPhone.name}'` });
    }
  }
  const row = await db.party.create({ data: { ...input, organizationId: req.session!.organizationId }, });
  await audit(req, "party.created", "Party", row.id); res.status(201).json(row);
});

app.put("/api/parties/:id", requirePermission("parties.write"), async (req, res) => {
  const input = parseInput(partyInput, req.body);
  const partyId = String(req.params.id);
  const existing = await db.party.findFirst({ where: { id: partyId, organizationId: req.session!.organizationId, active: true } });
  if (!existing) return res.status(404).json({ error: "Party not found" });
  const row = await db.party.update({ where: { id: existing.id }, data: input });
  await audit(req, "party.updated", "Party", row.id);
  res.json(row);
});

app.get("/api/parties/:id/ledger", async (req, res) => {
  const organizationId = req.session!.organizationId;
  const branchId = requireBranch(req, res); if (!branchId) return;
  const partyId = String(req.params.id);
  const party = await db.party.findFirst({ where: { id: partyId, organizationId, active: true } });
  if (!party) return res.status(404).json({ error: "Party not found" });
  const invoices = await db.salesInvoice.findMany({
    where: { organizationId, branchId, partyId, status: "POSTED" },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, invoiceNumber: true, invoiceDate: true, grandTotal: true, paidAmount: true, paymentStatus: true },
  });
  const payments = await db.payment.findMany({
    where: { organizationId, branchId, direction: "IN", allocations: { some: { salesInvoice: { partyId } } } },
    orderBy: { paidAt: "desc" },
    include: { allocations: { where: { salesInvoice: { partyId } }, include: { salesInvoice: { select: { id: true, invoiceNumber: true } } } } },
  });
  const creditNotes = await db.creditNote.findMany({
    where: { organizationId, branchId, partyId },
    orderBy: { date: "desc" },
  });
  const invoiceTotal = invoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
  const paidTotal = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
  const creditNoteTotal = creditNotes.reduce((sum, cn) => sum + Number(cn.amount), 0);
  const openingBalance = Number(party.openingBalance);
  const balance = Math.round((openingBalance + Math.max(0, invoiceTotal - paidTotal - creditNoteTotal)) * 100) / 100;
  res.json({
    party,
    openingBalance,
    invoiceTotal,
    paidTotal,
    creditNoteTotal,
    balance,
    invoices: invoices.map(inv => ({
      ...inv,
      grandTotal: Number(inv.grandTotal),
      paidAmount: Number(inv.paidAmount),
      balance: Math.max(0, Number(inv.grandTotal) - Number(inv.paidAmount)),
    })),
    payments: payments.map(payment => ({
      id: payment.id,
      mode: payment.mode,
      amount: Number(payment.amount),
      reference: payment.reference,
      paidAt: payment.paidAt,
      allocations: payment.allocations.map(allocation => ({
        invoiceId: allocation.salesInvoiceId,
        invoiceNumber: allocation.salesInvoice.invoiceNumber,
        amount: Number(allocation.amount),
      })),
    })),
    creditNotes: creditNotes.map(cn => ({
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      date: cn.date,
      amount: Number(cn.amount),
    })),
  });
});

app.post("/api/parties/import", requirePermission("parties.write"), async (req, res) => {
  const organizationId = req.session!.organizationId;
  const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
  if (!contacts.length) return res.status(400).json({ error: "No contacts found to import" });
  if (contacts.length > 20000) return res.status(400).json({ error: "Maximum 20,000 contacts allowed per import" });
  const existing = await db.party.findMany({ where: { organizationId, active: true, phone: { not: null } }, select: { phone: true } });
  const existingPhones = new Set(existing.map(row => normalizePhone(row.phone)).filter(Boolean));
  const seen = new Set<string>();
  let invalid = 0; let duplicateInFile = 0; let duplicateInDb = 0;
  const rows: Prisma.PartyCreateManyInput[] = [];
  for (const raw of contacts) {
    const phone = normalizePhone(String(raw?.phone ?? raw?.mobile ?? raw?.Mobile ?? raw?.Phone ?? ""));
    const name = String(raw?.name ?? raw?.Name ?? raw?.["Given Name"] ?? raw?.["Full Name"] ?? raw?.phone ?? "").trim();
    if (!phone || !name) { invalid++; continue; }
    if (seen.has(phone)) { duplicateInFile++; continue; }
    seen.add(phone);
    if (existingPhones.has(phone)) { duplicateInDb++; continue; }
    rows.push({
      organizationId, type: "CUSTOMER", name: name.slice(0, 120), phone,
      email: String(raw?.email ?? raw?.Email ?? raw?.["E-mail 1 - Value"] ?? "").trim() || undefined,
      address: String(raw?.address ?? raw?.Address ?? raw?.["Address 1 - Formatted"] ?? "").trim() || undefined,
    });
  }
  for (let index = 0; index < rows.length; index += 1000) await db.party.createMany({ data: rows.slice(index, index + 1000) });
  await audit(req, "party.imported", "Party", organizationId, { imported: rows.length, invalid, duplicateInFile, duplicateInDb });
  res.json({ imported: rows.length, skipped: invalid + duplicateInFile + duplicateInDb, invalid, duplicateInFile, duplicateInDb });
});

app.get("/api/products", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const search = String(req.query.search ?? "").trim();
  const limit = req.query.limit ? Number(req.query.limit) : 50000;
  const rows = await db.productVariant.findMany({ where: { active: true, product: { organizationId: req.session!.organizationId, active: true, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { variants: { some: { OR: [{ sku: { contains: search, mode: "insensitive" } }, { barcode: search }] } } }] } : {}) } }, include: { product: { include: { taxRate: true } }, balances: { where: { branchId } } }, take: limit });
  res.json(rows);
});

app.post("/api/products", requirePermission("products.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = parseInput(productInput, req.body);
  const row = await db.$transaction(async tx => {
    const tax = await tx.taxRate.upsert({ where: { organizationId_rate: { organizationId: req.session!.organizationId, rate: new Prisma.Decimal(input.taxRate) } }, create: { organizationId: req.session!.organizationId, name: `GST ${input.taxRate}%`, rate: input.taxRate }, update: {} });
    const product = await tx.product.create({ data: { organizationId: req.session!.organizationId, name: input.name, category: input.category, brand: input.brand, hsnCode: input.hsnCode, taxRateId: tax.id, variants: { create: { sku: input.sku, barcode: input.barcode, size: input.size, color: input.color, purchasePrice: input.purchasePrice, sellingPrice: input.sellingPrice, mrp: input.mrp } } }, include: { variants: true } });
    const variant = product.variants[0];
    if (input.openingStock > 0) { await tx.stockBalance.create({ data: { branchId, variantId: variant.id, quantity: input.openingStock } }); await tx.stockMovement.create({ data: { branchId, variantId: variant.id, type: "OPENING", quantity: input.openingStock, unitCost: input.purchasePrice, referenceType: "Product", referenceId: product.id } }); }
    return product;
  });
  await audit(req, "product.created", "Product", row.id); res.status(201).json(row);
});

app.post("/api/purchases/stock-receipt", requirePermission("products.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = parseInput(purchaseStockInput, req.body);
  const organizationId = req.session!.organizationId;
  const variants = await db.productVariant.findMany({
    where: { id: { in: input.lines.map(x => x.variantId) }, product: { organizationId } },
    include: { product: true },
  });
  if (variants.length !== new Set(input.lines.map(x => x.variantId)).size) return res.status(400).json({ error: "One or more purchase items are invalid" });
  const result = await db.$transaction(async tx => {
    for (const line of input.lines) {
      const variant = variants.find(v => v.id === line.variantId)!;
      await tx.stockBalance.upsert({
        where: { branchId_variantId: { branchId, variantId: line.variantId } },
        create: { branchId, variantId: line.variantId, quantity: line.quantity },
        update: { quantity: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          branchId,
          variantId: line.variantId,
          type: "PURCHASE",
          quantity: line.quantity,
          unitCost: line.unitCost,
          referenceType: "PurchaseInvoice",
          referenceId: input.purchaseNumber,
        },
      });
      await audit(req, "purchase.stock_added", "ProductVariant", variant.id, {
        purchaseNumber: input.purchaseNumber,
        partyName: input.partyName,
        itemName: variant.product.name,
        quantity: line.quantity,
      });
    }
    return { ok: true, purchaseNumber: input.purchaseNumber, lines: input.lines.length };
  });
  res.status(201).json(result);
});

app.delete("/api/purchases/stock-receipt/:purchaseNumber", requirePermission("products.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const purchaseNumber = decodeURIComponent(String(req.params.purchaseNumber || ""));
  const movements = await db.stockMovement.findMany({
    where: { branchId, referenceType: "PurchaseInvoice", referenceId: purchaseNumber, type: "PURCHASE" },
    include: { variant: { include: { product: true } } },
  });
  if (!movements.length) return res.status(404).json({ error: "Purchase stock receipt not found" });
  await db.$transaction(async tx => {
    for (const move of movements) {
      const qty = Number(move.quantity);
      const balance = await tx.stockBalance.findUnique({ where: { branchId_variantId: { branchId, variantId: move.variantId } } });
      if (Number(balance?.quantity ?? 0) < qty) throw new Error(`Insufficient stock to delete purchase for ${move.variant.sku}`);
      await tx.stockBalance.update({ where: { branchId_variantId: { branchId, variantId: move.variantId } }, data: { quantity: { decrement: qty } } });
      await tx.stockMovement.create({ data: { branchId, variantId: move.variantId, type: "ADJUSTMENT_OUT", quantity: -qty, unitCost: move.unitCost, referenceType: "PurchaseInvoiceDelete", referenceId: purchaseNumber } });
    }
    await tx.stockMovement.deleteMany({ where: { branchId, referenceType: "PurchaseInvoice", referenceId: purchaseNumber, type: "PURCHASE" } });
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "purchase.deleted", entityType: "PurchaseInvoice", entityId: purchaseNumber, metadata: { purchaseNumber } } });
  });
  res.json({ ok: true, purchaseNumber });
});

app.get("/api/sales", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const limit = req.query.limit ? Number(req.query.limit) : 50000;
  const rows = await db.salesInvoice.findMany({ where: { organizationId: req.session!.organizationId, branchId }, include: { party: true, lines: { include: { variant: true } } }, orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }], take: limit });
  res.json(rows);
});

app.get("/api/sales/next-number", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const invoiceDate = req.query.invoiceDate ? new Date(String(req.query.invoiceDate)) : new Date();
  const fy = financialYear(invoiceDate);
  const setting = await getInvoiceSetting(organizationId);
  const sequence = await db.documentSequence.findUnique({ where: { organizationId_branchId_documentType_financialYear: { organizationId, branchId, documentType: "SALES", financialYear: fy } } });
  const nextNumber = sequence?.nextNumber ?? 1;
  res.json({ prefix: `${setting.invoicePrefix}/${fy}/`, number: nextNumber, invoiceNumber: `${setting.invoicePrefix}/${fy}/${nextNumber}`, financialYear: fy });
});

app.get("/api/sales/:id", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const row = await db.salesInvoice.findFirst({
    where: { id: String(req.params.id), organizationId: req.session!.organizationId, branchId },
    include: { party: true, lines: { orderBy: { id: "asc" }, include: { variant: true } }, payments: { include: { payment: true } } },
  });
  if (!row) return res.status(404).json({ error: "Sales invoice not found" });
  res.json(row);
});

app.get("/api/sales/:id/history", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const events = await db.auditEvent.findMany({
    where: { entityId: String(req.params.id), entityType: "SALES_INVOICE", organizationId: req.session!.organizationId },
    orderBy: { occurredAt: "desc" },
    include: { actor: { select: { name: true } } }
  });
  res.json(events);
});

app.post("/api/sales", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = parseInput(invoiceInput, req.body); const organizationId = req.session!.organizationId;
  const existing = await db.salesInvoice.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return res.json(existing);
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const variants = await db.productVariant.findMany({ where: { id: { in: input.lines.map(x => x.variantId) }, product: { organizationId } }, include: { product: { include: { taxRate: true } }, balances: { where: { branchId } } } });
  if (variants.length !== new Set(input.lines.map(x => x.variantId)).size) return res.status(400).json({ error: "One or more variants are invalid" });
  const isInterState = input.placeOfSupply !== organization.stateCode;
  const lineBaseBeforeInvoiceDiscount = input.lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - line.discount), 0);
  const calculated = input.lines.map(line => {
    const v = variants.find(x => x.id === line.variantId)!;
    const baseTaxable = round2(Math.max(0, line.quantity * line.unitPrice - line.discount));
    const invoiceDiscountShare = lineBaseBeforeInvoiceDiscount > 0 ? input.invoiceDiscount * (baseTaxable / lineBaseBeforeInvoiceDiscount) : 0;
    const taxable = round2(Math.max(0, baseTaxable - invoiceDiscountShare));
    const rate = Number(line.taxRate ?? v.product.taxRate.rate);
    const tax = round2(taxable * rate / 100);
    return { input: line, v, taxable, rate, cgst: isInterState ? 0 : round2(tax / 2), sgst: isInterState ? 0 : round2(tax / 2), igst: isInterState ? tax : 0, total: round2(taxable + tax) };
  });
  const lineSubtotal = round2(calculated.reduce((s, x) => s + x.input.quantity * x.input.unitPrice, 0));
  const lineDiscount = round2(calculated.reduce((s, x) => s + x.input.discount, 0));
  const lineTaxable = round2(calculated.reduce((s, x) => s + x.taxable, 0));
  const grandTotal = Math.max(0, round2(calculated.reduce((s, x) => s + x.total, 0) + input.additionalCharges));
  const row = await db.$transaction(async tx => {
    for (const line of calculated) { const stock = Number(line.v.balances[0]?.quantity ?? 0); if (stock < line.input.quantity) throw new Error(`Insufficient stock for ${line.v.sku}`); }
    const setting = await tx.invoiceSetting.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
    const fy = financialYear(input.invoiceDate); const sequence = await tx.documentSequence.upsert({ where: { organizationId_branchId_documentType_financialYear: { organizationId, branchId, documentType: "SALES", financialYear: fy } }, create: { organizationId, branchId, documentType: "SALES", financialYear: fy, prefix: `${setting.invoicePrefix}/${fy}/`, nextNumber: 2 }, update: { nextNumber: { increment: 1 } } });
    const number = `${sequence.prefix}${sequence.nextNumber - 1}`;
    const invoice = await tx.salesInvoice.create({ data: { organizationId, branchId, partyId: input.partyId, invoiceNumber: number, invoiceDate: input.invoiceDate, status: "POSTED", paymentStatus: paymentStatus(input.paidAmount, grandTotal), placeOfSupply: input.placeOfSupply, subtotal: lineSubtotal, discountTotal: round2(lineDiscount + input.invoiceDiscount), invoiceDiscount: input.invoiceDiscount, additionalCharges: input.additionalCharges, taxableTotal: lineTaxable, cgstTotal: calculated.reduce((s,x)=>s+x.cgst,0), sgstTotal: calculated.reduce((s,x)=>s+x.sgst,0), igstTotal: calculated.reduce((s,x)=>s+x.igst,0), grandTotal, paidAmount: Math.min(input.paidAmount, grandTotal), notes: input.notes, idempotencyKey: input.idempotencyKey, postedAt: new Date(), lines: { create: calculated.map(x => ({ variantId: x.v.id, itemName: x.v.product.name, sku: x.v.sku, hsnCode: x.v.product.hsnCode ?? "", quantity: x.input.quantity, unitPrice: x.input.unitPrice, purchasePriceAtSale: x.v.purchasePrice, totalCostAtSale: Number(x.v.purchasePrice) * x.input.quantity, discount: x.input.discount, taxableAmount: x.taxable, taxRate: x.rate, cgst: x.cgst, sgst: x.sgst, igst: x.igst, total: x.total })) } } });
    for (const x of calculated) { await tx.stockBalance.update({ where: { branchId_variantId: { branchId, variantId: x.v.id } }, data: { quantity: { decrement: x.input.quantity } } }); await tx.stockMovement.create({ data: { branchId, variantId: x.v.id, type: "SALE", quantity: -x.input.quantity, referenceType: "SalesInvoice", referenceId: invoice.id } }); }
    if (input.paidAmount > 0) { const payment = await tx.payment.create({ data: { organizationId, branchId, direction: "IN", mode: input.paymentMode, amount: Math.min(input.paidAmount, grandTotal) } }); await tx.paymentAllocation.create({ data: { paymentId: payment.id, salesInvoiceId: invoice.id, amount: Math.min(input.paidAmount, grandTotal) } }); }
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "sales.posted", entityType: "SalesInvoice", entityId: invoice.id, metadata: { invoiceNumber: number } } }); return invoice;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json(row);
});

app.put("/api/sales/:id", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = parseInput(invoiceInput, { ...req.body, idempotencyKey: String(req.body?.idempotencyKey || `edit-${req.params.id}`) });
  const organizationId = req.session!.organizationId;
  const invoiceId = String(req.params.id || "");
  const oldInvoice = await db.salesInvoice.findFirst({
    where: { id: invoiceId, organizationId, branchId },
    include: { lines: true, payments: true },
  });
  if (!oldInvoice) return res.status(404).json({ error: "Sales invoice not found" });
  if (oldInvoice.status === "CANCELLED") return res.status(400).json({ error: "Cancelled invoice cannot be edited" });

  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const variants = await db.productVariant.findMany({ where: { id: { in: input.lines.map(x => x.variantId) }, product: { organizationId } }, include: { product: { include: { taxRate: true } } } });
  if (variants.length !== new Set(input.lines.map(x => x.variantId)).size) return res.status(400).json({ error: "One or more variants are invalid" });
  const isInterState = input.placeOfSupply !== organization.stateCode;
  const lineBaseBeforeInvoiceDiscount = input.lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - line.discount), 0);
  const calculated = input.lines.map(line => {
    const v = variants.find(x => x.id === line.variantId)!;
    const baseTaxable = round2(Math.max(0, line.quantity * line.unitPrice - line.discount));
    const invoiceDiscountShare = lineBaseBeforeInvoiceDiscount > 0 ? input.invoiceDiscount * (baseTaxable / lineBaseBeforeInvoiceDiscount) : 0;
    const taxable = round2(Math.max(0, baseTaxable - invoiceDiscountShare));
    const rate = Number(line.taxRate ?? v.product.taxRate.rate);
    const tax = round2(taxable * rate / 100);
    return { input: line, v, taxable, rate, cgst: isInterState ? 0 : round2(tax / 2), sgst: isInterState ? 0 : round2(tax / 2), igst: isInterState ? tax : 0, total: round2(taxable + tax) };
  });
  const lineSubtotal = round2(calculated.reduce((s, x) => s + x.input.quantity * x.input.unitPrice, 0));
  const lineDiscount = round2(calculated.reduce((s, x) => s + x.input.discount, 0));
  const lineTaxable = round2(calculated.reduce((s, x) => s + x.taxable, 0));
  const grandTotal = Math.max(0, round2(calculated.reduce((s, x) => s + x.total, 0) + input.additionalCharges));

  const existingPaymentTotal = oldInvoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  if (grandTotal < existingPaymentTotal) {
    return res.status(400).json({ error: `Edited total (${grandTotal}) cannot be less than already received amount (${existingPaymentTotal}). Please issue a refund or credit note.` });
  }
  const newlyReceived = Math.max(0, input.paidAmount - existingPaymentTotal);
  const finalPaidAmount = Math.min(grandTotal, existingPaymentTotal + newlyReceived);

  await db.$transaction(async tx => {
    for (const line of oldInvoice.lines) {
      const qty = Number(line.quantity);
      await tx.stockBalance.upsert({
        where: { branchId_variantId: { branchId, variantId: line.variantId } },
        update: { quantity: { increment: qty } },
        create: { branchId, variantId: line.variantId, quantity: qty },
      });
    }

    for (const line of calculated) {
      const balance = await tx.stockBalance.findUnique({ where: { branchId_variantId: { branchId, variantId: line.v.id } } });
      const stock = Number(balance?.quantity ?? 0);
      if (stock < line.input.quantity) throw new Error(`Insufficient stock for ${line.v.sku}`);
    }

    // Do NOT delete existing payment allocations to preserve history.
    await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: oldInvoice.id } });
    await tx.stockMovement.deleteMany({ where: { branchId, referenceType: "SalesInvoice", referenceId: oldInvoice.id, type: "SALE" } });

    await tx.salesInvoice.update({
      where: { id: oldInvoice.id },
      data: {
        partyId: input.partyId,
        invoiceDate: input.invoiceDate,
        paymentStatus: paymentStatus(input.paidAmount, grandTotal),
        placeOfSupply: input.placeOfSupply,
        subtotal: lineSubtotal,
        discountTotal: round2(lineDiscount + input.invoiceDiscount),
        invoiceDiscount: input.invoiceDiscount,
        additionalCharges: input.additionalCharges,
        taxableTotal: lineTaxable,
        cgstTotal: calculated.reduce((s, x) => s + x.cgst, 0),
        sgstTotal: calculated.reduce((s, x) => s + x.sgst, 0),
        igstTotal: calculated.reduce((s, x) => s + x.igst, 0),
        grandTotal,
        paidAmount: finalPaidAmount,
        notes: input.notes,
        lines: { create: calculated.map(x => ({ variantId: x.v.id, itemName: x.v.product.name, sku: x.v.sku, hsnCode: x.v.product.hsnCode ?? "", quantity: x.input.quantity, unitPrice: x.input.unitPrice, purchasePriceAtSale: x.v.purchasePrice, totalCostAtSale: Number(x.v.purchasePrice) * x.input.quantity, discount: x.input.discount, taxableAmount: x.taxable, taxRate: x.rate, cgst: x.cgst, sgst: x.sgst, igst: x.igst, total: x.total })) },
      },
    });
    for (const x of calculated) {
      await tx.stockBalance.update({ where: { branchId_variantId: { branchId, variantId: x.v.id } }, data: { quantity: { decrement: x.input.quantity } } });
      await tx.stockMovement.create({ data: { branchId, variantId: x.v.id, type: "SALE", quantity: -x.input.quantity, referenceType: "SalesInvoice", referenceId: oldInvoice.id } });
    }
    if (newlyReceived > 0) {
      const payment = await tx.payment.create({ data: { organizationId, branchId, direction: "IN", mode: input.paymentMode, amount: newlyReceived } });
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, salesInvoiceId: oldInvoice.id, amount: newlyReceived } });
    }
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "sales.updated", entityType: "SalesInvoice", entityId: oldInvoice.id, metadata: { invoiceNumber: oldInvoice.invoiceNumber } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const rows = await db.salesInvoice.findMany({ where: { organizationId, branchId }, include: { party: true, lines: { include: { variant: true } } }, orderBy: { invoiceDate: "desc" }, take: 50000 });
  res.json(rows);
});

app.delete("/api/sales/:id", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const id = String(req.params.id || "");
  const invoice = await db.salesInvoice.findFirst({
    where: { id, organizationId, branchId },
    include: { lines: true, payments: true },
  });
  if (!invoice) return res.status(404).json({ error: "Sales invoice not found" });
  await db.$transaction(async tx => {
    for (const line of invoice.lines) {
      const qty = Number(line.quantity);
      await tx.stockBalance.upsert({
        where: { branchId_variantId: { branchId, variantId: line.variantId } },
        update: { quantity: { increment: qty } },
        create: { branchId, variantId: line.variantId, quantity: qty },
      });
      await tx.stockMovement.create({ data: { branchId, variantId: line.variantId, type: "ADJUSTMENT_IN", quantity: qty, referenceType: "SalesInvoiceDelete", referenceId: invoice.id } });
    }
    const paymentIds = invoice.payments.map(x => x.paymentId);
    await tx.paymentAllocation.deleteMany({ where: { salesInvoiceId: invoice.id } });
    for (const paymentId of paymentIds) {
      const remaining = await tx.paymentAllocation.count({ where: { paymentId } });
      if (remaining === 0) await tx.payment.delete({ where: { id: paymentId } });
    }
    await tx.stockMovement.deleteMany({ where: { branchId, referenceType: "SalesInvoice", referenceId: invoice.id, type: "SALE" } });
    await tx.salesInvoice.delete({ where: { id: invoice.id } });
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "sales.deleted", entityType: "SalesInvoice", entityId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber } } });
  });
  res.json({ ok: true, id });
});

app.post("/api/sales/:id/cancel", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const id = String(req.params.id || "");
  const invoice = await db.salesInvoice.findFirst({
    where: { id, organizationId, branchId },
    include: { lines: true, payments: true },
  });
  if (!invoice) return res.status(404).json({ error: "Sales invoice not found" });
  if (invoice.status === "CANCELLED") return res.json(invoice);
  await db.$transaction(async tx => {
    for (const line of invoice.lines) {
      const qty = Number(line.quantity);
      await tx.stockBalance.upsert({
        where: { branchId_variantId: { branchId, variantId: line.variantId } },
        update: { quantity: { increment: qty } },
        create: { branchId, variantId: line.variantId, quantity: qty },
      });
      await tx.stockMovement.create({ data: { branchId, variantId: line.variantId, type: "ADJUSTMENT_IN", quantity: qty, referenceType: "SalesInvoiceCancel", referenceId: invoice.id } });
    }
    await tx.salesInvoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED" } });
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "sales.cancelled", entityType: "SalesInvoice", entityId: invoice.id, metadata: { invoiceNumber: invoice.invoiceNumber } } });
  });
  const rows = await db.salesInvoice.findMany({ where: { organizationId, branchId }, include: { party: true, lines: { include: { variant: true } } }, orderBy: { invoiceDate: "desc" }, take: 50000 });
  res.json(rows);
});

app.get("/api/payments/in", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const rows = await db.payment.findMany({
    where: { organizationId: req.session!.organizationId, branchId, direction: "IN", reference: { contains: "\"paymentNumber\"" } },
    include: { allocations: { include: { salesInvoice: { include: { party: true } } } } },
    orderBy: { paidAt: "desc" },
    take: 50000,
  });
  res.json(rows);
});

app.get("/api/payments/in/next-number", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const paidAt = req.query.paidAt ? new Date(String(req.query.paidAt)) : new Date();
  const fy = financialYear(paidAt);
  const count = await db.payment.count({
    where: {
      organizationId: req.session!.organizationId,
      branchId,
      direction: "IN",
      reference: { contains: "\"paymentNumber\"" },
      paidAt: {
        gte: new Date(paidAt.getMonth() >= 3 ? paidAt.getFullYear() : paidAt.getFullYear() - 1, 3, 1),
        lt: new Date(paidAt.getMonth() >= 3 ? paidAt.getFullYear() + 1 : paidAt.getFullYear(), 3, 1),
      },
    },
  });
  const prefix = `HB/PI/${fy}/`;
  const number = count + 1;
  res.json({ prefix, number, paymentNumber: `${prefix}${number}`, financialYear: fy });
});

app.post("/api/payments/in", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const amount = Number(req.body?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Amount must be greater than zero" });
  const organizationId = req.session!.organizationId;
  const allocations = Array.isArray(req.body?.allocations) ? req.body.allocations : [];
  const reference = JSON.stringify({
    paymentNumber: String(req.body?.paymentNumber ?? ""),
    prefix: String(req.body?.prefix ?? ""),
    number: String(req.body?.number ?? ""),
    partyName: String(req.body?.partyName ?? ""),
    partyPhone: String(req.body?.partyPhone ?? ""),
    discount: Number(req.body?.discount ?? 0),
    notes: String(req.body?.reference ?? req.body?.notes ?? "").trim(),
  });
  const row = await db.$transaction(async tx => {
    const payment = await tx.payment.create({
      data: {
        organizationId,
        branchId,
        direction: "IN",
        mode: String(req.body?.mode ?? "Cash"),
        amount,
        reference,
        paidAt: req.body?.paidAt ? new Date(String(req.body.paidAt)) : new Date(),
      },
    });
    for (const raw of allocations) {
      const salesInvoiceId = String(raw?.salesInvoiceId ?? "");
      const allocationAmount = Number(raw?.amount ?? 0);
      if (!salesInvoiceId || !Number.isFinite(allocationAmount) || allocationAmount <= 0) continue;
      const invoice = await tx.salesInvoice.findFirst({ where: { id: salesInvoiceId, organizationId, branchId } });
      if (!invoice) continue;
      const safeAmount = Math.min(allocationAmount, Number(invoice.grandTotal) - Number(invoice.paidAmount));
      if (safeAmount <= 0) continue;
      const nextPaid = Number(invoice.paidAmount) + safeAmount;
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, salesInvoiceId, amount: safeAmount } });
      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount: nextPaid, paymentStatus: paymentStatus(nextPaid, Number(invoice.grandTotal)) },
      });
    }
    return tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { allocations: { include: { salesInvoice: { include: { party: true } } } } },
    });
  });
  await audit(req, "payment_in.created", "Payment", row.id, { amount, mode: row.mode });
  res.status(201).json(row);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: "Validation failed", details: error.issues });
  console.error(error); res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
});
const creditNoteInput = z.object({
  partyId: z.string(),
  salesInvoiceId: z.string(),
  date: z.coerce.date(),
  amount: z.number().min(0),
  notes: z.string().optional(),
  lines: z.array(z.object({
    variantId: z.string(),
    itemName: z.string(),
    quantity: z.number().min(0),
    unitPrice: z.number().min(0),
    taxRate: z.number().min(0),
    total: z.number().min(0)
  }))
});

app.post("/api/credit-notes", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const organizationId = req.session!.organizationId;
  const input = parseInput(creditNoteInput, req.body);
  
  const inv = await db.salesInvoice.findFirst({ where: { id: input.salesInvoiceId, organizationId }});
  if (!inv) return res.status(404).json({ error: "Original invoice not found" });

  const num = await generateNextDocumentNumber(organizationId, branchId, "CN");
  const creditNote = await db.$transaction(async tx => {
    const cn = await tx.creditNote.create({
      data: {
        organizationId,
        branchId,
        partyId: input.partyId,
        salesInvoiceId: input.salesInvoiceId,
        creditNoteNumber: num,
        date: input.date,
        amount: input.amount,
        notes: input.notes,
        lines: {
          create: input.lines.map(line => ({
            variantId: line.variantId,
            itemName: line.itemName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            total: line.total
          }))
        }
      }
    });

    for (const line of input.lines) {
      if (line.quantity > 0) {
        await tx.stockBalance.upsert({
          where: { branchId_variantId: { branchId, variantId: line.variantId } },
          update: { quantity: { increment: line.quantity } },
          create: { branchId, variantId: line.variantId, quantity: line.quantity },
        });
        await tx.stockMovement.create({
          data: {
            branchId,
            variantId: line.variantId,
            type: "ADJUSTMENT_IN",
            quantity: line.quantity,
            referenceType: "CreditNote",
            referenceId: cn.id
          }
        });
      }
    }
    
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "creditnote.created", entityType: "CreditNote", entityId: cn.id, metadata: { creditNoteNumber: num } } });
    return cn;
  });

  res.json(creditNote);
});

function round2(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function financialYear(date: Date) { const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1; return `${String(year).slice(-2)}-${String(year + 1).slice(-2)}`; }
function paymentStatus(paid: number, total: number): PaymentStatus { return paid <= 0 ? "UNPAID" : paid >= total ? "PAID" : "PARTIALLY_PAID"; }
function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 7) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}
async function audit(req: express.Request, action: string, entityType: string, entityId: string, metadata?: Prisma.InputJsonValue) { await db.auditEvent.create({ data: { organizationId: req.session!.organizationId, actorId: req.session!.userId, action, entityType, entityId, metadata } }); }
async function getInvoiceSetting(organizationId: string) { return db.invoiceSetting.upsert({ where: { organizationId }, create: { organizationId }, update: {} }); }

const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));
app.use((req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
  res.sendFile(path.join(distPath, "index.html"));
});

const port = Number(process.env.PORT || env.API_PORT || 4000);
app.listen(port, "0.0.0.0", () => {
  console.log(`Happy Bonding API running on 0.0.0.0:${port}`);
  import("child_process").then(({ exec }) => {
    exec("npx prisma db push && tsx prisma/seed.ts", (err, stdout) => {
      if (err) console.error("Auto DB push/seed warning:", err.message);
      else console.log("Auto DB push & seed result:", stdout);
    });
  });
});
