import { expect, test } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel(/email/i).fill("admin@happybonding.in");
  await page.getByLabel(/password/i).fill("HappyBonding@2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText("Current branch")).toBeVisible();
}

async function openGroup(page: import("@playwright/test").Page, group: "Sales" | "Purchases", child: string) {
  if (!(await page.getByRole("button", { name: child, exact: true }).count())) {
    await page.getByRole("button", { name: new RegExp(`^${group}$`) }).click();
  }
}

test("owner can navigate core ERP routes and open key actions", async ({ page }) => {
  await login(page);
  await page.getByTitle("Sync Offline Changes").click();

  const routeLabels = [
    "Dashboard",
    "Parties",
    "Items & Inventory",
    "Sales Invoices",
    "Payment In",
    "Purchase Invoices",
    "Payment Out",
    "Purchase Return",
    "Debit Note",
    "Purchase Orders",
    "Expenses",
    "Reports",
    "Cash & Bank",
    "POS Billing",
    "Settings",
  ];

  for (const label of routeLabels) {
    if (["Sales Invoices", "Payment In"].includes(label)) await openGroup(page, "Sales", label);
    if (["Purchase Invoices", "Payment Out", "Purchase Return", "Debit Note", "Purchase Orders", "Expenses"].includes(label)) await openGroup(page, "Purchases", label);
    await page.getByRole("button", { name: label, exact: true }).first().click();
    await expect(page.locator("main")).toBeVisible();
  }

  await openGroup(page, "Sales", "Sales Invoices");
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Sales Invoice", exact: true })).toBeVisible();
  await openGroup(page, "Purchases", "Purchase Invoices");
  await page.getByRole("button", { name: "Purchase Invoices", exact: true }).click();
  await expect(page.getByRole("button", { name: /Create Purchase/i })).toBeVisible();
});

test.skip("sales and purchase row action menus expose view print delete controls when rows exist", async ({ page }) => {
  await login(page);

  await openGroup(page, "Sales", "Sales Invoices");
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Sales Invoice", exact: true })).toBeVisible();
  if (await page.locator(".sales-dots-menu-btn").count()) {
    await page.locator(".sales-dots-menu-btn").first().click();
    await expect(page.getByRole("button", { name: /View Invoice/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Print PDF/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Delete Invoice/i })).toBeVisible();
  }

  await openGroup(page, "Purchases", "Purchase Invoices");
  await page.getByRole("button", { name: "Purchase Invoices", exact: true }).click();
  await expect(page.getByRole("button", { name: /Create Purchase/i })).toBeVisible();
  if (await page.locator("button[title='Delete']").count()) {
    await expect(page.locator("button[title='Delete']").first()).toBeVisible();
  }
});
