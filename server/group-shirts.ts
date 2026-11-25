import { Router } from "express";
import { orderAmounts, shirtSizes, orderStatuses } from "../src/pages/group-shirts/types.js";
import { z } from "zod";
import { db } from "./db.js";
import { requireBranch, requirePermission } from "./auth.js";

const photo = z.string().max(700000).refine(v => !v || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(v), "Invalid photo");
export const groupShirtInput = z.object({
  fabricSupplier: z.string().trim().max(150).default(""),
  fabricMetres: z.number().min(0).max(1000000).default(0),
  fabricPrice: z.number().min(0).max(1000000).default(0),
  transportCost: z.number().min(0).max(100000000).default(0),
  stitchingQuantity: z.number().int().min(0).max(1000000).default(0),
  stitchingPrice: z.number().min(0).max(1000000).default(0),
  vestiPurchaseQuantity: z.number().int().min(0).max(10000).default(0),
  vestiPurchaseRate: z.number().min(0).max(100000).default(0),
  groupName: z.string().trim().min(1).max(150), customerName: z.string().trim().min(1).max(150),
  phone: z.string().trim().regex(/^[+\d ()-]{7,20}$/),
  deliveryDate: z.iso.date(), fabric: z.string().trim().max(150), colour: z.string().trim().max(100),
  sleeve: z.enum(["Half sleeve", "Full sleeve", "Mixed sleeve"]), printing: z.string().trim().max(1000), notes: z.string().trim().max(2000),
  shirtRate: z.number().min(0).max(100000), discount: z.number().min(0).max(100000000),
  vestiQuantity: z.number().int().min(0).max(10000), vestiRate: z.number().min(0).max(100000),
  photo, advance: z.number().min(0).max(100000000),
  lines: z.array(z.object({ size: z.enum(shirtSizes), quantity: z.number().int().min(0).max(10000), halfSleeveQuantity: z.number().int().min(0).max(10000).optional(), fullSleeveQuantity: z.number().int().min(0).max(10000).optional(), rate: z.literal(0), photo: z.literal("") })).length(shirtSizes.length),
}).refine(v => new Set(v.lines.map(l => l.size)).size === shirtSizes.length, "Sizes must be unique")
  .refine(v => v.lines.every(line => line.halfSleeveQuantity === undefined && line.fullSleeveQuantity === undefined || line.quantity === (line.halfSleeveQuantity || 0) + (line.fullSleeveQuantity || 0)), "Each size total must equal its half and full sleeve quantities")
  .refine(v => v.lines.some(l => l.quantity > 0), "Enter at least one shirt quantity")
  .refine(v => v.discount <= orderAmounts(v).subtotal, "Discount cannot exceed subtotal")
  .refine(v => v.advance <= orderAmounts(v).total, "Advance cannot exceed order total");

export const groupShirtStatusInput = z.object({ status: z.enum(orderStatuses) }).strict();
export const groupShirtsRouter = Router();
groupShirtsRouter.patch("/:id/status", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const parsed = groupShirtStatusInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose Processing, Completed or Delivered." });
  const where = { id: String(req.params.id), organizationId: req.session!.organizationId, branchId };
  const existing = await db.groupShirtOrder.findFirst({ where });
  if (!existing) return res.status(404).json({ error: "Order not found" });
  res.json(await db.groupShirtOrder.update({ where, data: parsed.data }));
});
const legacyEditInput = z.object({
  ...groupShirtInput.shape,
  shirtRate: z.null(),
  lines: z.array(z.object({ size: z.enum(shirtSizes), quantity: z.number().int().min(0).max(10000), halfSleeveQuantity: z.number().int().min(0).max(10000).optional(), fullSleeveQuantity: z.number().int().min(0).max(10000).optional(), rate: z.number().min(0).max(100000), photo })).length(shirtSizes.length),
}).refine(v => new Set(v.lines.map(l => l.size)).size === shirtSizes.length, "Sizes must be unique")
  .refine(v => v.lines.every(line => line.halfSleeveQuantity === undefined && line.fullSleeveQuantity === undefined || line.quantity === (line.halfSleeveQuantity || 0) + (line.fullSleeveQuantity || 0)), "Each size total must equal its half and full sleeve quantities")
  .refine(v => v.lines.some(l => l.quantity > 0), "Enter at least one shirt quantity")
  .refine(v => v.discount <= orderAmounts(v).subtotal, "Discount cannot exceed subtotal")
  .refine(v => v.advance <= orderAmounts(v).total, "Advance cannot exceed order total");
groupShirtsRouter.put("/:id", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const where = { id: String(req.params.id), organizationId: req.session!.organizationId, branchId };
  const existing = await db.groupShirtOrder.findFirst({ where });
  if (!existing) return res.status(404).json({ error: "Order not found" });
  const parsed = (existing.shirtRate === null && req.body.shirtRate === null ? legacyEditInput : groupShirtInput).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  res.json(await db.groupShirtOrder.update({ where, data: parsed.data }));
});
groupShirtsRouter.get("/", async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  res.json(await db.groupShirtOrder.findMany({ where: { organizationId: req.session!.organizationId, branchId }, orderBy: { createdAt: "desc" } }));
});
groupShirtsRouter.post("/", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const parsed = groupShirtInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const order = await db.groupShirtOrder.create({ data: { ...parsed.data, status: "PROCESSING", organizationId: req.session!.organizationId, branchId } });
  res.status(201).json(order);
});

// Scope deletion to the signed-in organization and selected branch.
groupShirtsRouter.delete("/:id", requirePermission("sales.write"), async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const result = await db.groupShirtOrder.deleteMany({ where: { id: String(req.params.id), organizationId: req.session!.organizationId, branchId } });
  if (!result.count) return res.status(404).json({ error: "Order not found" });
  res.json({ success: true });
});
