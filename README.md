# CityPlaza — Inventory & Sales Management

Inventory, sales, and role-based staff management for CityPlaza’s mobile and electronics store, built with Next.js App Router, TypeScript, Prisma, and PostgreSQL.

CityPlaza is a single-store operations app for administrators and employees. It models the real shop workflow:

> Admin adds products and stock → employees sell at the counter → every sale changes inventory inside a database transaction → historical purchase/selling prices are preserved → reports derive sales, stock and profit from those records.

**Stack:** Next.js 16 (App Router, Server Components, Server Actions, Route Handlers and Proxy) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Lucide · React Hook Form + Zod · PostgreSQL + Prisma · Recharts · date-fns · Sonner · Zustand (cart only) · decimal.js · jose + bcryptjs.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
# Configure the private .env file with DATABASE_URL, DIRECT_URL and a local AUTH_SECRET.

# 3. Database (needs a running PostgreSQL)
npm run db:setup                  # local schema sync + constraints + development seed

# 4. Run
npm run dev                       # http://localhost:3000
```

**Create the two staff accounts:** set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_EMPLOYEE_EMAIL`, and `SEED_EMPLOYEE_PASSWORD` in the private, git-ignored `.env` file, then run `npm run db:seed:accounts`. Local runs update these two accounts to match the current `.env` credentials. Passwords are intentionally kept out of this README and source control. Seed commands refuse to run with `NODE_ENV=production` and never print credentials.

**Bulk product import:** open **Products → Bulk upload**, download the CSV template, and upload up to 250 rows at a time. Categories and brands are added when missing; opening stock and IMEI/serial entries are created through the inventory ledger. Each batch validates before writing and rolls back completely if a row has an error. Existing SKUs are never overwritten.

**Production:** configure the transaction-pool `DATABASE_URL`, session-pool `DIRECT_URL`, a production-only `AUTH_SECRET`, public `APP_URL`, and SMTP settings in the private `.env.prod` file or the hosting provider's environment settings. Do not configure `SEED_*` variables in production. `npm run build:prod` builds with `.env.prod`, `npm run start:prod` starts Next.js with `.env.prod`, and `npm run db:migrate:prod` applies reviewed Prisma migrations. `npm run db:setup:prod` also applies the database constraints. Destructive Prisma resets are blocked for Supabase URLs. For Vercel, set the same values in project environment settings instead of uploading a local env file.

**Migration source:** `.env` contains `SOURCE_DIRECT_URL` for read-only exports from the old project. Do not use it for application runtime, migrations, or writes.

Seed users from `db:seed`: `admin@cityplaza.local` (ADMIN), `sita@`, `ram@`, `anita@cityplaza.local` (EMPLOYEE).

> `npm run db:constraints` adds what Prisma can't express: `CHECK (quantity >= 0)` on products, non-negative prices, positive sale quantities, and a trigram index for fast name search. `db:setup` already runs it.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` / `start:prod` | Next.js |
| `npm run build:prod` | Build using `.env.prod` for a local production-mode check |
| `npm run analyze` | Capture a Turbopack production bundle analysis |
| `npm run analyze:webpack` | Produce `client.html`, `edge.html`, and `nodejs.html` bundle reports with `@next/bundle-analyzer` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (no database needed) |
| `npm run test:integration` | DB-backed tests; requires `TEST_DATABASE_URL` (a **disposable** DB: tables are truncated) |
| `npm run db:push` / `db:constraints` / `db:seed` / `db:seed:accounts` / `db:setup` / `db:studio` | Local database tooling using `.env` |
| `npm run db:migrate:local` | Create and apply local Prisma migrations |
| `npm run db:migrate:prod` | Apply existing migrations to production using `.env.prod` |
| `npm run db:constraints:prod` / `db:setup:prod` | Apply database constraints in production; no production seed runs |

Integration tests: create an empty database, then
```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/citypalaza_test"
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push && DATABASE_URL=$TEST_DATABASE_URL npm run db:constraints
npm run test:integration
```

---

## What's in the box

**Admin:** Dashboard (KPIs + charts + date-range filters and PDF/Excel exports) · Sales (all, void) · Products, Categories & Brands · Inventory (add stock, adjust, damage/lost, history) · Customers · Reports (Sales, Profit, Inventory, Employee performance) · Team accounts (create employees/admins, suspend, anonymize/delete) · Audit logs · Settings.
**Employee:** Dashboard (own numbers only, with personal PDF/Excel exports) · Sales terminal and own sales · Products (search, price, availability, no costs) · Customers.

