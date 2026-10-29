import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hb_erp_token', 'test-only');
    localStorage.setItem('hb_erp_branch', 'test-branch');
  });
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = [];
    if (path === '/api/auth/me') json = { id: 'tester', name: 'Tester', isAdmin: false, branchIds: ['test-branch'] };
    if (path === '/api/branches') json = [{ id: 'test-branch', name: 'Test Branch', code: 'TEST' }];
    if (path === '/api/settings/invoice') json = { business: { name: 'Test Store' } };
    if (path === '/api/parties') json = [
      { id: 'customer', name: 'Customer Due', type: 'CUSTOMER', openingBalance: 100 },
      { id: 'supplier', name: 'Supplier Due', type: 'SUPPLIER', openingBalance: -200 },
      { id: 'settled', name: 'Settled Party', type: 'CUSTOMER', openingBalance: 0 },
    ];
    if (path === '/api/expenses') json = [
      { id: 'rent', category: 'Shop Rent', amount: 1000, paidTo: 'Landlord', paymentMode: 'Cash', expenseDate: '2026-10-29' },
      { id: 'tea', category: 'Tea/Refreshments', amount: 50, paidTo: 'Tea Vendor', paymentMode: 'Cash', expenseDate: '2026-10-29' },
    ];
    await route.fulfill({ json });
  });
  await page.route('https://**/*', route => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
});

test('expense cards filter entries, reset totals, and support keyboard selection', async ({ page }) => {
  await page.getByRole('button', { name: 'Store Expenses', exact: true }).click();
  const total = page.getByRole('button', { name: /Total Expenses/ });
  await expect(total).toContainText('1,050');
  await page.getByRole('button', { name: /Shop Rent/ }).click();
  await expect(page.getByRole('combobox', { name: 'Expense category filter' })).toHaveValue('Shop Rent');
  await expect(page.getByRole('cell', { name: 'Landlord', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Tea Vendor', exact: true })).toHaveCount(0);
  await expect(total).toContainText('1,050');
  await page.getByRole('combobox', { name: 'Expense category filter' }).selectOption('Tea/Refreshments');
  await expect(page.getByRole('button', { name: /Tea \/ Refreshments/ })).toHaveAttribute('aria-pressed', 'true');
  await total.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('cell', { name: 'Landlord', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Tea Vendor', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Electricity/ }).click();
  await expect(page.getByText('No expense entries found.')).toBeVisible();
});

test('dashboard balance card opens the matching balance breakdown', async ({ page }) => {
  await page.getByRole('button', { name: /To Collect/ }).click();
  await expect(page.getByRole('cell', { name: 'Customer Due', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Supplier Due', exact: true })).toHaveCount(0);
});
