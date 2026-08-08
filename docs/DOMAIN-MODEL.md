# Happy Bonding ERP — Phase 1 domain model

The UI is currently backed by sample data. Production persistence will use PostgreSQL and an append-only operational ledger.

## Tenant and access

- Organization → Branches → Users
- Roles contain granular permissions; users may be restricted to one or more branches.
- Every business row carries `organization_id`, and branch-owned rows also carry `branch_id`.
- Sensitive create/update/cancel operations create immutable audit events.

## Inventory

- Product is the shared style/master (for example, Classic Oxford Shirt).
- ProductVariant is the sellable size/colour combination and owns SKU/barcode/prices.
- StockBalance is a cached branch + variant balance.
- StockMovement is the source of truth: opening, purchase, sale, return, transfer, damage, adjustment.
- Posted stock movements are never edited or deleted; reversals create compensating movements.

## Sales and purchases

- Documents have draft, posted, cancelled and reversed states.
- Number sequences are scoped by organization, branch, document type and financial year.
- Posted invoices retain snapshots of item name, HSN, tax rate and price.
- Payment allocations connect a receipt/payment to one or more invoices.
- Returns link to original invoices and enforce remaining returnable quantity.

## Accounting

- Every posted financial operation generates a balanced journal entry.
- JournalEntry contains two or more JournalLines with debit/credit amounts.
- Cash, bank, customer receivable, supplier payable, sales, purchase/COGS, stock and tax accounts are ledger accounts.
- Reports are calculated from journals; dashboard totals may use cached summaries.

## Required database aggregates

Organization, Branch, User, Role, Permission, Product, ProductVariant, Category, Brand, TaxRate, StockBalance, StockMovement, Party, Address, SalesInvoice, SalesInvoiceLine, SalesReturn, PurchaseInvoice, PurchaseInvoiceLine, PurchaseReturn, Payment, PaymentAllocation, CashSession, Expense, LedgerAccount, JournalEntry, JournalLine, DocumentSequence, AuditEvent, BusinessSetting.

## Safety invariants

1. Monetary values are stored as fixed precision decimals, never floating point.
2. Posted document numbers are unique and immutable.
3. Posting invoice + stock + journal entries happens in one database transaction.
4. API write requests accept idempotency keys to prevent duplicate bills.
5. Negative stock policy is explicit per branch and never accidental.
6. GST calculations retain taxable value, CGST, SGST and IGST separately.
