import { expect, test } from "@playwright/test";

test("item stock and sales history loads independently of the sales list and retries failures", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  let historyUnavailable = true;
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/settings/invoice") json = { business: { name: "Test Store" } };
    if (path === "/api/products") json = [{ id: "item-1", sku: "SHIRT", size: "M", purchasePrice: "100", sellingPrice: "200", mrp: "200", product: { name: "Test Shirt", category: "Shirt", taxRate: { rate: "5" } }, balances: [{ quantity: "10" }] }];
    if (path === "/api/products/item-1/sales-history") {

      if (historyUnavailable) return route.fulfill({ status: 500, json: { error: "History temporarily unavailable" } });
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
  historyUnavailable = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("7 PCS", { exact: true })).toBeVisible();
  await expect(page.getByText("3 PCS", { exact: true })).toBeVisible();
  await expect(page.getByText("Partially paid", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "SALE/001", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Test Shirt", exact: true })).toBeHidden();
  await expect(page.getByText("SALE/001", { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test("adjust stock increases and decreases inventory and displays history", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  let stock = 10;
  let fail = true;
  const adjustments: { id: string; date: string; quantity: number }[] = [];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/settings/invoice") json = { business: { name: "Test Store" } };
    if (path === "/api/products") json = [{ id: "item-1", sku: "SHIRT", size: "M", purchasePrice: "100", sellingPrice: "200", mrp: "200", product: { name: "Test Shirt", category: "Shirt", taxRate: { rate: "5" } }, balances: [{ quantity: stock }] }];
    if (path === "/api/products/item-1/adjust-stock") {
      if (fail) { fail = false; return route.fulfill({ status: 500, json: { error: "Unable to save adjustment" } }); }
      const body = route.request().postDataJSON();
      expect(route.request().headers()["x-branch-id"]).toBe("test-branch");
      const delta = body.quantity * (body.direction === "increase" ? 1 : -1);
      stock += delta;
      adjustments.push({ id: String(adjustments.length), date: "2026-11-13T10:00:00Z", quantity: delta });
      json = { stock };
    }
    if (path === "/api/products/item-1/sales-history") json = { stock, soldQuantity: 0, salesAmount: 0, transactions: [], adjustments };
    await route.fulfill({ json });
  });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Items & Inventory", exact: true }).click();
  await page.getByRole("button", { name: "Actions for Test Shirt" }).click();
  await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete", exact: true })).toBeVisible();
  await page.getByRole("menuitem", { name: "Adjust Stock" }).click();
  await expect(page.getByRole("button", { name: "Save Adjustment" })).toBeDisabled();
  await page.getByLabel("Quantity (PCS)").fill("5");
  await page.getByRole("button", { name: "Save Adjustment" }).click();
  await expect(page.getByRole("alert")).toContainText("Unable to save adjustment");
  await page.getByRole("button", { name: "Save Adjustment" }).click();
  await expect(page.locator(".inventory-stock-quantity")).toContainText("15");
  await page.getByRole("button", { name: "Actions for Test Shirt" }).click();
  await page.getByRole("menuitem", { name: "Adjust Stock" }).click();
  await page.getByLabel("Adjustment type").selectOption("decrease");
  await page.getByLabel("Quantity (PCS)").fill("3");
  await page.getByRole("button", { name: "Save Adjustment" }).click();
  await expect(page.locator(".inventory-stock-quantity")).toContainText("12");
  await page.getByRole("button", { name: "Test Shirt", exact: true }).click();
  await expect(page.getByText("+5 PCS", { exact: true })).toBeVisible();
  await expect(page.getByText("-3 PCS", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Stock increased", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Stock decreased", exact: true })).toBeVisible();
});
