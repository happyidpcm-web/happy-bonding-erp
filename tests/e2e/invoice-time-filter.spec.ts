import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";

test("invoice date/time selection carries into reports and Excel exports only matching invoices", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-01T06:00:00Z"));
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
    if (path === "/api/reports/table/sales-summary") {
      const params = new URL(route.request().url()).searchParams;
      expect(params.get("from")).toBe("2026-10-31");
      expect(params.get("to")).toBe("2026-10-31");
      expect(params.get("fromTime")).toBe("10:00");
      expect(params.get("toTime")).toBe("14:00");
      json = { columns: ["Date", "Invoice", "Amount"], moneyColumns: ["Amount"],
        from: "2026-10-31", to: "2026-10-31", note: "",
        rows: [1, 2].map(index => ({ Date: "2026-10-31", Invoice: `TIME/${index}`, Amount: 100 })) };
    }
    await route.fulfill({ json });
  });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await page.getByRole("button", { name: "Date filter", exact: true }).click();
  await page.getByRole("button", { name: "Yesterday", exact: true }).click();
  await page.getByRole("button", { name: "Time filter", exact: true }).click();
  await expect(page.getByLabel("Select Start Date")).toHaveValue("2026-10-31");
  await expect(page.getByLabel("End Date", { exact: true })).toHaveValue("2026-10-31");
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
  expect(rows.map(row => row["Invoice"])).toEqual(["TIME/1", "TIME/2"]);
});
