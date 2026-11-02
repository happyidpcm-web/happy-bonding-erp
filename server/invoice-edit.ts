import type { SalesInvoice, SalesInvoiceLine } from "@prisma/client";
import type { z } from "zod";
import type { invoiceInput } from "./validation.js";

type Input = z.infer<typeof invoiceInput>;
type Saved = Pick<SalesInvoice, "invoiceDiscount" | "additionalCharges" | "placeOfSupply"> & { lines: SalesInvoiceLine[] };

// Compare a multiset, since database relation order is not guaranteed and the
// same variant can appear on multiple lines with different prices/discounts.
export function planInvoiceEdit(saved: Saved, input: Input) {
  const remaining = [...saved.lines];
  const sameLines = input.lines.length === remaining.length && input.lines.every(line => {
    const index = remaining.findIndex(old => old.variantId === line.variantId
      && Number(old.quantity) === line.quantity
      && Number(old.unitPrice) === line.unitPrice
      && Number(old.discount) === line.discount
      && (line.mrp === undefined || Number(old.mrp) === line.mrp)
      && (line.taxRate === undefined || Number(old.taxRate) === line.taxRate));
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
  const oldQuantities = quantities(saved.lines);
  const newQuantities = quantities(input.lines);
  const stockChanged = oldQuantities.size !== newQuantities.size
    || [...oldQuantities].some(([id, qty]) => newQuantities.get(id) !== qty);
  const linesChanged = !sameLines || Number(saved.invoiceDiscount) !== input.invoiceDiscount
    || saved.placeOfSupply !== input.placeOfSupply;
  return {
    stockChanged,
    linesChanged,
    totalsChanged: linesChanged || Number(saved.additionalCharges) !== input.additionalCharges,
    newQuantities,
  };
}

function quantities(lines: Array<{ variantId: string; quantity: unknown }>) {
  const result = new Map<string, number>();
  for (const line of lines) {
    // Stock quantities are stored to three decimal places.
    result.set(line.variantId, Math.round(((result.get(line.variantId) ?? 0) + Number(line.quantity)) * 1000) / 1000);
  }
  return result;
}
