import type { Invoice, Party, Product } from "./types";

export const products: Product[] = [];
export const parties: Party[] = [];
export const invoices: Invoice[] = [];

export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
