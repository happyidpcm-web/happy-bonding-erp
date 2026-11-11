import { expect, test } from "@playwright/test";

test("item stock and sales history loads independently of the sales list and retries failures", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  let requests = 0;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/settings/invoice") json = { business: { name: "Test Store" } };
    if (path === "/api/products") json = [{ id: "item-1", sku: "SHIRT", size: "M", purchasePrice: "100", sellingPrice: "200", mrp: "200", product: { name: "Test Shirt", category: "Shirt", taxRate: { rate: "5" } }, balances: [{ quantity: "10" }] }];
    if (path === "/api/products/item-1/sales-history") {
      requests++;
      if (requests === 1) return route.fulfill({ status: 500, json: { error: "History temporarily unavailable" } });
      json = { stock: 7, soldQuantity: 3, salesAmount: 600, transactions: [{ id: "invoice-1", number: "SALE/001", date: "2026-11-11T00:00:00Z", party: "Test Buyer", status: "PARTIALLY_PAID", quantity: 3, amount: 600 }] };
    }
    if (path === "/api/sales/invoice-1") json = { id: "invoice-1", invoiceNumber: "SALE/001", invoiceDate: "2026-11-11T00:00:00Z", grandTotal: "600", paidAmount: "200", paymentStatus: "PARTIALLY_PAID", party: { name: "Test Buyer" }, lines: [] };
    await route.fulfill({ json });
  });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Items & Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Test Shirt", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("History temporarily unavailable");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("7 PCS", { exact: true })).toBeVisible();
  await expect(page.getByText("3 PCS", { exact: true })).toBeVisible();
  await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SALE/001", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Shirt", exact: true })).toBeHidden();
  await expect(page.getByText("SALE/001", { exact: true }).first()).toBeVisible();
});
