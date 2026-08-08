# Happy Bonding ERP

Initial Phase 1 web ERP milestone for Happy Bonding Men's Wear.

## Run frontend only (demo data)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run with PostgreSQL API

1. Copy `.env.example` to `.env` and change the database password and JWT secret.
2. Start PostgreSQL with `docker compose up -d`.
3. Run `npm run db:generate`, `npm run db:migrate -- --name init`, then `npm run db:seed`.
4. Start API with `npm run dev:api` and frontend with `npm run dev` in another terminal.

Seed login: `admin@happybonding.in` / `HappyBonding@2026`. Change this password before using real data.

## Included in this milestone

- Responsive ERP navigation and dashboard
- Parties and garment item variants with create forms
- Inventory, sales and purchase listings
- Functional POS search, cart, quantity, payment and bill save flow
- Reports, cash/bank, staff and business settings views
- Production domain rules documented in `docs/DOMAIN-MODEL.md`

The PostgreSQL schema and API now cover login, tenant/branch authorization, parties, products, stock movements and transactional GST sales posting. The current UI still defaults to demo data until a backend session is enabled; thermal printing and MyBillBook import remain upcoming.
