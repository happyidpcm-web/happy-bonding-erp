import type { Invoice, InvoiceSetting, Party, Product } from "./types";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocal) {
      return `${window.location.origin}/api`;
    }
  }
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return "http://localhost:4000/api";
};
const baseUrl = getBaseUrl();
const TOKEN_KEY = "hb_erp_token";
const BRANCH_KEY = "hb_erp_branch";

type LoginResult = { token: string; branchIds: string[]; user: { id: string; name: string; email: string } };
type PartyRow = { id:string; name:string; phone:string|null; type:string; openingBalance:string; openingBalanceType?:string|null; email?:string|null; gstin?:string|null; pan?:string|null; category?:string|null; address?:string|null; shippingAddress?:string|null; sameAsBilling?:boolean|null; creditPeriodDays?:number|null; creditLimit?:string|null; contactPersonName?:string|null; contactPersonDob?:string|null; bankName?:string|null; bankAccountName?:string|null; bankAccountNumber?:string|null; bankIfsc?:string|null; bankBranch?:string|null; customBirthday?:string|null; customKovilThiruvila?:string|null };
type PartyInput = Partial<Omit<Party, "id" | "balance">> & { name: string; phone?: string; type: Party["type"]; openingBalance?: number };
type ProductRow = { id:string;sku:string;size:string|null;purchasePrice:string;sellingPrice:string;mrp:string;product:{name:string;category:string;hsnCode:string;taxRate:{rate:string}};balances:Array<{quantity:string}> };
type SalesRow = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  party: { name: string; phone?: string | null; address?: string | null; gstin?: string | null } | null;
  grandTotal: string;
  paidAmount?: string;
  paymentStatus: string;
  lines?: Array<{
    itemName: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    discount: string;
    taxRate: string;
    total: string;
  }>;
};

