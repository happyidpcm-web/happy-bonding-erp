import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { compare } from "bcryptjs";
import { Prisma, PaymentStatus } from "@prisma/client";
import { ZodError } from "zod";
import { db } from "./db.js";
import { createToken, requireAuth, requireBranch, requirePermission } from "./auth.js";
import { env } from "./env.js";
import { invoiceInput, invoiceSettingInput, loginInput, parseInput, partyInput, productInput } from "./validation.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: ["http://localhost:5173"], credentials: false }));
app.use(express.json({ limit: "25mb" }));

app.get("/", (_req, res) => res.json({ ok: true, service: "happy-bonding-api", health: "/api/health" }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "happy-bonding-api" }));

app.post("/api/auth/login", async (req, res) => {
  const input = parseInput(loginInput, req.body);
  const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { role: true, branches: true } });
  if (!user || !user.active || !(await compare(input.password, user.passwordHash))) return res.status(401).json({ error: "Invalid email or password" });
  const session = { userId: user.id, organizationId: user.organizationId, branchIds: user.branches.map(x => x.branchId), permissions: user.role.permissions, tokenVersion: user.tokenVersion };
  res.json({ token: await createToken(session), user: { id: user.id, name: user.name, email: user.email }, branchIds: session.branchIds });
});

app.use("/api", requireAuth);

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
  const rows = await db.party.findMany({ where: { organizationId: req.session!.organizationId, active: true, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { phone: { contains: search } }] } : {}) }, orderBy: { name: "asc" }, take: limit });
  res.json(rows);
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

app.get("/api/sales", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const limit = req.query.limit ? Number(req.query.limit) : 50000;
  const rows = await db.salesInvoice.findMany({ where: { organizationId: req.session!.organizationId, branchId }, include: { party: true, lines: true }, orderBy: { invoiceDate: "desc" }, take: limit });
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

app.post("/api/sales", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const input = parseInput(invoiceInput, req.body); const organizationId = req.session!.organizationId;
  const existing = await db.salesInvoice.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: input.idempotencyKey } } });
  if (existing) return res.json(existing);
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const variants = await db.productVariant.findMany({ where: { id: { in: input.lines.map(x => x.variantId) }, product: { organizationId } }, include: { product: { include: { taxRate: true } }, balances: { where: { branchId } } } });
  if (variants.length !== new Set(input.lines.map(x => x.variantId)).size) return res.status(400).json({ error: "One or more variants are invalid" });
  const isInterState = input.placeOfSupply !== organization.stateCode;
  const calculated = input.lines.map(line => { const v = variants.find(x => x.id === line.variantId)!; const taxable = round2(line.quantity * line.unitPrice - line.discount); const rate = Number(v.product.taxRate.rate); const tax = round2(taxable * rate / 100); return { input: line, v, taxable, rate, cgst: isInterState ? 0 : round2(tax / 2), sgst: isInterState ? 0 : round2(tax / 2), igst: isInterState ? tax : 0, total: round2(taxable + tax) }; });
  const lineSubtotal = round2(calculated.reduce((s, x) => s + x.input.quantity * x.input.unitPrice, 0));
  const lineDiscount = round2(calculated.reduce((s, x) => s + x.input.discount, 0));
  const lineTaxable = round2(calculated.reduce((s, x) => s + x.taxable, 0));
  const grandTotal = Math.max(0, round2(calculated.reduce((s, x) => s + x.total, 0) - input.invoiceDiscount + input.additionalCharges));
  const row = await db.$transaction(async tx => {
    for (const line of calculated) { const stock = Number(line.v.balances[0]?.quantity ?? 0); if (stock < line.input.quantity) throw new Error(`Insufficient stock for ${line.v.sku}`); }
    const setting = await tx.invoiceSetting.upsert({ where: { organizationId }, create: { organizationId }, update: {} });
    const fy = financialYear(input.invoiceDate); const sequence = await tx.documentSequence.upsert({ where: { organizationId_branchId_documentType_financialYear: { organizationId, branchId, documentType: "SALES", financialYear: fy } }, create: { organizationId, branchId, documentType: "SALES", financialYear: fy, prefix: `${setting.invoicePrefix}/${fy}/`, nextNumber: 2 }, update: { nextNumber: { increment: 1 } } });
    const number = `${sequence.prefix}${sequence.nextNumber - 1}`;
    const invoice = await tx.salesInvoice.create({ data: { organizationId, branchId, partyId: input.partyId, invoiceNumber: number, invoiceDate: input.invoiceDate, status: "POSTED", paymentStatus: paymentStatus(input.paidAmount, grandTotal), placeOfSupply: input.placeOfSupply, subtotal: lineSubtotal, discountTotal: round2(lineDiscount + input.invoiceDiscount), invoiceDiscount: input.invoiceDiscount, additionalCharges: input.additionalCharges, taxableTotal: Math.max(0, round2(lineTaxable - input.invoiceDiscount)), cgstTotal: calculated.reduce((s,x)=>s+x.cgst,0), sgstTotal: calculated.reduce((s,x)=>s+x.sgst,0), igstTotal: calculated.reduce((s,x)=>s+x.igst,0), grandTotal, paidAmount: Math.min(input.paidAmount, grandTotal), notes: input.notes, idempotencyKey: input.idempotencyKey, postedAt: new Date(), lines: { create: calculated.map(x => ({ variantId: x.v.id, itemName: x.v.product.name, sku: x.v.sku, hsnCode: x.v.product.hsnCode, quantity: x.input.quantity, unitPrice: x.input.unitPrice, discount: x.input.discount, taxableAmount: x.taxable, taxRate: x.rate, cgst: x.cgst, sgst: x.sgst, igst: x.igst, total: x.total })) } } });
    for (const x of calculated) { await tx.stockBalance.update({ where: { branchId_variantId: { branchId, variantId: x.v.id } }, data: { quantity: { decrement: x.input.quantity } } }); await tx.stockMovement.create({ data: { branchId, variantId: x.v.id, type: "SALE", quantity: -x.input.quantity, referenceType: "SalesInvoice", referenceId: invoice.id } }); }
    if (input.paidAmount > 0) { const payment = await tx.payment.create({ data: { organizationId, branchId, direction: "IN", mode: input.paymentMode, amount: Math.min(input.paidAmount, grandTotal) } }); await tx.paymentAllocation.create({ data: { paymentId: payment.id, salesInvoiceId: invoice.id, amount: Math.min(input.paidAmount, grandTotal) } }); }
    await tx.auditEvent.create({ data: { organizationId, actorId: req.session!.userId, action: "sales.posted", entityType: "SalesInvoice", entityId: invoice.id, metadata: { invoiceNumber: number } } }); return invoice;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  res.status(201).json(row);
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: "Validation failed", details: error.issues });
  console.error(error); res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
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
app.get("*", (req, res) => {
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
