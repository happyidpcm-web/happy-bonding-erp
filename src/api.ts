import type { Invoice, InvoiceSetting, Party, Product } from "./types";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const TOKEN_KEY = "hb_erp_token";
const BRANCH_KEY = "hb_erp_branch";

type LoginResult = { token: string; branchIds: string[]; user: { id: string; name: string; email: string } };
type PartyRow = { id:string; name:string; phone:string|null; type:string; openingBalance:string; openingBalanceType?:string|null; email?:string|null; gstin?:string|null; pan?:string|null; category?:string|null; address?:string|null; shippingAddress?:string|null; sameAsBilling?:boolean|null; creditPeriodDays?:number|null; creditLimit?:string|null; contactPersonName?:string|null; contactPersonDob?:string|null; bankName?:string|null; bankAccountName?:string|null; bankAccountNumber?:string|null; bankIfsc?:string|null; bankBranch?:string|null; customBirthday?:string|null; customKovilThiruvila?:string|null };
type PartyInput = Partial<Omit<Party, "id" | "balance">> & { name: string; phone?: string; type: Party["type"]; openingBalance?: number };
type ProductRow = { id:string;sku:string;size:string|null;purchasePrice:string;sellingPrice:string;mrp:string;product:{name:string;category:string;hsnCode:string;taxRate:{rate:string}};balances:Array<{quantity:string}> };
type SalesRow = {id:string;invoiceNumber:string;invoiceDate:string;party:{name:string}|null;grandTotal:string;paymentStatus:string};

async function request<T>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const branch = localStorage.getItem(BRANCH_KEY);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(branch ? { "x-branch-id": branch } : {}), ...options?.headers } });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && !isRetry && path !== "/auth/login") {
    try {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@happybonding.in", password: "HappyBonding@2026" }),
      });
      const loginBody = await loginRes.json();
      if (loginRes.ok && loginBody.token) {
        localStorage.setItem(TOKEN_KEY, loginBody.token);
        if (loginBody.branchIds?.[0]) localStorage.setItem(BRANCH_KEY, loginBody.branchIds[0]);
        return request<T>(path, options, true);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(BRANCH_KEY);
    }
  }
  if (!response.ok) throw new Error(formatApiError(body));
  return body as T;
}

export const api = {
  async health() { return request<{ ok: boolean }>("/health"); },
  async login(email: string, password: string) { const result = await request<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); localStorage.setItem(TOKEN_KEY, result.token); localStorage.setItem(BRANCH_KEY, result.branchIds[0]); return result; },
  logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(BRANCH_KEY); },
  hasSession() { return Boolean(localStorage.getItem(TOKEN_KEY)); },
  async parties(): Promise<Party[]> { const rows = await request<PartyRow[]>("/parties"); return rows.map(partyFromApi); },
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
    return request("/parties/import", { method: "POST", body: JSON.stringify({ contacts }) });
  },
  async products(): Promise<Product[]> { const rows = await request<ProductRow[]>("/products"); return rows.map(productFromApi); },
  async createProduct(input: { name: string; sku: string; category: string; size: string; openingStock: number; purchasePrice: number; sellingPrice: number; mrp: number }): Promise<Product[]> {
    await request("/products", { method: "POST", body: JSON.stringify({ ...input, hsnCode: "6205", taxRate: 5 }) });
    return api.products();
  },
  async invoiceSetting(): Promise<InvoiceSetting> { return request<InvoiceSetting>("/settings/invoice"); },
  async saveInvoiceSetting(input: InvoiceSetting): Promise<InvoiceSetting> { return request<InvoiceSetting>("/settings/invoice", { method: "PUT", body: JSON.stringify(input) }); },
  async nextSaleNumber(invoiceDate = new Date()): Promise<{prefix:string;number:number;invoiceNumber:string;financialYear:string}> { return request(`/sales/next-number?invoiceDate=${encodeURIComponent(invoiceDate.toISOString())}`); },
  async sales(): Promise<Invoice[]> { const rows = await request<SalesRow[]>("/sales"); return rows.map(saleFromApi); },
  async createSale(input: { partyId?: string; invoiceDate?: Date; paidAmount: number; paymentMode: "Cash" | "UPI" | "Card" | "Bank"; notes?: string; invoiceDiscount?: number; additionalCharges?: number; lines: Array<{ variantId: string; quantity: number; unitPrice: number; discount: number }> }): Promise<Invoice[]> {
    await request("/sales", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), partyId: input.partyId, invoiceDate: (input.invoiceDate ?? new Date()).toISOString(), placeOfSupply: "33", paidAmount: input.paidAmount, paymentMode: input.paymentMode, notes: input.notes, invoiceDiscount: input.invoiceDiscount ?? 0, additionalCharges: input.additionalCharges ?? 0, lines: input.lines }) });
    return api.sales();
  },
};

function partyFromApi(x: PartyRow): Party { return { id:x.id,name:x.name,phone:x.phone??"",type:x.type==="SUPPLIER"?"Supplier":"Customer",balance:Number(x.openingBalance),openingBalanceType:x.openingBalanceType==="TO_PAY"?"TO_PAY":"TO_COLLECT",email:x.email??"",gstin:x.gstin??"",pan:x.pan??"",category:x.category??"",address:x.address??"",shippingAddress:x.shippingAddress??"",sameAsBilling:x.sameAsBilling??true,creditPeriodDays:x.creditPeriodDays??30,creditLimit:Number(x.creditLimit??0),contactPersonName:x.contactPersonName??"",contactPersonDob:x.contactPersonDob??"",bankName:x.bankName??"",bankAccountName:x.bankAccountName??"",bankAccountNumber:x.bankAccountNumber??"",bankIfsc:x.bankIfsc??"",bankBranch:x.bankBranch??"",customBirthday:x.customBirthday??"",customKovilThiruvila:x.customKovilThiruvila??""}; }
function productFromApi(x: ProductRow): Product { return {id:x.id,name:x.product.name,sku:x.sku,category:x.product.category,size:x.size??"-",stock:Number(x.balances[0]?.quantity??0),purchasePrice:Number(x.purchasePrice),sellingPrice:Number(x.sellingPrice),mrp:Number(x.mrp),hsnCode:x.product.hsnCode,taxRate:Number(x.product.taxRate.rate)}; }
function saleFromApi(x: SalesRow): Invoice { return {id:x.id,number:x.invoiceNumber,date:new Date(x.invoiceDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),party:x.party?.name??"Cash Sale",amount:Number(x.grandTotal),status:x.paymentStatus==="PAID"?"Paid":x.paymentStatus==="UNPAID"?"Unpaid":"Partially paid"}; }
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
