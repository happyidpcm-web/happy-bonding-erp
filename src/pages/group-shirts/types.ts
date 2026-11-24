export const adultSizes = ["S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"] as const;
export const shirtSizes = ["6M", "20", "22", "24", "26", "28", "30", "32", "34", ...adultSizes] as const;
export type ShirtLine = { size: string; quantity: number; rate: number; photo: string };
export type GroupShirtInput = {
  fabricSupplier?: string; fabricMetres?: number; fabricPrice?: number; transportCost?: number;
  stitchingQuantity?: number; stitchingPrice?: number; vestiPurchaseQuantity: number; vestiPurchaseRate: number;
  groupName: string; customerName: string; phone: string; deliveryDate: string;
  fabric: string; colour: string; sleeve: string; printing: string; notes: string;
  shirtRate: number | null; discount: number; vestiQuantity: number; vestiRate: number;
  photo: string; advance: number; lines: ShirtLine[];
};
export type GroupShirtOrder = GroupShirtInput & { id: string; createdAt: string; status: string };
export const sizeLabel = (size: string) => size === "6M" ? "6 month baby" : ["20", "22", "24", "26", "28", "30"].includes(size) ? `${(Number(size) - 18) / 2} year / ${size}` : size;
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

export const orderStatuses = ["PROCESSING", "COMPLETED", "DELIVERED"] as const;
export type GroupShirtStatus = typeof orderStatuses[number];
export const normalizedStatus = (status: string): GroupShirtStatus => status === "COMPLETED" || status === "DELIVERED" ? status : "PROCESSING";
export const statusLabel = (status: string) => ({ PROCESSING: "Processing", COMPLETED: "Completed", DELIVERED: "Delivered" })[normalizedStatus(status)];
