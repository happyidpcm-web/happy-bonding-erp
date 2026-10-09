import type { Branch, Expense, Invoice, InvoiceSetting, OwnerBranchSummary, Party, Product, StaffUser, VoucherRecord } from "./types";

const getBaseUrl = () => {
  if (typeof window !== "undefined" && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return "/api";
};
const baseUrl = getBaseUrl();
const TOKEN_KEY = "hb_erp_token";
const BRANCH_KEY = "hb_erp_branch";

type LoginResult = { token: string; branchIds: string[]; branches?: Branch[]; user: { id: string; name: string; email: string; role?: string } };
type PartyRow = { id:string; name:string; phone:string|null; type:string; openingBalance:string; openingBalanceType?:string|null; email?:string|null; gstin?:string|null; pan?:string|null; category?:string|null; address?:string|null; shippingAddress?:string|null; sameAsBilling?:boolean|null; creditPeriodDays?:number|null; creditLimit?:string|null; contactPersonName?:string|null; contactPersonDob?:string|null; bankName?:string|null; bankAccountName?:string|null; bankAccountNumber?:string|null; bankIfsc?:string|null; bankBranch?:string|null; customBirthday?:string|null; customKovilThiruvila?:string|null };
type PartyInput = Partial<Omit<Party, "id" | "balance">> & { name: string; phone?: string; type: Party["type"]; openingBalance?: number };
type ProductRow = { id:string;sku:string;size:string|null;purchasePrice:string;sellingPrice:string;mrp:string;product:{name:string;category:string;hsnCode:string;taxRate:{rate:string}};balances:Array<{quantity:string}> };
type SalesRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  createdAt?: string;
  postedAt?: string | null;
  party: { name: string; phone?: string | null; address?: string | null; gstin?: string | null } | null;
  subtotal?: string;
  discountTotal?: string;
  invoiceDiscount?: string;
  additionalCharges?: string;
  taxableTotal?: string;
  cgstTotal?: string;
  sgstTotal?: string;
  igstTotal?: string;
  grandTotal: string;
  paidAmount?: string;
  notes?: string | null;
  paymentStatus: string;
  status?: string;
  payments?: Array<{ payment?: { mode?: string | null } | null }>;
  lines?: Array<{
    variantId?: string;
    mrp?: string | null;
    itemName: string;
    sku: string;
    hsnCode?: string | null;
    quantity: number;
    unitPrice: string;
    discount: string;
    taxRate: string;
    variant?: { purchasePrice?: string | null } | null;
    taxableAmount?: string;
    cgst?: string;
    sgst?: string;
    igst?: string;
    total: string;
  }>;
};
type PaymentInRow = {
  id: string;
  mode: string;
  amount: string;
  reference?: string | null;
  paidAt: string;
  allocations?: Array<{
    amount: string;
    salesInvoice?: {
      invoiceNumber: string;
      invoiceDate: string;
      grandTotal: string;
      paidAmount?: string;
      party?: { name: string; phone?: string | null } | null;
    };
  }>;
};
export type PartyLedger = {
  party: PartyRow;
  openingBalance: number;
  invoiceTotal: number;
  paidTotal: number;
  balance: number;
  invoices: Array<{ id: string; invoiceNumber: string; invoiceDate: string; grandTotal: number; paidAmount: number; balance: number; paymentStatus: string }>;
  payments: Array<{ id: string; mode: string; amount: number; reference?: string | null; paidAt: string; allocations: Array<{ invoiceId: string; invoiceNumber: string; amount: number }> }>;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const branch = localStorage.getItem(BRANCH_KEY);
    const response = await fetch(baseUrl + path, { ...options, signal: controller.signal, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...(branch ? { "x-branch-id": branch } : {}), ...options?.headers }});
    if (response.status === 401 && path !== "/auth/login") {
      localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(BRANCH_KEY);
      window.dispatchEvent(new Event("hb-session-expired"));
    }
    if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Backend unavailable. Please retry when the server is connected.");
    const body = await response.json();
    if (!response.ok) throw new Error(formatApiError(body));
    return body as T;
  } catch (error) {
    const failure = controller.signal.aborted ? new Error(`Backend request timed out (${path}). Check your connection and retry. If you were saving, check the records before saving again.`) : error;
    window.dispatchEvent(new CustomEvent("hb-api-error", { detail: failure instanceof Error ? failure.message : "Backend request failed" }));
    throw failure;
  } finally { window.clearTimeout(timeout); }
}

