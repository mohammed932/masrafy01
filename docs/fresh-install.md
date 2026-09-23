# Fresh install — backend, dashboard and the seeded data

How to go from an empty machine to a running backend and admin dashboard with every bank
program in place: the payslip catalog programs **and** the no-payslip (surrogate) programs,
their products and figures, and the shared I-Score table.

Verified end to end on 2026-09-23 against an empty PostgreSQL database: every step below
exited 0, and a second run of every seed wrote nothing that matters (see
[Re-running](#re-running-the-seeds)).

## 0. Prerequisites

- Node.js 22 LTS (`nvm use` reads `.nvmrc`)
- Docker + Docker Compose v2

## 1. Infrastructure and dependencies

```bash
nvm use
(cd backend && npm install)
(cd admin && npm install)

docker compose -f docker/compose.dev.yml up -d postgres redis
```

## 2. Backend environment

```bash
cd backend
cp .env.example .env
```

Set at least `JWT_ACCESS_SECRET` (≥ 32 random bytes), `CUSTOMER_JWT_ACCESS_SECRET`,
`CUSTOMER_JWT_REFRESH_SECRET` and `SEED_ADMIN_PASSWORD`. `DATABASE_URL` must point at the
Postgres from step 1.

## 3. Schema, then the seeds — in this order

Run every command from `backend/`. **The order matters**; each step reads what the one before
it wrote.

```bash
npx prisma generate
npx prisma migrate deploy        # 1. schema + reference lists
npx prisma db seed               # 2. the super_admin account
npm run seed:banks               # 3. the 14 banks
npm run seed:questionnaire       # 4. the question pool, published
npm run seed:catalog             # 5. catalog names: loan types + income basis
npm run seed:programs            # 6. the payslip catalog programs
npm run build                    # 7. the next two seeds run from dist/
npm run seed:blueprints          # 8. the no-payslip PRODUCTS
npm run seed:sheet-figures       # 9. product figures + the surrogate PROGRAMS
```

What each step leaves behind, measured on the empty database:

| # | Step | Writes |
|---|------|--------|
| 1 | `prisma migrate deploy` | Every table, plus the reference lists: governorates, employment and transfer types, required documents, the 21 catalog program names, the six I-Score classes with their ranges and income percentages (300–399 Defaulted 0% · 400–520 High Risk 50% · 521–625 Unsatisfactory 80% · 626–700 Satisfactory 100% · 701–750 Very Good 110% · 751–850 Excellent 120%) — the shared I-Score table. No questions, banks, programs or products yet. |
| 2 | `prisma db seed` | The super_admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). The first login forces a password change. |
| 3 | `seed:banks` | 14 banks. |
| 4 | `seed:questionnaire` | 6 groups, 69 questions, each assigned to its loan types, and a published questionnaire version. Auto Loan asks the I-Score question. |
| 5 | `seed:catalog` | Which loan types each catalog name is offered under, and its income basis (payslip / no payslip). `--dry` prints the plan first. |
| 6 | `seed:programs` | 47 catalog bank programs — 35 payslip, 12 business/professional no-payslip ones read on a declared income. None states an I-Score table; they read the shared one. |
| 7 | `npm run build` | `dist/` — required: steps 8 and 9 run the compiled commands, and a stale build seeds stale data. |
| 8 | `seed:blueprints` | The 10 no-payslip products (armed forces grades, academic rank, doctors, card limit share, car-loan cross-sell, pledged collateral, compound owner, school stage, car buyers down payment …), the questions each one asks, and a questionnaire publish per product. |
| 9 | `seed:sheet-figures` | Each product's figures (tables, amounts, durations, plan tables), the no-payslip catalog names linked to them, and 24 surrogate bank programs. No product or program is given an I-Score table: all of them read the shared one. |

End state: **71 bank programs** (42 payslip, 29 no-payslip), **13 products** (10 with a
calculation, 3 cap-only), 85 active questions, and every program scored on the shared I-Score
table — edit a class on **Manage values → I-Score classes** and every program that states no
table of its own follows it.

## 4. Run it

```bash
# backend/
npm run start:dev          # http://localhost:3000   API docs: /api/docs

# admin/
npm run gen:api            # regenerate the API types from OpenAPI
npm start                  # http://localhost:5173
```

Sign in with the super_admin from step 2. The surrogate programs are under **Banks → a bank**
(income basis "Surrogate"), and their products under **Program catalog → Surrogate**.

## 5. Check it

```bash
# backend/
npm run check:question-scope   # every fact a live program reads is asked
npm run check:money            # the four money figures are asked on every flow
npm run check:parent-keys
npm run check:income-proof
```

On a fresh install the first three print clean. `check:income-proof` reports **one** known
conflict that ships in the seed data itself: `ABK-PER-DOCTOR` and `CIB-PER-DOCTOR` read a
declared income while their catalog name states a no-payslip rule. It predates the I-Score
work and does not stop anything from running.

## Re-running the seeds

Every seed is idempotent. A second run of steps 3–9 on the same database reports:

- `seed:programs` — `0 created, 0 updated, 47 left untouched` (it only rewrites with `--force`)
- `seed:blueprints` — `0 created · 10 unchanged`
- `seed:sheet-figures` — `0 I-Score tier tables written · 0 programs created · 0 updated`
- `seed:banks` rewrites the same 14 labels, and `seed:sheet-figures` rewrites one product
  (`doctors_in_practice`, "0 slots"); both are no-ops in effect.

Both `dist/` seeds take `--dry` to report without writing.

**Do not re-run `seed:questionnaire` after step 8.** It deactivates the questions the
blueprints created, and the served questionnaire goes stale. If it was run by mistake,
reactivate only the questions a live `surrogate_product_ask` row points at and republish
(`npx tsx scripts/publish-questionnaire.ts`).

## Upgrading an existing database instead

A database that already has data only needs the new migrations, then a publish — the
seeds are for empty databases:

```bash
npx prisma migrate deploy
npx tsx scripts/publish-questionnaire.ts   # category assignments are frozen into the
                                           # published snapshot; the app sees a migration's
                                           # question changes only after a publish
```

## Optional demo data

Not needed for the programs above, and not part of the verified run: `seed:customers`
(mobile customer accounts), `seed:demo` (staff users and sample applications),
`seed:apps:demo`, `seed:support:demo`.
