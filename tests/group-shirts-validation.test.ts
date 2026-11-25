import assert from "node:assert/strict";
import { test } from "node:test";
import { groupShirtInput, groupShirtStatusInput } from "../server/group-shirts.js";
import { groupShirtAmountTotals, orderAmounts, productionAmounts, shirtSizes, sleeveQuantities, normalizedStatus } from "../src/pages/group-shirts/types.js";

const valid = () => ({ groupName: "Family function", customerName: "Customer", phone: "9876543210", deliveryDate: "2026-12-10", fabric: "Cotton", colour: "Blue", sleeve: "Half sleeve", printing: "Logo on pocket", notes: "", photo: "", advance: 100, shirtRate: 200, discount: 0, vestiQuantity: 0, vestiRate: 0, lines: shirtSizes.map(size => ({ size, quantity: size === "20" ? 2 : 0, rate: 0, photo: "" })) });
test("accepts kids and adult size breakdown", () => { assert.equal(groupShirtInput.safeParse(valid()).success, true); });
test("rejects zero quantities, duplicate sizes, fractional quantities and excess advance", () => {
  const empty = valid(); empty.lines.forEach(line => { line.quantity = 0; }); empty.advance = 0;
  const duplicate = valid(); duplicate.lines[1].size = "6M";
  const fractional = valid(); fractional.lines[0].quantity = 1.5;
  const advance = valid(); advance.advance = 401;
  for (const input of [empty, duplicate, fractional, advance]) assert.equal(groupShirtInput.safeParse(input).success, false);
});
test("rejects invalid dates and non-image uploads", () => {
  assert.equal(groupShirtInput.safeParse({ ...valid(), deliveryDate: "2026-02-30" }).success, false);
  assert.equal(groupShirtInput.safeParse({ ...valid(), photo: "data:text/html;base64,AAAA" }).success, false);
});
test("calculates shirts plus optional vesti, discount and remaining amount", () => {
  const input = { ...valid(), vestiQuantity: 3, vestiRate: 150, discount: 50, advance: 200 };
  assert.deepEqual(orderAmounts(input), { quantity: 2, shirts: 400, vesti: 450, subtotal: 850, total: 800, balance: 600 });
  assert.equal(groupShirtInput.safeParse(input).success, true);
  assert.equal(groupShirtInput.safeParse({ ...input, discount: 851 }).success, false);
  assert.equal(groupShirtInput.safeParse({ ...input, advance: 801 }).success, false);
  assert.equal(groupShirtInput.safeParse({ ...input, vestiQuantity: -1 }).success, false);
});
test("preserves legacy per-size totals and rounds currency", () => {
  const input = valid(); input.lines[1].rate = 123.45;
  assert.equal(orderAmounts({ ...input, shirtRate: null }).total, 246.9);
  assert.equal(orderAmounts({ ...input, shirtRate: 0.1, discount: 0.1 }).total, 0.1);
});
test("calculates fabric GST, transport, stitching and pre-discount profit", () => {
  const input = { ...valid(), shirtRate: 1000, fabricSupplier: "Fabric supplier", fabricMetres: 10, fabricPrice: 100, transportCost: 50, stitchingQuantity: 2, stitchingPrice: 150, discount: 200 };
  assert.deepEqual(productionAmounts(input), { fabricTotal: 1000, gst: 50, fabricPurchase: 1100, stitching: 300, vestiPurchase: 0, production: 1400, profit: 600 });
  const parsed = groupShirtInput.parse(input);
  assert.equal(parsed.fabricSupplier, "Fabric supplier");
  assert.equal(parsed.stitchingQuantity, 2);
  assert.equal(productionAmounts({ ...input, advance: 1000 }).profit, 600);
  assert.equal(productionAmounts({ ...input, transportCost: 1000 }).profit, -350);
});
test("rounds fractional fabric costs and supports orders without production details", () => {
  const amounts = productionAmounts({ ...valid(), fabricMetres: 2.5, fabricPrice: 19.99, transportCost: 10.25, stitchingQuantity: 2, stitchingPrice: 30.5 });
  assert.equal(amounts.fabricTotal, 49.98);
  assert.equal(amounts.gst, 2.5);
  assert.equal(amounts.production, 123.73);
  assert.equal(amounts.profit, 276.27);
  assert.equal(productionAmounts(valid()).production, 0);
});
test("rejects negative production costs and fractional stitching quantities", () => {
  for (const key of ["fabricMetres", "fabricPrice", "transportCost", "stitchingQuantity", "stitchingPrice"]) {
    assert.equal(groupShirtInput.safeParse({ ...valid(), [key]: -1 }).success, false);
  }
  assert.equal(groupShirtInput.safeParse({ ...valid(), stitchingQuantity: 1.5 }).success, false);
});

