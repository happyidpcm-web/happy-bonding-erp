import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00+05:30"));
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "browser-test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Test User", email: "test@example.com", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", code: "PCM", name: "Pavoorchatram" }];
    if (path === "/api/settings/invoice") json = { invoicePrefix: "HB/SL", paymentTermsDays: 30, terms: "", bankName: "", accountName: "", accountNumber: "", ifsc: "", upiId: "", qrText: "", signatureText: "", signatureUrl: "" };
    if (path === "/api/sales/next-number") json = { invoiceNumber: "HB/SL/26-27/4", number: 4 };
    if (path === "/api/sales") json = ["2026-09-26", "2026-10-05", "2026-10-08"].map((date, i) => ({ id: String(i), invoiceNumber: "TEST/" + (i + 1), invoiceDate: date + "T00:00:00.000Z", party: { name: "Date test customer" }, grandTotal: "100", paidAmount: "100", paymentStatus: "PAID", lines: [] }));
    await route.fulfill({ json });
  });
});

test("Sales Invoices navigation opens the list after creating and revisiting", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  const openList = async () => {
    const link = page.getByRole("button", { name: "Sales Invoices", exact: true });
    if (!(await link.isVisible())) await page.getByRole("button", { name: "Sales", exact: true }).click();
    await link.click();
    await expect(page.getByRole("heading", { name: "Sales Invoices", exact: true })).toBeVisible();
    await expect(page.locator(".icon-back-btn")).toHaveCount(0);
  };
  await page.locator(".new-sale-main-btn").click();
  await expect(page.locator(".icon-back-btn")).toBeVisible();
  await openList();
  await page.getByRole("button", { name: "Create Sales Invoice", exact: true }).click();
  await expect(page.locator(".icon-back-btn")).toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await openList();
  await page.locator(".new-sale-main-btn").click();
  await expect(page.locator(".icon-back-btn")).toBeVisible();
  await page.locator(".icon-back-btn").click();
  await expect(page.getByRole("heading", { name: "Sales Invoices", exact: true })).toBeVisible();
});

test("date filters combine with search and custom range includes both boundaries", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  const rows = page.locator(".sales-table tbody tr");
  const picker = page.locator(".sales-date-range-btn");
  await expect(page.getByText("TEST/1", { exact: true })).toBeVisible();
  await picker.click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByText("TEST/3", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST/1", { exact: true })).toHaveCount(0);
  await page.getByPlaceholder("Search by invoice number, party...").fill("Date test");
  await expect(page.getByText("TEST/2", { exact: true })).toHaveCount(0);
  await picker.click();
  await page.getByRole("button", { name: "Custom Range", exact: true }).click();
  await page.getByLabel("Select Start Date").fill("2026-09-26");
  await page.getByLabel("End Date", { exact: true }).fill("2026-10-05");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("TEST/1", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST/2", { exact: true })).toBeVisible();
  await expect(page.getByText("TEST/3", { exact: true })).toHaveCount(0);
  await picker.click();
  await page.getByRole("button", { name: "Custom Range", exact: true }).click();
  await page.getByLabel("End Date", { exact: true }).fill("2026-09-01");
  await expect(page.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await page.getByRole("heading", { name: "Sales Invoices", exact: true }).click();
  await expect(page.getByLabel("Select Start Date")).toHaveCount(0);
  await expect(page.getByText("TEST/1", { exact: true })).toBeVisible();
});

test("dropdowns close outside, switch correctly, and preserve inside interactions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await page.locator(".sales-date-range-btn").click();
  await expect(page.locator(".sales-date-popover-menu")).toBeVisible();
  await page.locator(".sales-reports-dropdown-btn").click();
  await expect(page.locator(".sales-date-popover-menu")).toHaveCount(0);
  await expect(page.locator(".sales-context-menu-popover")).toBeVisible();
  await page.getByRole("heading", { name: "Sales Invoices", exact: true }).dispatchEvent("pointerdown", { pointerType: "touch", bubbles: true });
  await expect(page.locator(".sales-context-menu-popover")).toHaveCount(0);
  await page.getByTitle("Quick Create Menu").click();
  await expect(page.locator(".create-tx-dropdown-menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".create-tx-dropdown-menu")).toHaveCount(0);
  await page.getByRole("button", { name: "Items & Inventory", exact: true }).click();
  await page.locator(".parties-reports-dropdown button").first().click();
  await page.locator(".bulk-action-wrap > button").click();
  await expect(page.locator(".parties-reports-dropdown button")).toHaveCount(1);
  await expect(page.locator(".bulk-dropdown-menu")).toBeVisible();
  await page.locator("h1").click();
  await expect(page.locator(".bulk-dropdown-menu")).toHaveCount(0);
});
