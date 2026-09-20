---
name: backend-data-change
description: Rules for NestJS/Prisma changes in backend/: migrations, seeds and their run order, new error codes across backend+admin+Flutter, money/engine invariants. Use when adding an error code, a Prisma migration, a seed change, or touching matching/bank-programs code.
---

# backend-data-change

## New error code (same PR, all surfaces)
1. `backend/src/common/errors/error-codes.ts` (+ exception in `domain.exceptions.ts`)
2. `admin/src/i18n/error-codes.en-US.json` AND `error-codes.ar-EG.json`
3. Flutter ARB if customer-facing (`masrafy-app/lib/l10n/intl_en.arb`, `intl_ar.arb`)
4. `cd backend && npm run check:codes` must say in sync. API never returns English text, only `{success:false, code, meta?}`.

## Migration
1. `npx prisma migrate dev --name <snake_name>` (never `db push`).
2. Add `RAISE EXCEPTION` guards on assumed state; migrations run on deploy with nobody watching.
3. Don't backfill onto immutable history (`bank_offer` columns stay nullable) — Principle I/A6.
4. Capture affected quotes BEFORE and AFTER (`npm run quote:surrogate`); "moves no money" must diff identical.

## Seed order (full reseed)
`prisma migrate deploy → npm run build → seed:questionnaire → seed:blueprints → seed:sheet-figures → seed:questionnaire`
Re-run each seed: must report 0 written / 0 refused.

## Gotchas
- `seed:questionnaire` DEACTIVATES blueprint-minted questions and the served snapshot goes stale; verify active question count, reactivate only questions a live `surrogate_product_ask` row points at, republish via admin endpoint.
- Services never touch Prisma: use `*.repository.ts`. `common/` must not import features.
- Money = `Decimal`, never float. No `if (programId === …)` bank branches (banks are data).
- Loan categories are exactly four (`personal|car|mortgage|business`); no-payslip is an income basis (`bank_program.programType`), never a category.
- `programCode` is immutable; a rename = new code + delete/retire old.
- Route order in controllers: literal paths before `:param` ones.
- Matching engine is pure (no HTTP/DB); preview and apply must share the same functions (visibility, order, facts).
- Then run `verify-change`.
