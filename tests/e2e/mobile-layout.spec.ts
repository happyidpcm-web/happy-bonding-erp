import { expect, test } from '@playwright/test';

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