export const api = {
  async transactions(): Promise<Array<{ id: string; sourceId: string; type: string; number: string; date: string; recordedAt: string; party: string; amount: number }>> { return request("/transactions"); },
  async nextVoucherNumber(type: string, prefix: string): Promise<string> {
    const result = await request<{ number: string }>(`/vouchers/next-number?type=${encodeURIComponent(type)}&prefix=${encodeURIComponent(prefix)}`);
    return result.number;
  },
  async vouchers(type: string): Promise<VoucherRecord[]> {
    const rows = await request<VoucherRecord[]>(`/vouchers?type=${encodeURIComponent(type)}`);
    return rows.map(row => ({ ...row, date: new Date(row.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) }));
  },
  async saveVoucher(type: string, record: VoucherRecord): Promise<VoucherRecord> {
    const saved = await request<VoucherRecord>("/vouchers", { method: "POST", body: JSON.stringify({ ...record, type, date: new Date(record.date).toISOString() }) });
    return { ...saved, date: new Date(saved.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) };
  },
  async updatePurchaseVoucher(record: VoucherRecord): Promise<VoucherRecord> {
    const saved = await request<VoucherRecord>(`/vouchers/${encodeURIComponent(record.id)}`, { method: "PUT", body: JSON.stringify({ ...record, type: "Purchase Invoice", date: new Date(record.date).toISOString() }) });
    return { ...saved, date: new Date(saved.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) };
  },
  async deleteVoucher(id: string): Promise<void> {
    await request(`/vouchers/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async health() { return request<{ ok: boolean }>("/health"); },
  async me() { return request<{ id: string; name: string; email: string; isAdmin: boolean; branchIds: string[] }>("/auth/me"); },
  async login(email: string, password: string) { const result = await request<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem(BRANCH_KEY, result.branchIds[0]); return result; },
  logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(BRANCH_KEY); },
  hasSession() { return Boolean(localStorage.getItem(TOKEN_KEY) && localStorage.getItem(TOKEN_KEY) !== "mock_local_token_2026"); },
  currentBranchId() { return localStorage.getItem(BRANCH_KEY) || ""; },
  setCurrentBranch(branchId: string) { localStorage.setItem(BRANCH_KEY, branchId); },
  async branches(): Promise<Branch[]> { return request<Branch[]>("/branches"); },
  async createBranch(input: { code: string; name: string; address?: string; phone?: string; email?: string; password?: string }): Promise<Branch> {
    return request<Branch>("/branches", { method: "POST", body: JSON.stringify(input) });
  },
  async updateBranch(id: string, input: { code: string; name: string; address?: string; phone?: string; email?: string; password?: string }): Promise<Branch> {
    return request<Branch>(`/branches/${id}`, { method: "PUT", body: JSON.stringify(input) });
  },

  async switchBranch(branchId: string, email?: string, password?: string): Promise<{ ok: boolean; token: string; branchId: string; branchName: string }> {
    const res = await request<{ ok: boolean; token: string; branchId: string; branchName: string }>("/branches/switch", {
      method: "POST",
      body: JSON.stringify({ branchId, email, password }),
    });
    if (res.token) localStorage.setItem(TOKEN_KEY, res.token);
    if (res.branchId) localStorage.setItem(BRANCH_KEY, res.branchId);
    return res;
  },

  async ownerSummary(): Promise<OwnerBranchSummary[]> { return request<OwnerBranchSummary[]>("/owner/summary"); },
  async staff(): Promise<StaffUser[]> { return request<StaffUser[]>("/staff"); },
  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
      return await request("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

  },
  async updateStaffPassword(staffId: string, newPassword: string): Promise<{ ok: boolean; message: string }> {
      return await request(`/staff/${staffId}/password`, { method: "PUT", body: JSON.stringify({ newPassword }) });

  },
  async createStaff(input: { name: string; email: string; phone?: string; password: string; branchIds: string[] }): Promise<StaffUser> {
    return request<StaffUser>("/staff", { method: "POST", body: JSON.stringify(input) });
  },
  async syncStatus(): Promise<{ online: boolean; queue: Array<{ status: string; count: number }> }> { return request("/sync/status"); },
  async pushSync(items: Array<{ branchId?: string; entityType: string; entityId: string; operation: string; payload: unknown }>): Promise<{ ok: boolean; accepted: number }> {
    return request("/sync/push", { method: "POST", body: JSON.stringify({ items }) });
  },
  async parties(): Promise<Party[]> {
      const rows = await request<PartyRow[]>("/parties");
      return rows.map(partyFromApi);

  },
  async partyLedger(id: string | number): Promise<PartyLedger | null> {
      return await request<PartyLedger>(`/parties/${id}/ledger`);

  },
  async createParty(input: PartyInput): Promise<Party> {
    const payload = cleanPayload({ ...input, phone: input.phone || undefined, type: input.type === "Supplier" ? "SUPPLIER" : "CUSTOMER" });
      const row = await request<PartyRow>("/parties", { method: "POST", body: JSON.stringify(payload) });
      return partyFromApi(row);

  },
  async updateParty(id: string | number, input: PartyInput): Promise<Party> {
    const payload = cleanPayload({ ...input, phone: input.phone || undefined, type: input.type === "Supplier" ? "SUPPLIER" : "CUSTOMER" });
      const row = await request<PartyRow>(`/parties/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      return partyFromApi(row);

  },
  async importParties(contacts: Array<{ name: string; phone: string; email?: string; address?: string }>): Promise<{ imported:number; skipped:number; invalid:number; duplicateInFile:number; duplicateInDb:number }> {
      return await request("/parties/import", { method: "POST", body: JSON.stringify({ contacts }) });

  },
  async products(): Promise<Product[]> {
      const rows = await request<ProductRow[]>("/products");
      return rows.map(productFromApi);

  },
  async createProduct(input: { name: string; sku: string; category: string; size: string; openingStock: number; purchasePrice: number; sellingPrice: number; mrp: number; hsnCode?: string; taxRate?: number }): Promise<Product[]> {
      await request("/products", { method: "POST", body: JSON.stringify({ ...input, hsnCode: input.hsnCode || "6205", taxRate: input.taxRate ?? 5 }) });
      return await api.products();

  },
  async updateProduct(id: string | number, input: { name: string; sku: string; category: string; size: string; openingStock: number; purchasePrice: number; sellingPrice: number; mrp: number; hsnCode?: string; taxRate?: number }): Promise<Product[]> {
      await request(`/products/${id}`, { method: "PUT", body: JSON.stringify({ ...input, hsnCode: input.hsnCode || "6205", taxRate: input.taxRate ?? 5 }) });
      return await api.products();

  },
  async deleteProduct(id: string | number): Promise<Product[]> {
      await request<{ ok: boolean }>(`/products/${id}`, { method: "DELETE" });
      return await api.products();

  },
  async deleteProductsBulk(ids: (string | number)[]): Promise<Product[]> {
      await request<{ ok: boolean; count: number }>(`/products/bulk-delete`, { method: "POST", body: JSON.stringify({ ids }) });
      return await api.products();

  },
  async createPurchaseStockReceipt(input: { purchaseDate: Date; purchaseNumber: string; partyName?: string; notes?: string; lines: Array<{ variantId: string | number; quantity: number; unitCost: number }> }): Promise<{ ok: boolean; purchaseNumber: string; lines: number }> {
    return request("/purchases/stock-receipt", {
      method: "POST",
      body: JSON.stringify({
        purchaseDate: input.purchaseDate.toISOString(),
        purchaseNumber: input.purchaseNumber,
        partyName: input.partyName,
        notes: input.notes,
        lines: input.lines.map(line => ({ variantId: String(line.variantId), quantity: line.quantity, unitCost: line.unitCost })),
      }),
    });
  },
  async deletePurchaseStockReceipt(purchaseNumber: string): Promise<{ ok: boolean; purchaseNumber: string }> {
    return request(`/purchases/stock-receipt/${encodeURIComponent(purchaseNumber)}`, { method: "DELETE" });
  },
  async invoiceSetting(): Promise<InvoiceSetting> {
      const res = await request<InvoiceSetting>("/settings/invoice");
      return res;

  },
  async businessSettings(): Promise<{name:string;phone:string;gstin:string;pan:string;stateCode:string;branchAddress:string;branchPhone:string}> {
    return request("/settings/business");
  },
  async saveBusinessSettings(input: {name:string;phone:string;gstin:string;pan:string;stateCode:string;branchAddress:string;branchPhone:string}) {
    return request<typeof input>("/settings/business", {method:"PUT", body:JSON.stringify(input)});
  },
  async saveInvoiceSetting(input: InvoiceSetting): Promise<InvoiceSetting> {
      await request<InvoiceSetting>("/settings/invoice", { method: "PUT", body: JSON.stringify(input) });
      return api.invoiceSetting();

  },
  async nextSaleNumber(invoiceDate = new Date()): Promise<{prefix:string;number:number;invoiceNumber:string;financialYear:string}> {
      return await request(`/sales/next-number?invoiceDate=${encodeURIComponent(invoiceDate.toISOString())}`);

  },
  async sales(): Promise<Invoice[]> {
      const rows = await request<SalesRow[]>("/sales");
      return rows.map(saleFromApi);

  },
  async sale(id: string | number): Promise<Invoice> {
    const row = await request<SalesRow>(`/sales/${id}`);
    return saleFromApi(row);
  },
  async createSale(input: { partyId?: string; invoiceDate?: Date; paidAmount: number; paymentMode: "Cash" | "UPI" | "Card" | "Bank"; notes?: string; invoiceDiscount?: number; additionalCharges?: number; lines: Array<{ variantId: string; quantity: number; unitPrice: number; discount: number; taxRate?: number }> }): Promise<Invoice> {
      const row = await request<SalesRow>("/sales", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), partyId: input.partyId, invoiceDate: (input.invoiceDate ?? new Date()).toISOString(), placeOfSupply: "33", paidAmount: input.paidAmount, paymentMode: input.paymentMode, notes: input.notes, invoiceDiscount: input.invoiceDiscount ?? 0, additionalCharges: input.additionalCharges ?? 0, lines: input.lines }) });
      return saleFromApi(row);

  },
  async updateSale(id: string | number, input: { partyId?: string; invoiceDate?: Date; paidAmount: number; paymentMode: "Cash" | "UPI" | "Card" | "Bank"; notes?: string; invoiceDiscount?: number; additionalCharges?: number; lines: Array<{ variantId: string; quantity: number; unitPrice: number; discount: number; taxRate?: number }> }): Promise<Invoice> {
      const row = await request<SalesRow>(`/sales/${id}?response=invoice`, { method: "PUT", body: JSON.stringify({ idempotencyKey: `edit-${id}-${Date.now()}`, partyId: input.partyId, invoiceDate: (input.invoiceDate ?? new Date()).toISOString(), placeOfSupply: "33", paidAmount: input.paidAmount, paymentMode: input.paymentMode, notes: input.notes, invoiceDiscount: input.invoiceDiscount ?? 0, additionalCharges: input.additionalCharges ?? 0, lines: input.lines }) });
      return saleFromApi(row);

  },
  async updateSaleDetails(id: string | number, input: { invoiceDate: string; notes: string }): Promise<Invoice> {
      return saleFromApi(await request<SalesRow>(`/sales/${id}/details`, { method: "PATCH", body: JSON.stringify(input) }));
  },
  async deleteSale(id: string | number): Promise<Invoice[]> {
      await request(`/sales/${id}`, { method: "DELETE" });
      return await api.sales();

  },
  async cancelSale(id: string | number): Promise<Invoice[]> {
      const rows = await request<SalesRow[]>(`/sales/${id}/cancel`, { method: "POST" });
      return rows.map(saleFromApi);

  },
  async createCreditNote(input: { partyId: string; salesInvoiceId: string; date: Date; amount: number; notes?: string; lines: Array<{ variantId: string; itemName: string; quantity: number; unitPrice: number; taxRate: number; total: number }> }) {
      const res = await request<any>("/credit-notes", { method: "POST", body: JSON.stringify(input) });
      return res;

  },
  async paymentIns(): Promise<PaymentInRow[]> {
      return await request<PaymentInRow[]>("/payments/in");

  },
  async nextPaymentInNumber(paidAt = new Date()): Promise<{ prefix: string; number: number; paymentNumber: string; financialYear: string }> {
      return await request(`/payments/in/next-number?paidAt=${encodeURIComponent(paidAt.toISOString())}`);

  },
  async createPaymentIn(input: { amount: number; mode: string; paidAt: Date; reference?: string; partyName?: string; partyPhone?: string; paymentNumber?: string; prefix?: string; number?: string; discount?: number; allocations?: Array<{ salesInvoiceId: string | number; amount: number }> }): Promise<PaymentInRow | null> {
    return await request<PaymentInRow>("/payments/in", { method: "POST", body: JSON.stringify({ amount: input.amount, mode: input.mode, paidAt: input.paidAt.toISOString(), reference: input.reference, partyName: input.partyName, partyPhone: input.partyPhone, paymentNumber: input.paymentNumber, prefix: input.prefix, number: input.number, discount: input.discount, allocations: input.allocations }) });
  },
  async sendReportEmail(payload: { reportName: string; userEmail: string; caEmail?: string }): Promise<{ ok: boolean; message: string }> {
    return request("/reports/send-email", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async sendBrevoEmail(payload: { reportName: string; userEmail: string; caEmail?: string; base64Excel?: string }): Promise<{ok:boolean;message:string}> {
    return request('/email/report', {method:'POST',body:JSON.stringify(payload)});
  },

  async getExpenses() {
    return request<Expense[]>("/expenses");
  },
  async createExpense(data: Omit<Expense, "id">) {
    return request<Expense>("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async deleteExpense(id: string) {
    return request<{ ok: boolean }>(`/expenses/${id}`, { method: "DELETE" });
  },
  async exportBackup() {
    return request<any>("/backup/export");
  },
  async restoreBackup(backupData: any, understandingText: string) {
    return request<{ ok: boolean; message: string }>("/backup/restore", {
      method: "POST",
      body: JSON.stringify({ backupData, doubleConfirmation: true, understandingText }),
    });
  },
  async resetTransactions(payload: { doubleConfirmation: string; clearProducts?: boolean; clearParties?: boolean }) {
    return request<{ ok: boolean; message: string }>("/admin/reset-transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

function partyFromApi(x: PartyRow): Party { return { id:x.id,name:x.name,phone:x.phone??"",type:x.type==="SUPPLIER"?"Supplier":"Customer",balance:Number(x.openingBalance),openingBalanceType:x.openingBalanceType==="TO_PAY"?"TO_PAY":"TO_COLLECT",email:x.email??"",gstin:x.gstin??"",pan:x.pan??"",category:x.category??"",address:x.address??"",shippingAddress:x.shippingAddress??"",sameAsBilling:x.sameAsBilling??true,creditPeriodDays:x.creditPeriodDays??30,creditLimit:Number(x.creditLimit??0),contactPersonName:x.contactPersonName??"",contactPersonDob:x.contactPersonDob??"",bankName:x.bankName??"",bankAccountName:x.bankAccountName??"",bankAccountNumber:x.bankAccountNumber??"",bankIfsc:x.bankIfsc??"",bankBranch:x.bankBranch??"",customBirthday:x.customBirthday??"",customKovilThiruvila:x.customKovilThiruvila??""}; }
function productFromApi(x: ProductRow): Product { return {id:x.id,name:x.product.name,sku:x.sku,category:x.product.category,size:x.size??"-",stock:Number(x.balances[0]?.quantity??0),purchasePrice:Number(x.purchasePrice),sellingPrice:Number(x.sellingPrice),mrp:Number(x.mrp),hsnCode:x.product.hsnCode,taxRate:Number(x.product.taxRate.rate)}; }
export function saleFromApi(x: SalesRow): Invoice {
  // Invoice date is a calendar date; midnight UTC is not the billing time.
  const d = new Date(x.invoiceDate);
  const dateStr = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
  const recordedAt = x.createdAt || x.postedAt;
  const timeStr = recordedAt && Number.isFinite(Date.parse(recordedAt))
    ? new Date(recordedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : "";
  return {
    id: x.id,
    number: x.invoiceNumber,
    dateISO: x.invoiceDate.slice(0, 10),
    date: timeStr ? `${dateStr} ${timeStr}` : dateStr,
    party: x.party?.name ?? "Cash Sale",
    partyId: (x as any).partyId,
    partyPhone: x.party?.phone ?? "",
    partyAddress: x.party?.address ?? "",
    partyGstin: x.party?.gstin ?? "",
    amount: Number(x.grandTotal),
    paidAmount: x.paidAmount == null ? undefined : Number(x.paidAmount),
    paymentMode: x.payments?.[0]?.payment?.mode ?? "",
    subtotal: Number(x.subtotal ?? 0),
    discountTotal: Number(x.discountTotal ?? 0),
    invoiceDiscount: Number(x.invoiceDiscount ?? 0),
    additionalCharges: Number(x.additionalCharges ?? 0),
    taxableTotal: Number(x.taxableTotal ?? 0),
    cgstTotal: Number(x.cgstTotal ?? 0),
    sgstTotal: Number(x.sgstTotal ?? 0),
    igstTotal: Number(x.igstTotal ?? 0),
    notes: x.notes ?? "",
    status: x.status === "CANCELLED" ? "Cancelled" : x.paymentStatus === "PAID" ? "Paid" : x.paymentStatus === "UNPAID" ? "Unpaid" : "Partially paid",
    lines: (x.lines ?? []).map(l => ({
      variantId: l.variantId,
      mrp: l.mrp == null ? undefined : Number(l.mrp),
      itemName: l.itemName,
      sku: l.sku,
      hsnCode: l.hsnCode ?? "",
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      purchasePrice: Number((l as any).purchasePriceAtSale ?? l.variant?.purchasePrice ?? 0),
      discount: Number(l.discount),
      taxRate: Number(l.taxRate),
      taxableAmount: Number(l.taxableAmount ?? 0),
      cgst: Number(l.cgst ?? 0),
      sgst: Number(l.sgst ?? 0),
      igst: Number(l.igst ?? 0),
      total: Number(l.total),
    })),
  };
}
function formatApiError(body: unknown) {
  if (body && typeof body === "object" && "details" in body && Array.isArray((body as { details: unknown }).details)) {
    const issue = (body as { details: Array<{ path?: Array<string | number>; message?: string }> }).details[0];
    const field = issue?.path?.join(".");
    return `${field ? `${field}: ` : ""}${issue?.message ?? "Validation failed"}`;
  }
  if (body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string") return (body as { error: string }).error;
  return "Request failed";
}

function cleanPayload<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === "" || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned as T;
}
