import { expect, test } from "@playwright/test";

test("purchase item creation reports save errors and adds the saved item to the draft", async ({ page }) => {
  let created: Record<string, unknown> | undefined;
  let failSave = true;
  await page.route("**/api/products", async route => {
    if (route.request().method() === "POST") {
      if (failSave) {
        failSave = false;
        await route.fulfill({ status: 400, json: { error: "Test save failed" } });
        return;
      }
      const input = route.request().postDataJSON();
      expect(input.name).toBe("Purchase test item");
      expect(input.taxRate).toBe(0);
      expect(input.purchasePrice).toBe(100);
      expect(input.sellingPrice).toBe(150);
      created = { id: "test-purchase-item", sku: input.sku, size: input.size, purchasePrice: "100", sellingPrice: "150", mrp: "150", product: { name: input.name, category: input.category, hsnCode: input.hsnCode, taxRate: { rate: "0" } }, balances: [] };
      await route.fulfill({ status: 201, json: created });
    } else {
      const response = await route.fetch();
      const rows = await response.json();
      await route.fulfill({ response, json: created ? [...rows, created] : rows });
    }
  });
  await page.goto("/");
  await page.getByLabel(/email/i).fill("pcm@happybonding.in");
  await page.getByLabel(/password/i).fill("Pcm@123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("button", { name: "Purchases", exact: true }).click();
  await page.getByRole("button", { name: "Purchase Invoices", exact: true }).click();
  await page.getByRole("button", { name: /Create Purchase/i }).click();
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  await page.getByRole("button", { name: "Create New Item", exact: true }).click();
  await page.getByLabel(/Item Name/).fill("Purchase test item");
  await page.getByLabel("Purchase Price", { exact: true }).fill("100");
  await page.locator("label").filter({ hasText: /^Sales Price/ }).locator("input").fill("150");
  await page.getByLabel("GST Tax Rate(%)").selectOption("0");
  await page.getByRole("button", { name: "Save Item", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Test save failed");
  await page.getByRole("button", { name: "Save Item", exact: true }).click();
  const row = page.locator(".add-items-table tbody tr").filter({ hasText: "Purchase test item" });
  await expect(page.getByRole("columnheader", { name: "Purchase Price", exact: true })).toBeVisible();
  await expect(row.locator("td").nth(4)).toContainText("100");
  await row.getByRole("button", { name: /Add/ }).click();
  await expect(page.locator(".add-items-summary-strip")).toContainText("100");
  await page.getByRole("button", { name: /Add to Bill/ }).click();
  await expect(page.getByRole("heading", { name: "Add Items to Bill" })).toHaveCount(0);
  await expect(page.getByText("Purchase test item", { exact: true })).toBeVisible();
  const price = page.getByLabel("Purchase price for Purchase test item");
  await expect(price).toHaveValue("100");
  const quantity = page.getByLabel("Quantity for Purchase test item", { exact: true });
  await quantity.click();
  await quantity.pressSequentially("30");
  await expect(quantity).toHaveValue("30");
  await expect(page.locator("tr").filter({ has: quantity })).toContainText("3,000");
  await quantity.fill("");
  await expect(quantity).toHaveValue("");
  await quantity.pressSequentially("30");
  await expect(quantity).toHaveValue("30");
  await price.click();
  await price.pressSequentially("315.50");
  await expect(price).toHaveValue("315.50");
  await quantity.click();
  await expect(page.locator("tr").filter({ has: quantity })).toContainText("9,465");
  await quantity.fill("");
  await price.click();
  await expect(quantity).toHaveValue("1");
  await price.fill("90");
  await expect(price).toHaveValue("90");
  await page.getByRole("button", { name: "Add Item", exact: true }).click();
  const existing = page.locator(".add-items-table tbody tr").filter({ hasText: "Purchase test item" });
  await existing.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: /Add to Bill/ }).click();
  await expect(quantity).toHaveValue("2");
  await expect(price).toHaveValue("90");
  await expect(page.getByText("Purchase test item", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Payment Terms (Days)")).toBeVisible();
  await expect(page.getByText("Payment Due Date")).toBeVisible();
});
