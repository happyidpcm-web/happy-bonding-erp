import {readFileSync,writeFileSync} from 'node:fs';
let s=readFileSync('server/index.ts','utf8');
const start=s.indexOf('async function ensureAdminUser()');
const end=s.indexOf('app.post("/api/auth/login"',start);
s=s.slice(0,start)+s.slice(end);
s=s.replace('  await ensureAdminUser();\r\n','').replace('  await ensureAdminUser();\n','');
s=s.replace(/  if \(!user\) \{[\s\S]*?\n  \}/,'');
s=s.replace('where: { organizationId: user.organizationId },','where: { organizationId: user.organizationId, active: true },');
s=s.replace('user.branches.map(x => x.branchId);','user.branches.map(x => x.branchId).filter(id => allBranches.some(b => b.id === id));');
s=s.replace('app.use("/api/vouchers", voucherRouter);',`app.use("/api", (req, res, next) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  req.headers["x-branch-id"] = branchId;
  next();
});
app.get("/api/auth/me", async (req, res) => {
  const user = await db.user.findUniqueOrThrow({ where: { id: req.session!.userId }, select: { id: true, name: true, email: true } });
  res.json({ ...user, isAdmin: req.session!.permissions.includes("*"), branchIds: req.session!.branchIds });
});
app.use("/api/vouchers", voucherRouter);`);
s=s.replace('organizationId: req.session!.organizationId,\n      ...(isOwner','organizationId: req.session!.organizationId, active: true,\n      ...(isOwner').replace('organizationId: req.session!.organizationId,\r\n      ...(isOwner','organizationId: req.session!.organizationId, active: true,\r\n      ...(isOwner');
// Branch and credential administration is owner-only.
s=s.replaceAll('requirePermission("settings.write")','requirePermission("*")');
s=s.replace('app.get("/api/owner/summary", requirePermission("reports.read")','app.get("/api/owner/summary", requirePermission("*")');
s=s.replace('db.branch.findMany({ where: { organizationId }, orderBy:', 'db.branch.findMany({ where: { organizationId, active: true }, orderBy:');
const switchStart=s.indexOf('app.post("/api/branches/switch"');
const switchEnd=s.indexOf('app.get("/api/owner/summary"',switchStart);
s=s.slice(0,switchStart)+`app.post("/api/branches/switch", requirePermission("*"), async (req, res) => {
  const branchId = String(req.body?.branchId || "");
  const branch = await db.branch.findFirst({ where: { id: branchId, organizationId: req.session!.organizationId, active: true } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });
  res.json({ ok: true, token: await createToken(req.session!), branchId, branchName: branch.name });
});

`+s.slice(switchEnd);
// Introduce an explicit branch variable into all data routes that did not have one.
s=s.replace(/(app\.(?:get|post|put|delete)\("\/api\/(?:parties(?:\/[^" ]*)?|products(?:\/[^" ]*)?|settings\/invoice)"[^\n]*\n)([\s\S]*?)(?=\napp\.|$)/g,(whole,head,body)=>{
 if(!body.includes('const branchId =')) body='  const branchId = requireBranch(req, res); if (!branchId) return;\n'+body;
 return head+body;
});
// Party routes all operate on selected branch, including imports and uniqueness checks.
const ps=s.indexOf('app.get("/api/parties"'); const pe=s.indexOf('app.get("/api/products"',ps);
let parties=s.slice(ps,pe);
parties=parties.replaceAll('organizationId, active:', 'organizationId, branchId, active:').replaceAll('organizationId: req.session!.organizationId, active:', 'organizationId: req.session!.organizationId, branchId, active:');
parties=parties.replace('...input, organizationId: req.session!.organizationId','...input, branchId, organizationId: req.session!.organizationId').replace('organizationId, type: "CUSTOMER"','organizationId, branchId, type: "CUSTOMER"');
s=s.slice(0,ps)+parties+s.slice(pe);
s=s.replaceAll('product: { organizationId }','product: { organizationId, branchId }').replaceAll('product: { organizationId: req.session!.organizationId, active:', 'product: { organizationId: req.session!.organizationId, branchId, active:');
s=s.replace('tx.product.create({ data: { organizationId: req.session!.organizationId,','tx.product.create({ data: { branchId, organizationId: req.session!.organizationId,');
s=s.replaceAll('getInvoiceSetting(req.session!.organizationId)','getInvoiceSetting(req.session!.organizationId, requireBranch(req, res)!)').replaceAll('getInvoiceSetting(organizationId)','getInvoiceSetting(organizationId, branchId)');
s=s.replaceAll('where: { organizationId: req.session!.organizationId },\r\n    create: { ...input, organizationId: req.session!.organizationId }','where: { organizationId_branchId: { organizationId: req.session!.organizationId, branchId } },\r\n    create: { ...input, branchId, organizationId: req.session!.organizationId }');
s=s.replaceAll('where: { organizationId }, create: { organizationId }, update: {}','where: { organizationId_branchId: { organizationId, branchId } }, create: { organizationId, branchId }, update: {}');
s=s.replace('async function getInvoiceSetting(organizationId: string)', 'async function getInvoiceSetting(organizationId: string, branchId: string)');
s=s.replaceAll('where: { organizationId, invoiceNumber:', 'where: { organizationId, branchId, invoiceNumber:');
s=s.replaceAll('organizationId_idempotencyKey: { organizationId, idempotencyKey:', 'organizationId_branchId_idempotencyKey: { organizationId, branchId, idempotencyKey:');
s=s.replaceAll('branchId: "organization", documentType: "CN"','branchId, documentType: "CN"');
// Reject foreign parties before any sales mutation.
s=s.replaceAll('const input = parseInput(invoiceInput, req.body);',`const input = parseInput(invoiceInput, req.body);
  if (input.partyId && !await db.party.findFirst({ where: { id: input.partyId, branchId, organizationId: req.session!.organizationId, active: true } })) return res.status(400).json({ error: "Party does not belong to this branch" });`);
s=s.replace('  const creditNote = await db.$transaction',`  if (input.partyId !== inv.partyId) return res.status(400).json({ error: "Credit note party must match invoice" });
  const variants = await db.productVariant.count({ where: { id: { in: input.lines.map(l => l.variantId) }, product: { organizationId, branchId } } });
  if (variants !== new Set(input.lines.map(l => l.variantId)).size) return res.status(400).json({ error: "Invalid branch items" });
  const creditNote = await db.$transaction`);
s=s.replace('  const events = await db.auditEvent.findMany({',`  if (!await db.salesInvoice.findFirst({ where: { id: String(req.params.id), organizationId: req.session!.organizationId, branchId } })) return res.status(404).json({ error: "Invoice not found" });
  const events = await db.auditEvent.findMany({`);
writeFileSync('server/index.ts',s);
let v=readFileSync('server/vouchers.ts','utf8').replaceAll('product: { organizationId }','product: { organizationId, branchId }');
writeFileSync('server/vouchers.ts',v);
