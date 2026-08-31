import { z } from "zod";

export const loginInput = z.object({ email: z.string().email(), password: z.string().min(8) });
const optString = (maxLen?: number) => z.preprocess(v => (v === "" || v === null ? undefined : v), maxLen ? z.string().trim().max(maxLen).optional() : z.string().trim().optional());
const optEmail = () => z.preprocess(v => (v === "" || v === null ? undefined : v), z.string().trim().email().optional());
const optGstin = () => z.preprocess(v => (v === "" || v === null ? undefined : v), z.string().trim().length(15).optional());
const optDate = () => z.preprocess(v => (v === "" || v === null || v === "Invalid Date" ? undefined : v), z.coerce.date().optional());

export const partyInput = z.object({
  name: z.string().trim().min(2).max(120), type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  phone: optString(20), email: optEmail(), gstin: optGstin(), pan: optString(10), category: optString(80),
  stateCode: optString(2), address: optString(500), shippingAddress: optString(500), sameAsBilling: z.boolean().default(true),
  openingBalance: z.coerce.number().default(0), openingBalanceType: z.enum(["TO_COLLECT", "TO_PAY"]).default("TO_COLLECT"),
  creditPeriodDays: z.coerce.number().int().min(0).max(3650).default(30), creditLimit: z.coerce.number().nonnegative().default(0),
  contactPersonName: optString(120), contactPersonDob: optDate(),
  bankName: optString(120), bankAccountName: optString(120), bankAccountNumber: optString(40), bankIfsc: optString(20), bankBranch: optString(120),
  customBirthday: optString(120), customKovilThiruvila: optString(120),
});
export const productInput = z.object({
  name: z.string().trim().min(2), category: z.string().trim().min(2), brand: z.string().optional(),
  hsnCode: z.string().min(4).max(8), taxRate: z.number().min(0).max(100), sku: z.string().trim().min(1),
  barcode: z.string().optional(), size: z.string().optional(), color: z.string().optional(),
  purchasePrice: z.number().nonnegative(), sellingPrice: z.number().nonnegative(), mrp: z.number().nonnegative(), openingStock: z.number().nonnegative().default(0),
});
export const invoiceInput = z.object({
  idempotencyKey: z.string().min(8).max(100), partyId: z.string().optional(), invoiceDate: z.coerce.date(),
  placeOfSupply: z.string().length(2), paidAmount: z.number().nonnegative().default(0), paymentMode: z.enum(["Cash", "UPI", "Card", "Bank"]).default("Cash"),
  notes: z.string().max(1000).optional(), invoiceDiscount: z.number().nonnegative().default(0), additionalCharges: z.number().nonnegative().default(0),
  lines: z.array(z.object({ variantId: z.string(), quantity: z.number().positive(), unitPrice: z.number().nonnegative(), discount: z.number().nonnegative().default(0), taxRate: z.number().min(0).max(100).optional() })).min(1),
});

export const purchaseStockInput = z.object({
  purchaseDate: z.coerce.date(),
  purchaseNumber: z.string().trim().min(1).max(80),
  partyName: z.string().trim().min(1).max(160).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.number().positive(),
    unitCost: z.number().nonnegative().default(0),
  })).min(1),
});

export const invoiceSettingInput = z.object({
  invoicePrefix: z.string().trim().min(2).max(30).default("HB/SL"),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  terms: z.string().max(1000).default(""),
  bankName: optString(120),
  accountName: optString(120),
  accountNumber: optString(40),
  ifsc: optString(20),
  upiId: optString(120),
  qrText: optString(500),
  signatureText: optString(120),
  signatureUrl: optString(500000),
});

export const expenseInput = z.object({
  category: z.string().trim().min(2).max(100),
  amount: z.coerce.number().positive(),
  paymentMode: z.enum(["Cash", "Bank Account", "UPI"]).default("Cash"),
  paidTo: optString(120),
  notes: optString(500),
  expenseDate: z.coerce.date().default(() => new Date()),
});

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T { return schema.parse(value); }