test("accepts and totals adult sizes through 7XL", () => {
  const input = valid();
  for (const size of ["3XL", "4XL", "5XL", "6XL", "7XL"]) input.lines.find(line => line.size === size)!.quantity = 1;
  assert.equal(groupShirtInput.safeParse(input).success, true);
  assert.equal(orderAmounts(input).quantity, 7);
  assert.equal(orderAmounts(input).shirts, 1400);
  assert.equal(groupShirtInput.safeParse({ ...input, lines: input.lines.slice(0, -1) }).success, false);
});

test("validates status updates without allowing unrelated order changes", () => {
  for (const status of ["PROCESSING", "COMPLETED", "DELIVERED"]) assert.equal(groupShirtStatusInput.safeParse({ status }).success, true);
  for (const input of [{ status: "UNKNOWN" }, {}, { status: "DELIVERED", advance: 0 }]) assert.equal(groupShirtStatusInput.safeParse(input).success, false);
});
test("includes legacy confirmed orders in pending and keeps completed and delivered distinct", () => {
  const statuses = ["CONFIRMED", "PENDING", "PROCESSING", "COMPLETED", "DELIVERED"].map(normalizedStatus);
  assert.equal(statuses.filter(status => status === "PROCESSING").length, 3);
  assert.equal(statuses.filter(status => status === "COMPLETED").length, 1);
  assert.equal(statuses.filter(status => status === "DELIVERED").length, 1);
});
test("stores independent half and full sleeve quantities for every size", () => {
  const input = valid();
  const size = input.lines.find(line => line.size === "M")!;
  size.quantity = 5; size.halfSleeveQuantity = 2; size.fullSleeveQuantity = 3;
  assert.equal(groupShirtInput.safeParse(input).success, true);
  assert.deepEqual(sleeveQuantities(input.lines), { half: 4, full: 3 });
  assert.equal(orderAmounts(input).quantity, 7);
  size.quantity = 4;
  assert.equal(groupShirtInput.safeParse(input).success, false);
});

test("totals Group Shirt opening amount, production costs and profit from orders", () => {
  const first = { ...valid(), shirtRate: 1000, fabricMetres: 10, fabricPrice: 100, stitchingQuantity: 2, stitchingPrice: 100, vestiPurchaseQuantity: 2, vestiPurchaseRate: 50, fabricPaymentStatus: "PAID" as const, vestiPaymentStatus: "PAID" as const, stitchingPaymentStatus: "PAID" as const };
  const second = { ...valid(), shirtRate: 500, fabricMetres: 2, fabricPrice: 100, transportCost: 20, stitchingQuantity: 1, stitchingPrice: 75, fabricPaymentStatus: "PURCHASED" as const, vestiPaymentStatus: "PENDING" as const, stitchingPaymentStatus: "PENDING" as const };
  assert.deepEqual(groupShirtAmountTotals([first, second], 5000), {
    openingAmount: 5000, availableAmount: 3650,
    fabricPurchase: 1050, vestiPurchase: 100, stitching: 200, productionCost: 1350, shirtProfit: 1345,
  });
});

test("only paid production stages reduce the available Group Shirt amount", () => {
  const order = { ...valid(), shirtRate: 1000, fabricMetres: 10, fabricPrice: 100, stitchingQuantity: 2, stitchingPrice: 100, fabricPaymentStatus: "PURCHASED" as const, vestiPaymentStatus: "PENDING" as const, stitchingPaymentStatus: "PAID" as const };
  assert.deepEqual(groupShirtAmountTotals([order], 2000), {
    openingAmount: 2000, availableAmount: 1800,
    fabricPurchase: 0, vestiPurchase: 0, stitching: 200, productionCost: 200, shirtProfit: 750,
  });
});
