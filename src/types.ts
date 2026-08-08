export type Page = "dashboard" | "parties" | "items" | "sales" | "purchases" | "reports" | "cash" | "pos" | "staff" | "settings";

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

export interface Invoice {
  id: string | number; number: string; date: string; party: string; amount: number;
  status: "Paid" | "Partially paid" | "Unpaid";
}

export interface InvoiceSetting {
  invoicePrefix: string; paymentTermsDays: number; terms: string;
  bankName?: string; accountName?: string; accountNumber?: string; ifsc?: string;
  upiId?: string; qrText?: string; signatureText?: string; signatureUrl?: string;
}
