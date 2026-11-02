import { expect, test } from '@playwright/test';

test('item summary loads backend quantities, date presets, custom range, export, empty and retry states', async ({ page }) => {
  let fail = false;
  const queries: URLSearchParams[] = [];
  await page.addInitScript(() => {
    localStorage.setItem('hb_erp_token', 'test-only'); localStorage.setItem('hb_erp_branch', 'test-branch');
  });
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let json: unknown = [];
    if (url.pathname === '/api/auth/me') json = { id: 'tester', name: 'Tester', isAdmin: false, branchIds: ['test-branch'] };
    if (url.pathname === '/api/branches') json = [{ id: 'test-branch', name: 'Test Branch', code: 'TEST' }];
    if (url.pathname === '/api/settings/invoice') json = { business: { name: 'Test Store' } };
    if (url.pathname === '/api/reports/item-summary') {
      expect(route.request().headers()['x-branch-id']).toBe('test-branch');
      queries.push(url.searchParams);
      if (fail) return route.fulfill({ status: 500, json: { error: 'Report temporarily unavailable' } });
      json = { from: '2026-11-02', to: '2026-11-02', rows: url.searchParams.get('filter') === 'Yesterday' ? [] : [
        { id: 'shirt', name: 'Test Shirt', sku: 'SHIRT-M', size: 'M', category: 'Shirts', salesQty: 3, purchaseQty: 12, salesAmount: 900, purchaseAmount: 2400 },
      ] };
    }
    if (url.pathname.startsWith('/api/reports/table/')) json = {
      rows: [{ Reference: 'Backend record', Amount: 123 }], columns: ['Reference', 'Amount'], moneyColumns: ['Amount'], note: '', from: '2026-11-02', to: '2026-11-02',
    };
    await route.fulfill({ json });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page.getByText('Item Sales and Purchase Summary', { exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Test Shirt', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '12', exact: true })).toBeVisible();
  for (const filter of ['Yesterday', 'This Week', 'Last Week', 'Today']) {
    await page.getByRole('button', { name: 'Date filter' }).click();
    await page.getByRole('button', { name: filter, exact: true }).click();
    await expect.poll(() => queries.at(-1)?.get('filter')).toBe(filter);
    if (filter === 'Yesterday') await expect(page.getByText('No sales or purchases match this date range and filters.')).toBeVisible();
    else await expect(page.getByRole('cell', { name: 'Test Shirt', exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Date filter' }).click();
  await page.getByRole('button', { name: 'Custom Range', exact: true }).click();
  await page.getByLabel('Select Start Date').fill('2026-10-01');
  await page.getByLabel('End Date', { exact: true }).fill('2026-10-31');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('from')).toBe('2026-10-01');
  await expect.poll(() => queries.at(-1)?.get('to')).toBe('2026-10-31');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/item_sales_purchase.*xlsx/);
  fail = true;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Report temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Download Excel' })).toBeDisabled();
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Test Shirt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  for (const title of ['Purchase Summary', 'Expense Category Report', 'Expense Transaction Report', 'Item Report By Party', 'Party Report By Item', 'Bill Wise Profit']) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Backend record', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
  }
});
