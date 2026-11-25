export const adultSizes = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"] as const;
export const shirtSizes = ["6M", "20", "22", "24", "26", "28", "30", "32", "34", ...adultSizes] as const;
export type ShirtLine = { size: string; quantity: number; halfSleeveQuantity?: number; fullSleeveQuantity?: number; rate: number; photo: string };
export type GroupShirtInput = {
  fabricSupplier?: string; fabricMetres?: number; fabricPrice?: number; transportCost?: number;
  stitchingQuantity?: number; stitchingPrice?: number; vestiPurchaseQuantity: number; vestiPurchaseRate: number;
  groupName: string; customerName: string; phone: string; deliveryDate: string;
  fabric: string; colour: string; sleeve: string; printing: string; notes: string;
  shirtRate: number | null; discount: number; vestiQuantity: number; vestiRate: number;
  photo: string; advance: number; lines: ShirtLine[];
  fabricPaymentStatus?: ProductionPaymentStatus; vestiPaymentStatus?: ProductionPaymentStatus; stitchingPaymentStatus?: StitchingPaymentStatus;
};
export type GroupShirtOrder = GroupShirtInput & { id: string; createdAt: string; status: string };
export const productionPaymentStatuses = ["PENDING", "PURCHASED", "PAID"] as const;
export type ProductionPaymentStatus = typeof productionPaymentStatuses[number];
export const stitchingPaymentStatuses = ["PENDING", "PAID"] as const;
export type StitchingPaymentStatus = typeof stitchingPaymentStatuses[number];
export const productionPaymentStatusLabel = (status?: string) => ({ PENDING: "Not purchased", PURCHASED: "Purchased — not paid", PAID: "Paid" })[status || "PENDING"];
export const stitchingPaymentStatusLabel = (status?: string) => ({ PENDING: "Not paid", PAID: "Paid" })[status || "PENDING"];
export type GroupShirtAmountTransaction = {
  id: string; createdAt: string; groupName: string; customerName: string;
  fabricPurchase: number; vestiPurchase: number; stitching: number;
  productionCost: number; orderSubtotal: number; shirtProfit: number;
};
export type GroupShirtAmountSummary = {
  openingAmount: number; availableAmount: number; fabricPurchase: number; vestiPurchase: number;
  stitching: number; productionCost: number; shirtProfit: number;
  transactions: GroupShirtAmountTransaction[];
};
export const sizeLabel = (size: string) => size === "6M" ? "6 month baby" : ["20", "22", "24", "26", "28", "30"].includes(size) ? `${(Number(size) - 18) / 2} year / ${size}` : size;
export function sleeveQuantities(lines: ShirtLine[]) {
  return lines.reduce((totals, line) => {
    // Orders created before sleeve-wise entry are treated as half sleeve orders.
    const half = line.halfSleeveQuantity ?? (line.fullSleeveQuantity == null ? line.quantity : 0);
    const full = line.fullSleeveQuantity ?? 0;
    return { half: totals.half + half, full: totals.full + full };
  }, { half: 0, full: 0 });
}
export function orderAmounts(order: GroupShirtInput) {
  const round = (n: number) => Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
  const quantity = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const shirts = round(order.shirtRate == null ? order.lines.reduce((sum, line) => sum + line.quantity * line.rate, 0) : quantity * order.shirtRate);
  const vesti = round((order.vestiQuantity || 0) * (order.vestiRate || 0));
  const subtotal = round(shirts + vesti);
  const total = round(subtotal - (order.discount || 0));
  return { quantity, shirts, vesti, subtotal, total, balance: round(total - order.advance) };
}
export function productionAmounts(order: GroupShirtInput) {
  const round = (n: number) => Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
  const fabricTotal = round((order.fabricMetres || 0) * (order.fabricPrice || 0));
  const gst = round(fabricTotal * 0.05);
  const fabricPurchase = round(fabricTotal + gst + (order.transportCost || 0));
  const stitching = round((order.stitchingQuantity || 0) * (order.stitchingPrice || 0));
  const vestiPurchase = round((order.vestiPurchaseQuantity || 0) * (order.vestiPurchaseRate || 0));
  const production = round(fabricPurchase + stitching + vestiPurchase);
  return { fabricTotal, gst, fabricPurchase, stitching, vestiPurchase, production, profit: round(orderAmounts(order).subtotal - production) };
}

/** Only paid production costs reduce the Group Shirt available amount. */
export function paidProductionAmounts(order: GroupShirtInput) {
  const raw = productionAmounts(order);
  const fabricPurchase = order.fabricPaymentStatus === "PAID" ? raw.fabricPurchase : 0;
  const vestiPurchase = order.vestiPaymentStatus === "PAID" ? raw.vestiPurchase : 0;
  const stitching = order.stitchingPaymentStatus === "PAID" ? raw.stitching : 0;
  const production = fabricPurchase + vestiPurchase + stitching;
  return { fabricPurchase, vestiPurchase, stitching, production };
}

/** Branch-level totals for the Group Shirt Amount Transactions screen. */
export function groupShirtAmountTotals(orders: GroupShirtInput[], openingAmount: number): Omit<GroupShirtAmountSummary, "transactions"> {
  const round = (n: number) => Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
  const totals = orders.reduce((result, order) => {
    const costs = paidProductionAmounts(order);
    return {
      fabricPurchase: result.fabricPurchase + costs.fabricPurchase,
      vestiPurchase: result.vestiPurchase + costs.vestiPurchase,
      stitching: result.stitching + costs.stitching,
      productionCost: result.productionCost + costs.production,
      shirtProfit: result.shirtProfit + productionAmounts(order).profit,
    };
  }, { fabricPurchase: 0, vestiPurchase: 0, stitching: 0, productionCost: 0, shirtProfit: 0 });
  return {
    fabricPurchase: round(totals.fabricPurchase),
    vestiPurchase: round(totals.vestiPurchase),
    stitching: round(totals.stitching),
    productionCost: round(totals.productionCost),
    shirtProfit: round(totals.shirtProfit),
    openingAmount: round(openingAmount),
    availableAmount: round(openingAmount - totals.productionCost),
  };
}

export const orderStatuses = ["PROCESSING", "COMPLETED", "DELIVERED"] as const;
export type GroupShirtStatus = typeof orderStatuses[number];
export const normalizedStatus = (status: string): GroupShirtStatus => status === "COMPLETED" || status === "DELIVERED" ? status : "PROCESSING";
export const statusLabel = (status: string) => ({ PROCESSING: "Processing", COMPLETED: "Completed", DELIVERED: "Delivered" })[normalizedStatus(status)];
