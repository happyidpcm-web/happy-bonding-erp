export type Page =
  | "dashboard" | "parties" | "items" | "sales" | "purchases" | "reports" | "cash" | "pos" | "staff" | "settings"
  | "quotation" | "payment_in" | "sales_return" | "credit_note" | "delivery_challan" | "proforma_invoice"
  | "payment_out" | "purchase_return" | "debit_note" | "purchase_orders" | "expenses" | "reminders";

export interface Expense {
  id: string;
  category: string;
  amount: number;
  paymentMode: string;
  paidTo?: string;
  notes?: string;
  expenseDate: string;
}

export interface Product {
  id: string | number; name: string; sku: string; category: string; size: string;
  stock: number; purchasePrice: number; sellingPrice: number; mrp: number; hsnCode?: string; taxRate?: number;
}

export interface Party {
  id: string | number; name: string; phone: string; type: "Customer" | "Supplier"; balance: number;
  email?: string; gstin?: string; pan?: string; category?: string; address?: string; shippingAddress?: string; sameAsBilling?: boolean;
  openingBalanceType?: "TO_COLLECT" | "TO_PAY"; creditPeriodDays?: number; creditLimit?: number;
  contactPersonName?: string; contactPersonDob?: string;
  bankName?: string; bankAccountName?: string; bankAccountNumber?: string; bankIfsc?: string; bankBranch?: string;
  customBirthday?: string; customKovilThiruvila?: string;
}

export interface InvoiceLineItem {
  itemName: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  purchasePrice?: number;
  discount: number;
  taxRate: number;
  taxableAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total: number;
}

export interface Invoice {
  id: string | number;
  number: string;
  date: string;
  party: string;
  partyId?: string;
  partyPhone?: string;
  partyAddress?: string;
  partyGstin?: string;
  amount: number;
  paidAmount?: number;
  paymentMode?: string;
  subtotal?: number;
  discountTotal?: number;
  invoiceDiscount?: number;
  additionalCharges?: number;
  taxableTotal?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  igstTotal?: number;
  notes?: string;
  dueDate?: string;
  status: "Paid" | "Partially paid" | "Unpaid" | "Cancelled";
  dueDays?: number;
  lines?: InvoiceLineItem[];
  payments?: { amount: number; payment: { paidAt: string; mode: string; } }[];
}

export interface InvoiceSetting {
  invoicePrefix: string; paymentTermsDays: number; terms: string;
  bankName?: string; accountName?: string; accountNumber?: string; ifsc?: string;
  upiId?: string; qrText?: string; signatureText?: string; signatureUrl?: string;
  sequenceNumber?: string; showPurchasePrice?: boolean; showItemImage?: boolean; priceHistory?: boolean; theme?: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface OwnerBranchSummary {
  branchId: string;
  branchName: string;
  code: string;
  salesTotal: number;
  paymentIn: number;
  paymentOut: number;
  stockQty: number;
  invoiceCount: number;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  branches: Branch[];
}
