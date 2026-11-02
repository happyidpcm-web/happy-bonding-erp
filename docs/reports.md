# Reports

The reports API requires an authenticated session, `reports.read` permission (or owner permission), and an authorized branch. Report queries are scoped to the organization and selected branch.

## Item Sales and Purchase Summary

`GET /api/reports/item-summary` aggregates posted sales invoice lines and saved Purchase Invoice vouchers. It uses variant IDs, including inactive variants, and includes purchase-only items. Draft/cancelled sales, quotations, orders, opening stock, and stock adjustments are excluded. Quantities are gross before returns. Amounts are saved line totals, including line tax and discounts, excluding bill-level adjustments. Standalone legacy stock receipts without a purchase voucher are inventory movements, not invoiced purchases; view them in Stock Detail Report.

Filters include Today, Yesterday, This Week, Last Week, rolling ranges, months, quarters, fiscal years and Custom Range. Today is determined in Asia/Kolkata. Weeks run Sunday–Saturday, matching the existing application. Invoice dates are calendar dates; optional time filters use the creation time in IST, matching the application's sales display. Custom ranges include both boundary dates and minutes. Timestamp-based payment, stock and audit reports use IST day boundaries.

The screen offers category and item/code/size search, totals, refresh, retry, empty states, Excel download, email attachment generation and browser print. Exports use filtered rows. Email delivery still requires the existing server email configuration.

## Other connected reports

`GET /api/reports/table/:kind` provides purchase summary, expense transactions/category totals, payment transactions, stock movements, item-by-party and party-by-item sales, category/HSN sales, sales/purchase tax line breakdowns, customer outstanding/statement/ageing, branch-verifiable audit events, staff sales/daybook, posted credit notes, sales summary and bill-wise gross profit.

Each screen states its calculation scope. Bill-wise profit uses stored sale-time cost, with unavailable values for historical invoices lacking cost snapshots. Outstanding and ageing are end-date snapshots, not movement totals. Party statements cover customer invoices, allocated receipts and credit notes; supplier balances and unallocated payments require additional reconciliation. Staff daybook currently covers posted sales.

## Remaining accounting reports

Balance Sheet, full Profit and Loss, statutory GSTR-1/GSTR-2/GSTR-3B and TDS/TCS remain unavailable. The database does not capture a full accounting ledger, complete tax-return classifications, or withholding/collection entries. Their links now explain the missing data rather than showing unrelated Daybook rows. GST-with-HSN screens provide transaction tax breakdowns, not filing-ready returns.

## Validation

- `node --import tsx --test tests/report-data.test.ts tests/reports-api.test.ts`
- `npx playwright test --config playwright.reports.config.ts`
- `npm run typecheck`
- `npm run build:api`

API tests replace database reads; browser tests intercept API requests. They do not write billing data or send email. Live database and email-provider validation is separate.
