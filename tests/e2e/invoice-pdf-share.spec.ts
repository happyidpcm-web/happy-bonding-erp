import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hb_erp_token", "browser-test-only");
    localStorage.setItem("hb_erp_branch", "test-branch");
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const invoice = { id: "pdf-test", invoiceNumber: "TEST/26-27/42", invoiceDate: "2026-10-28T08:00:00.000Z", party: { name: "PDF Customer", phone: "9876543210" }, grandTotal: "599", paidAmount: "599", paymentStatus: "PAID", lines: [{ itemName: "Test shirt", sku: "SHIRT", quantity: 1, unitPrice: "599", mrp: "649", discount: "0", taxRate: "0", total: "599" }] };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === "/api/auth/me") json = { id: "tester", name: "Tester", isAdmin: false, branchIds: ["test-branch"] };
    if (path === "/api/branches") json = [{ id: "test-branch", name: "Test Branch", code: "TEST" }];
    if (path === "/api/settings/invoice") json = { invoicePrefix: "TEST", paymentTermsDays: 30, terms: "Thank you", business: { name: "Happy Bonding", address: "Test address", phone: "1234567890", pan: "TEST", gstin: "TEST" } };
    if (path === "/api/sales") json = [invoice];
    if (path === "/api/sales/pdf-test") json = invoice;
    await route.fulfill({ json });
  });
  await page.route("https://**/*", route => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Sales", exact: true }).click();
  await page.getByRole("button", { name: "Sales Invoices", exact: true }).click();
  await page.getByText("TEST/26-27/42", { exact: true }).first().click();
  await expect(page.locator(".full-invoice-top-bar")).toBeVisible();
});

test("desktop Share creates a real invoice PDF and opens the correct customer chat", async ({ page }, testInfo) => {
  await page.locator(".full-invoice-top-bar").getByRole("button", { name: "Share PDF", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share invoice PDF" });
  await expect(dialog.getByText("Invoice_TEST_26-27_42.pdf", { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(dialog).toContainText("This browser cannot share PDF files directly");
  const downloadEvent = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadEvent;
  await download.saveAs(testInfo.outputPath("invoice.pdf"));
  await page.screenshot({ path: testInfo.outputPath("share-dialog.png") });
  expect(download.suggestedFilename()).toBe("Invoice_TEST_26-27_42.pdf");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeGreaterThan(10000);
  const link = new URL((await dialog.getByRole("link", { name: "Open Customer WhatsApp" }).getAttribute("href"))!);
  expect(link.hostname).toBe("wa.me");
  expect(link.pathname).toBe("/919876543210");
  expect(link.searchParams.has("text")).toBe(false);
});

test("native share failure offers download without claiming the invoice was sent", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => { throw new DOMException("Blocked", "NotAllowedError"); } });
  });
  await page.locator(".full-invoice-top-bar").getByRole("button", { name: "Share PDF", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share invoice PDF" });
  await dialog.getByRole("button", { name: "Share PDF on WhatsApp", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Download the PDF and attach it in WhatsApp");
  await expect(dialog.getByRole("button", { name: "Download PDF", exact: true })).toBeEnabled();
  await expect(dialog.getByRole("link", { name: "Open Customer WhatsApp" })).toBeVisible();
});

test("native sharing includes a PDF file; cancellation preserves it for retry", async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (data: ShareData) => {
      const file = data.files![0];
      (window as any).__sharedPdf = { name: file.name, type: file.type, size: file.size, active: navigator.userActivation.isActive, text: data.text };
      throw new DOMException("Cancelled", "AbortError");
    } });
  });
  await page.locator(".full-invoice-top-bar").getByRole("button", { name: "Share PDF", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Share invoice PDF" });
  const share = dialog.getByRole("button", { name: "Share PDF on WhatsApp", exact: true });
  const customerChat = dialog.getByRole("link", { name: "Open Customer WhatsApp" });
  await expect(customerChat).toBeVisible();
  expect(new URL((await customerChat.getAttribute("href"))!).pathname).toBe("/919876543210");
  await expect(share).toBeVisible({ timeout: 20000 });
  await share.click();
  const data = await page.evaluate(() => (window as any).__sharedPdf);
  expect(data.name).toBe("Invoice_TEST_26-27_42.pdf");
  expect(data.type).toBe("application/pdf");
  expect(data.size).toBeGreaterThan(10000);
  expect(data.active).toBe(true);
  expect(data.text).toBeUndefined();
  await expect(share).toBeEnabled();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test('download completes even when font readiness stays pending', async ({page}) => {
 await page.evaluate(() => Object.defineProperty(document.fonts, 'ready', {configurable:true,get:()=>new Promise(()=>{})}));
 const download=page.waitForEvent('download');
 await page.locator('.full-invoice-top-bar').getByRole('button',{name:'Download PDF',exact:true}).click();
 expect((await download).suggestedFilename()).toContain('.pdf');
});
