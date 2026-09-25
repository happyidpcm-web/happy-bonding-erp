# Local backend setup

Verification follow-up: frontend typecheck, backend typecheck, and Vite production build passed. Isolated database tests verified staff login, sale posting, balance payment allocation, purchase persistence, idempotent purchase retry, and stock reversal. Browser checks verified staff login, purchase creation screen, invoice preview, print action, and PDF rendering. Physical printer output was not tested.

Two legacy payment allocations were recovered using exact `Balance payment for <invoice number>` notes plus matching branch, customer phone, and saved paid-amount limits. Fifteen payment records remain unlinked; do not infer their invoice associations from similar amounts or dates. New backup exports include payment allocations and vouchers. Generic vouchers now persist by branch; only purchase invoices in that generic editor post stock movements. Other generic documents do not implement complete return/accounting posting.

Start `Happy Bonding ERP.bat` to start PostgreSQL, API (4000), and Vite (5173), then open the browser. The launcher reuses running servers. Configuration is in ignored `.env`; PostgreSQL binaries, database files, and logs are in ignored `.local/`. Keep `.local/pgdata` to retain local data.

The local database was restored from `backups/backup-2026-08-31.json`: 2 branches, 10,259 parties, 7 products, 13 invoices, and 17 payments. Branches are Pavoorchatram and AMBASAMUDRAM. Use the existing documented owner login for access.

Recovery limitations: the source backup omits payment allocations, credit notes, roles/memberships, password hashes, audit history, and document sequences. Saved invoice paid amounts and payment records were preserved, but payment-to-invoice links cannot be recovered from this file. The owner role/access was recreated and sales sequences were reconstructed from saved invoice numbers. No historical relationships were guessed.

The checked-in migrations were applied, followed by `prisma db push` to include schema additions missing from those migrations. Startup database push/seed is disabled locally; it now requires explicit `AUTO_SETUP_DATABASE=true` to avoid changing restored data on every start.

`scripts/restore-local-backup.mjs` only accepts an empty local database and restores transactionally. Do not rerun against this populated database. Existing application-wide invoice numbering across branches and incomplete backup coverage still require separate follow-up before relying on this recovery as a complete accounting archive.