Highlights
- **Sales terminal** – fast product search (name/SKU/barcode/IMEI), cart (Zustand), optional customer or walk-in, % or fixed discount, payment method, live preview, then a **server-authoritative** checkout. Receipt can be printed or downloaded.
- **Variants and IMEI / serial tracking** – each sellable color/storage variant is a product row with its own SKU, price, stock ledger, and optional label (for example, “Black · 256 GB”). Per-device `ProductSerial` rows keep IMEIs Luhn-validated and globally unique; a sold IMEI can't be sold again; voiding a sale puts devices back in stock.
- **Inventory is a domain, not a counter** – `InventoryTransaction` records type, signed quantity, previous/new quantity, reference, reason, user and time for every change.
- **Concurrency-safe** – see below.
- **Audit trail** – login/logout, product, stock, sale, void, employee and settings events with actor, IP and user agent. Admin-only.

---

## Architecture

```
src/
  app/
    (auth)/login            sign-in
    (auth)/forgot-password  request a reset link
    (auth)/reset-password   set a new password with a single-use token
    (dashboard)/…           dashboard, products, inventory, sales, customers, reports,
                            employees, audit-logs, settings   (loading.tsx / error.tsx / not-found.tsx)
    api/                    route handlers: product & customer search, serial lookup, receipt download
    forbidden/ unauthorized/
  components/ui/            shadcn/ui primitives (button, card, dialog, table, …)
  components/shared/        DataTable, Pagination, PageHeader, SearchInput, DateRangePicker, ConfirmDialog,
                            PermissionGate, StatusBadge, StockBadge, CurrencyDisplay, EmptyState, ErrorState,
                            LoadingSkeleton, ReportCard, ReportChart
  components/layout/        AppShell (sidebar, topbar, breadcrumbs, notifications, user menu)
  features/                 products · inventory · sales (SaleCart, SaleSummary, PaymentMethodSelector, SaleTable…)
                            · customers · employees · reports · settings
  server/                   *.service.ts  → ALL database access + business rules
                            actions.ts    → typed Server Actions (permission → Zod → service → revalidate)
  lib/
    rbac/                   permissions.ts (single source of truth) + navigation.ts
    auth/                   session.ts (cookie+DB session), token.ts (JWT), password.ts, guards.ts
    sales-calc.ts           pure decimal.js sale maths, discount rules, profit
    money.ts format.ts dates.ts imei.ts stock.ts errors.ts audit.ts …
  stores/cart-store.ts      Zustand: temporary cart only
  validations/              Zod schemas
prisma/schema.prisma  prisma/seed.ts  scripts/apply-constraints.ts  tests/
```

Rules the code follows: Server Components by default (client components only for forms, the terminal, charts and filters); UI never touches the database; filters/search/sort/pagination live in the **URL** (`/products?search=iphone&category=smartphones&page=2`) and run in SQL, never in the browser.

### Security
- **Auth:** HTTP-only, `SameSite=Lax`, `Secure` (prod) cookies containing signed access and rotating refresh tokens that reference a server-side `Session` row. Nothing sensitive in `localStorage`. Sessions expire, are deleted on logout, and are revoked immediately when an account is disabled or its password is reset. Password recovery stores only a SHA-256 digest of a random single-use token. Passwords use bcrypt (cost 12) and strength rules.
- **RBAC:** `lib/rbac/permission.ts` defines the permissions and role map. UI uses it for navigation and `PermissionGate`; **every** Server Action calls `assertPermission()` and every route handler checks access. Pages call `requirePermission()` (redirects to `/forbidden`). Employees never receive purchase prices (omitted in the DTO, not merely hidden) and can only open their own sales.
- **Account deletion:** deleting an account revokes sessions and reset tokens, anonymizes its profile and audit descriptions, and retains historical sales/stock records. The last active admin cannot be suspended, demoted, or deleted.
- Security headers in `next.config.ts`; secrets stay in private, git-ignored `.env` and `.env.prod` files or the production host's environment settings.

### Money, stock and concurrency
- All money is `NUMERIC(12,2)` in PostgreSQL and `decimal.js` in code (half-up rounding). Nothing is computed with floats; the browser's totals are display-only previews.
- **Sale calculation** (`lib/sales-calc.ts`): line subtotal = price × qty; product promotion applies first, then optional per-item and cart manual discounts. Cart discount cents are allocated by largest remainder and larger net lines break ties. Tax is exclusive and computed on the discounted amount. Employee manual discounts are capped by a rounded currency amount (default 5% of the post-promotion net); an optional total-discount ceiling is disabled by default. Employees cannot sell below cost; admins can, with the audit entry marked. All rules are enforced on the server.
- **Profit** = Σ (historical unit selling price × qty − discounts − historical unit purchase price × qty). With no discount this is exactly *(selling − purchase) × quantity*. `SaleItem` snapshots name, SKU, prices, discount and tax, so later price edits never rewrite history.
- **No overselling:** `changeStock()` is the only code that changes `Product.quantity`, via one guarded statement
  `UPDATE "Product" SET quantity = quantity + $delta WHERE id = $id AND quantity + $delta >= 0 RETURNING quantity`.
  If two employees sell the last unit simultaneously, PostgreSQL row-locks the product; the second update matches no rows → the whole second transaction rolls back (sale, items, serial claims, audit). A DB `CHECK (quantity >= 0)` is the final backstop. IMEIs are claimed with `UPDATE … WHERE status = 'IN_STOCK'` and the row count is verified.
