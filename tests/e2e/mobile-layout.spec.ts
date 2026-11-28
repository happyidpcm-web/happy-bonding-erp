import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('mobile navigation, inventory search and invoice controls fit the screen', async ({ page }, testInfo) => {
 await page.addInitScript(() => {
   localStorage.setItem('hb_erp_token', 'test-only');
   localStorage.setItem('hb_erp_branch', 'test-branch');
 });
 await page.route('**/api/**', async route => {
   const path = new URL(route.request().url()).pathname;
   let json: unknown = [];
   if (path === '/api/auth/me') json = { id:'tester', name:'Tester', isAdmin:false, branchIds:['test-branch'] };
   if (path === '/api/branches') json = [{id:'test-branch',name:'Test Branch',code:'TEST'}];
   if (path === '/api/settings/invoice') json = { invoicePrefix:'TEST',paymentTermsDays:30,terms:'' };
   if (path === '/api/sales/next-number') json = { invoiceNumber:'TEST/1',number:1 };
   if (path === '/api/products') json = [{id:'item-1',sku:'LIN-BGY',sellingPrice:'100',purchasePrice:'50',mrp:'100',size:'M',product:{name:'LINEN BAGGY PANT',category:'Pant',hsnCode:'6205',taxRate:{rate:'0'}},balances:[{quantity:'10'}]}];
   await route.fulfill({json});
 });
 await page.route('https://**/*', route => route.abort());
 await page.goto('/');
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.getByRole('button',{name:'Items & Inventory',exact:true}).click();
 const search=page.getByPlaceholder('Search by Item Name, SKU, HSN or Size...');
 await search.fill('pant linen');
 await expect(page.getByRole('button',{name:'LINEN BAGGY PANT',exact:true})).toBeVisible();
 const width=page.viewportSize()!.width;
 for (const selector of ['.topbar','.items-toolbar','.items-search-container']) {
   const box=await page.locator(selector).boundingBox();
   expect(box!.x).toBeGreaterThanOrEqual(0);
   expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
 }
 await page.screenshot({path:testInfo.outputPath('inventory.png'),fullPage:true});
 await page.getByRole('button',{name:'Open navigation'}).click();
 await page.locator('.new-sale-main-btn').click();
 await expect(page.getByLabel('Invoice Number',{exact:true})).toHaveValue('1');
 await page.getByPlaceholder('+ Search SKU / Name').fill('pant linen');
 await page.locator('.item-search .search-results button').click();
 await expect(page.getByRole('button',{name:'Save',exact:true}).first()).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('invoice.png'),fullPage:true});
 const overflows = await page.locator('.page').evaluate(root => [...root.querySelectorAll('input, button')].filter(el => {
   const r=el.getBoundingClientRect();
   return r.width>0 && r.height>0 && r.x >= 0 && r.right>innerWidth+2 && !el.closest('.table-scroll, .cart-table, .invoice-items-table, .ref-items-table-wrap');
 }).map(el=>({text:el.textContent?.slice(0,45),class:el.className})));
 expect(overflows).toEqual([]);
});

test('invoice pagination keeps search and totals across all invoices', async ({ page }) => {
 await page.addInitScript(() => { localStorage.setItem('hb_erp_token','test-only'); localStorage.setItem('hb_erp_branch','test-branch'); });
 await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  let json: unknown = [];
  if(path === '/api/auth/me') json = {id:'tester',name:'Tester',isAdmin:false,branchIds:['test-branch']};
  if(path === '/api/branches') json = [{id:'test-branch',name:'Test Branch',code:'TEST'}];
  if(path === '/api/settings/invoice') json = {invoicePrefix:'TEST',paymentTermsDays:30,terms:''};
  if(path === '/api/sales') json = Array.from({length:125},(_,i)=>({id:'inv-'+i,invoiceNumber:'TEST/'+(i+1),invoiceDate:new Date().toISOString(),grandTotal:'100',paidAmount:'100',paymentStatus:'PAID',status:'POSTED',party:{name:'Customer '+(i+1)},lines:[]}));
  await route.fulfill({json});
 });
 await page.route('https://**/*', route=>route.abort());
 await page.goto('/');
 await page.getByRole('button',{name:'Open navigation',exact:true}).click();
 await page.getByRole('button',{name:'Sales',exact:true}).click();
 const rows=page.locator('.sales-invoices-main-table tbody tr');
 await expect(rows).toHaveCount(50);
 await expect(page.locator('.invoice-list-pagination')).toContainText('1\u201350 of 125');
 const total=await page.locator('.sales-summary-card-val').first().innerText();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.locator('.invoice-list-pagination')).toContainText('51\u2013100 of 125');
 await expect(page.locator('.sales-summary-card-val').first()).toHaveText(total);
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(rows).toHaveCount(25);
 await page.getByPlaceholder('Search by invoice number, party...').fill('TEST/125');
 await expect(rows).toHaveCount(1);
 await expect(rows.first()).toContainText('TEST/125');
});