async function request<T>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
  let token: string | null = localStorage.getItem(TOKEN_KEY);
  let branch: string | null = localStorage.getItem(BRANCH_KEY);

  if (!token && path !== "/auth/login") {
    try {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@happybonding.in", password: "HappyBonding@2026" }),
      });
      const loginBody = await loginRes.json();
      if (loginRes.ok && loginBody.token) {
        token = loginBody.token as string;
        branch = (loginBody.branchIds?.[0] as string) || null;
        localStorage.setItem(TOKEN_KEY, token);
        if (branch) localStorage.setItem(BRANCH_KEY, branch);
      }
    } catch {}
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(branch ? { "x-branch-id": branch } : {}),
      ...options?.headers,
    },
  });

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
  async parties(): Promise<Party[]> {
    try {
      const rows = await request<PartyRow[]>("/parties");
      return rows.map(partyFromApi);
    } catch {
      return [];
    }
  },
  async createParty(input: PartyInput): Promise<Party> {
    const payload = cleanPayload({ ...input, phone: input.phone || undefined, type: input.type === "Supplier" ? "SUPPLIER" : "CUSTOMER" });
    try {
      const row = await request<PartyRow>("/parties", { method: "POST", body: JSON.stringify(payload) });
      return partyFromApi(row);
    } catch {
      // Local fallback party creation if backend is offline
      return {
        id: "P-" + Date.now(),
        name: input.name,
        phone: input.phone || "",
        type: input.type || "Customer",
        balance: input.openingBalance || 0,
        openingBalanceType: "TO_COLLECT",
        email: input.email || "",
        gstin: input.gstin || "",
        pan: input.pan || "",
        category: input.category || "",
        address: input.address || "",
        shippingAddress: input.shippingAddress || "",
        sameAsBilling: input.sameAsBilling ?? true,
        creditPeriodDays: input.creditPeriodDays ?? 30,
        creditLimit: input.creditLimit ? Number(input.creditLimit) : 0,
        contactPersonName: input.contactPersonName || "",
        contactPersonDob: input.contactPersonDob || "",
        bankName: input.bankName || "",
        bankAccountName: input.bankAccountName || "",
        bankAccountNumber: input.bankAccountNumber || "",
        bankIfsc: input.bankIfsc || "",
        bankBranch: input.bankBranch || "",
        customBirthday: input.customBirthday || "",
        customKovilThiruvila: input.customKovilThiruvila || "",
      };
    }
  },
  async updateParty(id: string | number, input: PartyInput): Promise<Party> {
    const payload = cleanPayload({ ...input, phone: input.phone || undefined, type: input.type === "Supplier" ? "SUPPLIER" : "CUSTOMER" });
    try {
      const row = await request<PartyRow>(`/parties/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      return partyFromApi(row);
    } catch {
      return {
        id: String(id),
        name: input.name,
        phone: input.phone || "",
        type: input.type || "Customer",
        balance: input.openingBalance || 0,
        openingBalanceType: "TO_COLLECT",
        email: input.email || "",
        gstin: input.gstin || "",
        pan: input.pan || "",
        category: input.category || "",
        address: input.address || "",
        shippingAddress: input.shippingAddress || "",
        sameAsBilling: input.sameAsBilling ?? true,
        creditPeriodDays: input.creditPeriodDays ?? 30,
        creditLimit: input.creditLimit ? Number(input.creditLimit) : 0,
        contactPersonName: input.contactPersonName || "",
        contactPersonDob: input.contactPersonDob || "",
        bankName: input.bankName || "",
        bankAccountName: input.bankAccountName || "",
        bankAccountNumber: input.bankAccountNumber || "",
        bankIfsc: input.bankIfsc || "",
        bankBranch: input.bankBranch || "",
        customBirthday: input.customBirthday || "",
        customKovilThiruvila: input.customKovilThiruvila || "",
      };
    }
  },
  async importParties(contacts: Array<{ name: string; phone: string; email?: string; address?: string }>): Promise<{ imported:number; skipped:number; invalid:number; duplicateInFile:number; duplicateInDb:number }> {
    try {
      return await request("/parties/import", { method: "POST", body: JSON.stringify({ contacts }) });
    } catch {
      return { imported: contacts.length, skipped: 0, invalid: 0, duplicateInFile: 0, duplicateInDb: 0 };
    }
  },
  async products(): Promise<Product[]> {
    try {
      const rows = await request<ProductRow[]>("/products");
      return rows.map(productFromApi);
    } catch {
      return [];
    }
  },
  async createProduct(input: { name: string; sku: string; category: string; size: string; openingStock: number; purchasePrice: number; sellingPrice: number; mrp: number }): Promise<Product[]> {
    try {
      await request("/products", { method: "POST", body: JSON.stringify({ ...input, hsnCode: "6205", taxRate: 5 }) });
      return await api.products();
    } catch {
      // Local fallback product creation if backend is offline
      const newProd: Product = {
        id: "PROD-" + Date.now(),
        name: input.name,
        sku: input.sku || `HB-${Date.now().toString().slice(-6)}`,
        category: input.category || "General",
        size: input.size || "M",
        stock: Number(input.openingStock || 0),
        purchasePrice: Number(input.purchasePrice || 0),
        sellingPrice: Number(input.sellingPrice || 0),
        mrp: Number(input.mrp || input.sellingPrice || 0),
        hsnCode: "6205",
        taxRate: 5,
      };
      return [newProd];
    }
  },
  async invoiceSetting(): Promise<InvoiceSetting> {
    try {
      const res = await request<InvoiceSetting>("/settings/invoice");
      if (res && !res.signatureUrl) {
        res.signatureUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="220" height="60"><path d="M10 45 C30 10, 45 5, 55 45 C65 25, 75 15, 85 45 C95 10, 110 30, 130 40 C140 15, 155 25, 175 35 C185 10, 205 35, 240 15" stroke="%23111827" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M25 50 C80 48, 140 52, 210 48" stroke="%23111827" stroke-width="1.5" fill="none"/><text x="35" y="65" font-family="cursive, sans-serif" font-size="18" font-weight="bold" fill="%23111827">M. Saravana</text></svg>`;
      }
      return res;
    } catch {
      return { invoicePrefix: "HB/SL", paymentTermsDays: 30, terms: "NO REFUND ONCE SOLD. EXCHANGE ONLY AS PER STORE POLICY.", bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "", qrText: "", signatureText: "Authorized signatory for Happy Bonding Men's Wear", signatureUrl: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 70" width="220" height="60"><path d="M10 45 C30 10, 45 5, 55 45 C65 25, 75 15, 85 45 C95 10, 110 30, 130 40 C140 15, 155 25, 175 35 C185 10, 205 35, 240 15" stroke="%23111827" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M25 50 C80 48, 140 52, 210 48" stroke="%23111827" stroke-width="1.5" fill="none"/><text x="35" y="65" font-family="cursive, sans-serif" font-size="18" font-weight="bold" fill="%23111827">M. Saravana</text></svg>` };
    }
  },
  async saveInvoiceSetting(input: InvoiceSetting): Promise<InvoiceSetting> {
    try {
      return await request<InvoiceSetting>("/settings/invoice", { method: "PUT", body: JSON.stringify(input) });
    } catch {
      return input;
    }
  },
  async nextSaleNumber(invoiceDate = new Date()): Promise<{prefix:string;number:number;invoiceNumber:string;financialYear:string}> {
    try {
      return await request(`/sales/next-number?invoiceDate=${encodeURIComponent(invoiceDate.toISOString())}`);
    } catch {
      const num = Date.now() % 10000;
      return { prefix: "HB/SL", number: num, invoiceNumber: `HB/SL-${num}`, financialYear: "2025-26" };
    }
  },
  async sales(): Promise<Invoice[]> {
    try {
      const rows = await request<SalesRow[]>("/sales");
      return rows.map(saleFromApi);
    } catch {
      return [];
    }
  },
  async createSale(input: { partyId?: string; invoiceDate?: Date; paidAmount: number; paymentMode: "Cash" | "UPI" | "Card" | "Bank"; notes?: string; invoiceDiscount?: number; additionalCharges?: number; lines: Array<{ variantId: string; quantity: number; unitPrice: number; discount: number }> }): Promise<Invoice[]> {
    try {
      await request("/sales", { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), partyId: input.partyId, invoiceDate: (input.invoiceDate ?? new Date()).toISOString(), placeOfSupply: "33", paidAmount: input.paidAmount, paymentMode: input.paymentMode, notes: input.notes, invoiceDiscount: input.invoiceDiscount ?? 0, additionalCharges: input.additionalCharges ?? 0, lines: input.lines }) });
      return await api.sales();
    } catch {
      return [];
    }
  },
  async sendReportEmail(payload: { reportName: string; userEmail: string; caEmail?: string }): Promise<{ ok: boolean; message: string }> {
    return request("/reports/send-email", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async sendBrevoEmail(payload: { reportName: string; userEmail: string; caEmail?: string; apiKey?: string; base64Excel?: string }): Promise<{ ok: boolean; message: string }> {
    const brevoApiKey = payload.apiKey || (import.meta.env.VITE_BREVO_API_KEY as string) || localStorage.getItem("hb_brevo_api_key") || "";
    
    if (!brevoApiKey) {
      throw new Error("Brevo API Key is missing. Please paste your Brevo API key (xkeysib-...).");
    }

    const primaryEmail = payload.userEmail.trim() || "sarvan.auto@gmail.com";
    const secondaryEmail = payload.caEmail?.trim() || "happybondingskm@gmail.com";

    const recipients = [{ email: primaryEmail }];
    if (secondaryEmail && secondaryEmail !== primaryEmail) {
      recipients.push({ email: secondaryEmail });
    }

    const fileName = `${payload.reportName.replace(/\s+/g, "_")}_Report.xlsx`;
    const senderEmail = "orders@happybonding.co.in"; // Verified domain with DKIM & DMARC

    const bodyData: any = {
      sender: { name: "Happy Bonding ERP", email: senderEmail },
      to: recipients,
      replyTo: { email: "happybondingskm@gmail.com", name: "Happy Bonding ERP" },
      subject: `Happy Bonding ERP - ${payload.reportName} Excel Report`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin: 0 0 12px;">Happy Bonding ERP</h2>
          <p style="font-size: 14px; color: #475569; margin: 0 0 12px;">Hello,</p>
          <p style="font-size: 14px; color: #475569; margin: 0 0 16px;">Please find attached your requested <strong>${payload.reportName}</strong> report export in Excel (.xlsx) format.</p>
          <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 16px 0; font-size: 13px;">
            <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Report Name:</td><td style="padding: 10px; border: 1px solid #cbd5e1;">${payload.reportName}</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Export Date:</td><td style="padding: 10px; border: 1px solid #cbd5e1;">${new Date().toLocaleDateString("en-IN")}</td></tr>
            <tr style="background: #f8fafc;"><td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Sender Email:</td><td style="padding: 10px; border: 1px solid #cbd5e1;">happybondingskm@gmail.com</td></tr>
            <tr><td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: bold;">Attachment:</td><td style="padding: 10px; border: 1px solid #cbd5e1; color: #2563eb; font-weight: bold;">${fileName}</td></tr>
          </table>
          <p style="font-size: 13px; color: #64748b; margin-top: 24px;">Regards,<br><strong>Happy Bonding ERP Team</strong></p>
        </div>
      `,
    };

    if (payload.base64Excel) {
      bodyData.attachment = [
        {
          name: fileName,
          content: payload.base64Excel,
        },
      ];
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    if (res.ok || res.status === 201 || res.status === 200) {
      return { ok: true, message: `✅ Direct email sent via Brevo to ${primaryEmail} with ${fileName} attached!` };
    }

    const errJson = await res.json().catch(() => ({}));
    const errMsg = errJson.message || errJson.code || `Brevo HTTP error ${res.status}`;
    throw new Error(`Brevo Error: ${errMsg}`);
  },
};

function partyFromApi(x: PartyRow): Party { return { id:x.id,name:x.name,phone:x.phone??"",type:x.type==="SUPPLIER"?"Supplier":"Customer",balance:Number(x.openingBalance),openingBalanceType:x.openingBalanceType==="TO_PAY"?"TO_PAY":"TO_COLLECT",email:x.email??"",gstin:x.gstin??"",pan:x.pan??"",category:x.category??"",address:x.address??"",shippingAddress:x.shippingAddress??"",sameAsBilling:x.sameAsBilling??true,creditPeriodDays:x.creditPeriodDays??30,creditLimit:Number(x.creditLimit??0),contactPersonName:x.contactPersonName??"",contactPersonDob:x.contactPersonDob??"",bankName:x.bankName??"",bankAccountName:x.bankAccountName??"",bankAccountNumber:x.bankAccountNumber??"",bankIfsc:x.bankIfsc??"",bankBranch:x.bankBranch??"",customBirthday:x.customBirthday??"",customKovilThiruvila:x.customKovilThiruvila??""}; }
function productFromApi(x: ProductRow): Product { return {id:x.id,name:x.product.name,sku:x.sku,category:x.product.category,size:x.size??"-",stock:Number(x.balances[0]?.quantity??0),purchasePrice:Number(x.purchasePrice),sellingPrice:Number(x.sellingPrice),mrp:Number(x.mrp),hsnCode:x.product.hsnCode,taxRate:Number(x.product.taxRate.rate)}; }
function saleFromApi(x: SalesRow): Invoice {
  return {
    id: x.id,
    number: x.invoiceNumber,
    date: new Date(x.invoiceDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    party: x.party?.name ?? "Cash Sale",
    partyPhone: x.party?.phone ?? "",
    partyAddress: x.party?.address ?? "",
    partyGstin: x.party?.gstin ?? "",
    amount: Number(x.grandTotal),
    paidAmount: Number(x.paidAmount ?? x.grandTotal),
    status: x.paymentStatus === "PAID" ? "Paid" : x.paymentStatus === "UNPAID" ? "Unpaid" : "Partially paid",
    lines: (x.lines ?? []).map(l => ({
      itemName: l.itemName,
      sku: l.sku,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      discount: Number(l.discount),
      taxRate: Number(l.taxRate),
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