- **One transaction per sale:** `Sale` + `SaleItem`s + serial updates + stock deduction + `InventoryTransaction`s + `AuditLog` commit or roll back together. **Voiding** (admin, reason required) does the reverse in one transaction: status → `VOIDED`, stock restored via a `RETURN`/`SALE_VOID` reversal entry, devices back to `IN_STOCK`, audit written. Completed sales are never deleted. Sale numbers (`CP-000123`) come from a gap-free counter inside the sale transaction.

### Reports
Derived only from `Sale`/`SaleItem` snapshots and current stock; VOIDED sales are excluded. Day/month bucketing and "today" use `APP_TIMEZONE` (default `Asia/Kathmandu`).

### Caching
Only stable reference data is cached (`unstable_cache` tags: `categories`, `brands`, `settings`) and invalidated by the matching mutations. Dashboards and lists are always fresh. Sale-time settings (tax, discount limit) are read directly from the DB inside the transaction.

### Accessibility
Skip-free semantic landmarks, labelled form controls with `aria-describedby`-style hints and `role="alert"` errors, visible focus rings, keyboard-operable dialogs/menus (Radix), `aria-sort`/`aria-current`, responsive tables with horizontal scroll, reduced-motion support.

---

## Design system

- **Direction:** a focused retail operations console for a mobile and electronics shop. Navy navigation anchors the workspace; cool neutral surfaces keep stock and money data readable; blue marks primary actions, while amber and red are reserved for inventory risk.
- **Type:** Inter for the interface, a compact heading scale, sentence-case labels, and tabular numerals for money and quantities.
- **Surfaces:** pale blue-grey canvas, white content panels, clear input borders, restrained shadows, and consistent 10–14px control and card corners. Dark mode follows the device automatically.
- **Components:** shadcn/ui primitives restyled in `src/components/ui`. Semantic color and surface tokens live in `src/app/globals.css`; shared page chrome and data presentation live under `src/components`.
- **Responsive:** desktop gets a fixed navy navigation rail; phones and tablets get a bottom tab bar with a “More” sheet; tables become stacked cards below 768px; the sales terminal keeps the active cart easy to reach; safe-area insets are respected on notched devices.
- **Motion:** transitions clarify interactive state changes; reduced-motion preferences are respected.

## Data model (Prisma)

`User` · `Role` · `Permission` · `RolePermission` · `Session` · `PasswordResetToken` · `Category` · `Brand` · `Product` · `ProductSerial` · `InventoryTransaction` · `Customer` · `Sale` · `SaleItem` · `AuditLog` · `Setting` · `Counter`

Indexed for scale: SKU, barcode (unique); product name, category, brand, status, quantity; sale number (unique), employee+date, customer, createdAt, status+date, payment method; inventory product+date, type, reference ID; audit date/actor/action/entity.

Notes on the schema choices
- `Role`/`Permission`/`RolePermission` tables are synced from `permissions.ts` by the seed. Runtime checks use the in-code map (no DB hit per request), and the tables are ready for managers/custom roles later.
- Users are never deleted: status `ACTIVE | INACTIVE | SUSPENDED`.
- Product/serial/sale statuses and tracking types match the spec (`QUANTITY | SERIALIZED | IMEI`, payment methods incl. eSewa and Khalti).

## Tests

`npm test` (42 tests, no DB): RBAC and navigation, password hashing, session tokens, login/password validation, sale totals, discount allocation and limits, 5,000 randomized discount carts, profit, NPR formatting, stock status, IMEI/serial validation, product validation, sale-input validation, date ranges.
`npm run test:integration` (PostgreSQL): sale creation & inventory deduction, historical price preservation, **simultaneous last-unit race → one winner**, full rollback on partial failure, negative-stock protection (service + CHECK), adjustment reasons, SKU/barcode uniqueness, IMEI uniqueness & no re-sale, void & restoration (once only), employee discount limit, server ignores client prices, employees see only own sales, disabled accounts lose sessions.

## Extending later
Services take an `Actor` and a transaction client, and every stock/price change flows through one place, so suppliers/purchases, returns, expenses, branches/warehouses (add `locationId` to `Product`-stock and `InventoryTransaction`), online sales or loyalty can be added as new services/models without touching the core.

## Known limitations / next steps
- No login rate-limiting or 2FA yet (add at the reverse proxy or in `loginAction`).
- Customer returns reuse *void*; a dedicated partial-return flow is a natural next feature.
- Partial/pending payments are recorded (`amountPaid`) but there is no payment-collection ledger yet.
