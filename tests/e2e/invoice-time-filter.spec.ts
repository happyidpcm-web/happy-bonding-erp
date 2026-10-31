import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

test("invoice date/time selection carries into reports and Excel exports only matching invoices", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/settings/invoice") json = { business: { name: "Test Store" } };
    if (path === "/api/sales") json = ["04:29", "04:30", "08:30", "08:31"].map((time, index) => ({
      id: String(index), invoiceNumber: `TIME/${index}`, invoiceDate: "2026-10-31T00:00:00.000Z",
      createdAt: `2026-10-31T${time}:00.000Z`, party: { name: `Customer ${index}` },
      grandTotal: "100", paidAmount: "100", paymentStatus: "PAID",
    }));
    await route.fulfill({ json });
  });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await page.locator(".sales-date-range-btn").click();
  await page.getByRole("button", { name: "Custom Range", exact: true }).click();
  await page.getByLabel("Select Start Date").fill("2026-10-31");
  await page.getByLabel("End Date", { exact: true }).fill("2026-10-31");
  await page.getByLabel("From Time").fill("14:01");
  await page.getByLabel("To Time").fill("14:00");
  await expect(page.getByRole("button", { name: "OK", exact: true })).toBeDisabled();
  await page.getByLabel("From Time").fill("10:00");
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByText("TIME/0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("TIME/1", { exact: true })).toBeVisible();
  await expect(page.getByText("TIME/2", { exact: true })).toBeVisible();
  await expect(page.getByText("TIME/3", { exact: true })).toHaveCount(0);
  await page.locator(".sales-reports-dropdown-btn").click();
  await page.getByRole("button", { name: "Sales Summary", exact: true }).click();
  await expect(page.getByRole("button", { name: "Date filter", exact: true })).toContainText("10:00 - 31 Oct 2026 14:00 IST");
  await expect(page.getByText("TIME/0", { exact: true })).toHaveCount(0);
  await expect(page.getByText("TIME/1", { exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download Excel/ }).click();
  const download = await downloadEvent;
  const workbook = XLSX.read(await readFile((await download.path())!), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
  expect(rows.map(row => row["INVOICE NO"])).toEqual(["TIME/1", "TIME/2"]);
  expect(rows.map(row => row["TIME (IST)"])).toEqual(["10:00", "14:00"]);
});
