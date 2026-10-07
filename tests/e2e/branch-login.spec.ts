import { expect, test } from "@playwright/test";

for (const account of [
  { email: "pcm@happybonding.in", password: "Pcm@123", owner: false },
  { email: "adminambai@happybonding.in", password: "Ambai@123", owner: false },
  { email: "admin@happybonding.in", password: "HappyBonding@2026", owner: true },
]) {
  test(`${account.email} opens its workspace after login and reload`, async ({ page }) => {
    const summaryStatuses: number[] = [];
    const failedRequests: string[] = [];
    page.on("response", response => {
      if (response.url().endsWith("/owner/summary")) summaryStatuses.push(response.status());
      if (response.url().includes("/api/") && response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });
    await page.goto("/");
    await page.getByLabel(/email/i).fill(account.email);
    await page.getByLabel(/password/i).fill(account.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.locator(".app-shell")).toBeVisible();
    if (account.owner) {
      await expect(page.locator('select').filter({ has: page.locator('option', { hasText: 'Pavoorchatram' }) }).first().locator('option:checked')).toHaveText('Pavoorchatram');
      // An existing session last used in Ambai must also open Pavoorchatram.
      await page.evaluate(() => {
        const option = Array.from(document.querySelectorAll('option')).find(o => o.textContent === 'AMBASAMUDRAM');
        if (!option) throw new Error('Ambai fixture missing');
        localStorage.setItem('hb_erp_branch', option.value);
      });
    }
    await page.reload();
    await expect(page.locator(".app-shell")).toBeVisible();
    if (account.owner) {
      await expect(page.locator('select').filter({ has: page.locator('option', { hasText: 'Pavoorchatram' }) }).first().locator('option:checked')).toHaveText('Pavoorchatram');
    }
    expect(failedRequests).toEqual([]);
    if (account.owner) {
      expect(summaryStatuses.length).toBeGreaterThanOrEqual(2);
      expect(summaryStatuses.every(status => status === 200)).toBe(true);
    } else {
      expect(summaryStatuses).toEqual([]);
    }
  });
}
