import { expect, test } from "@playwright/test";

for (const keepOpen of [false, true]) {
  test(`save${keepOpen ? " and new" : ""} completes without waiting for stock refresh`, async ({ page }) => {
    let saves = 0;
    let salesReads = 0;
    let partyReads = 0;
    let stockRefreshStarted = false;
    let releaseStock!: () => void;
    let releaseSave!: () => void;
    const stockGate = new Promise<void>(resolve => { releaseStock = resolve; });
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    await page.addInitScript(() => {
      localStorage.setItem("hb_erp_token", "browser-test-only");
      localStorage.setItem("hb_erp_branch", "test-branch");
    });
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      let json: unknown = [];
      if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
      if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
      if (path === "/api/settings/invoice") json = { invoicePrefix: "TEST", paymentTermsDays: 30, terms: "" };
      if (path === "/api/sales/next-number") json = { invoiceNumber: `TEST/${saves + 1}`, number: saves + 1 };
      if (path === "/api/parties") partyReads++;
      if (path === "/api/products") {
        if (saves) {
          stockRefreshStarted = true;
          await stockGate;
          await route.fulfill({ status: 503, json: { error: "Stock refresh unavailable" } });
          return;
        }
        json = [{ id: "item-1", sku: "SHIRT", sellingPrice: "100", purchasePrice: "50", mrp: "100", size: "M", product: { name: "Test shirt", category: "Shirts", hsnCode: "6205", taxRate: { rate: "0" } }, balances: [{ quantity: "10" }] }];
      }
      if (path === "/api/sales") {
        if (route.request().method() === "POST") {
          saves++;
          const payload = route.request().postDataJSON();
          await saveGate;
          json = { id: "saved-1", invoiceNumber: "TEST/1", invoiceDate: payload.invoiceDate, party: null, grandTotal: "100", paidAmount: "0", paymentStatus: "UNPAID", lines: [{ variantId: "item-1", itemName: "Test shirt", sku: "SHIRT", quantity: 1, unitPrice: "100", discount: "0", taxRate: "0", total: "100" }] };
        } else salesReads++;
      }
      await route.fulfill({ json });
    });
    try {
      await page.goto("/");
      await page.locator(".new-sale-main-btn").click();
      await expect(page.getByLabel("Invoice Number", { exact: true })).toHaveValue("1");
      await page.getByPlaceholder("+ Search SKU / Name").fill("SHIRT");
      await page.locator(".item-search .search-results button").click();
      const initialSalesReads = salesReads;
      const initialPartyReads = partyReads;
      await page.getByRole("button", { name: keepOpen ? "Save & New" : "Save", exact: true }).first().click();
      await expect.poll(() => saves).toBe(1);
      // Shortcut handlers must also respect an already pending save.
      await page.keyboard.press("Alt+Enter");
      releaseSave();
      await expect.poll(() => stockRefreshStarted).toBe(true);
      if (keepOpen) {
        await expect(page.getByText("No items added", { exact: true })).toBeVisible();
        await expect(page.getByLabel("Invoice Number", { exact: true })).toHaveValue("2");
        await page.getByPlaceholder("+ Search SKU / Name").fill("SHIRT");
        await expect(page.locator(".item-search .search-results")).toContainText("Stock 9");
      } else {
        await expect(page.getByRole("heading", { name: "Sales Invoices", exact: true })).toBeVisible();
        await expect(page.getByText("TEST/1", { exact: true }).first()).toBeVisible();
      }
      expect(saves).toBe(1);
      expect(salesReads).toBe(initialSalesReads);
      expect(partyReads).toBe(initialPartyReads);
      releaseStock();
      await expect(page.getByText("Invoice saved. Stock refresh failed; refresh the page to get the latest stock.", { exact: true })).toBeVisible();
      expect(saves).toBe(1);
    } finally {
      releaseSave();
      releaseStock();
      await page.unrouteAll({ behavior: "wait" });
    }
  });
}
