# Product-Line Cleanup — Phase 1 Audit Report

Date: 2026-05-18
Scope: Backend (NestJS + Prisma) + Admin (Angular)
Status: Discovery only — NO code changes performed.

---

## Section 1 — Summary

| Metric | Count |
|---|---|
| Product-type concepts in code | 2 enumerations (`product_category`, `loan_purpose`) + 1 schema column (`BankProgram.productCategory`) + 1 schema column (`Application.loanPurpose`) |
| Distinct `product_category` values seeded | **11** |
| Distinct `loan_purpose` values seeded | **7** |
| Valid (3) | `personal`, `car`, `mortgage` |
| To REMOVE (extra product lines) | `education` |
| To RECLASSIFY (bank-program flavors stored as product categories) | `pension`, `secured`, `buyout`, `credit_card_cross_sell`, `auto_cross_sell`, `wealth`, `clubs` (+ orphan branches `bankers`, `pensions` used in matching code) |
| Bank programs currently using a non-3 `productCategory` | **5 in catalog seeds** (3 in `abk-egypt-2026` set to `auto_cross_sell`/`credit_card_cross_sell`/`wealth`/`clubs`; 1 in `salesfloor-egp-2026` set to `wealth`) + **3 in `prisma/seed-demo.ts`** (`education` ×2, `buyout` ×2) |
| Overall risk | **Medium**. No production DB exists yet (Prisma migrations only, demo seed). Cleanup is mostly enum-set reduction + recoding ~8 seed programs + UI dropdown trim. Risk concentrates in (a) backend matching pipeline branches (`approval-probability.ts` lines 67-68 reference `bankers` / `pensions` that aren't in the seeded enum — likely dead code) and (b) any in-flight specs/contracts referencing the wider category set. |

---

## Section 2 — The 3 Valid Product Lines

All three are present and correctly modeled.

`personal`, `car`, `mortgage` are defined in:

- [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:103-105](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L103) — `loan_purpose` enum
- [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:131-133](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L131) — `product_category` enum
- [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts:227-229](admin/src/app/features/bank-programs/list/bank-programs-list.page.ts#L227) — Admin list filter

Schema column `BankProgram.productCategory String @db.VarChar(64)` ([schema.prisma:226](backend/prisma/schema.prisma#L226)) is a free-text 64-char column with an index `idx_bank_program_product_category` — no DB-side enum constraint exists. A `CHECK` constraint must be added in Phase 2.

---

## Section 3 — Items to REMOVE

### 3.1 `education` (4th product line — not in scope)

| Location | Action |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:106](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L106) | DELETE `loan_purpose` entry |
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:134](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L134) | DELETE `product_category` entry |
| [backend/prisma/seed-demo.ts:202, :287](backend/prisma/seed-demo.ts#L202) | 2 demo programs use `productCategory: 'education'` — change to `personal` (education loans are personal-line products) |

- Affected tables: `BankProgram.productCategory`, `Application.loanPurpose` (string column, no FK)
- Affected endpoints: any filter passing `?productCategory=education` will return [] post-cleanup
- Affected Angular screens: lookups page (`product_category` + `loan_purpose` tables surface the value), `bank-programs-list` filter dropdown (not currently exposed), program form dropdown (driven by enum)
- Record count: 0 prod, 2 demo seed programs
- Removal complexity: **Low**

---

## Section 4 — Items to RECLASSIFY

These were modeled as `productCategory` values but represent bank-program "flavors" that should live as `BankProgram` records under one of the 3 valid product lines.

### 4.1 `pension` / `pensions`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:107, :135](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L107) — both `loan_purpose` and `product_category` enum | `personal` (pensioners receive a personal loan with pension-receipt eligibility) |
| [backend/src/matching/pipeline/approval-probability.ts:68](backend/src/matching/pipeline/approval-probability.ts#L68) — `program.productCategory === 'pensions'` (typo'd plural, never matches the seeded value `pension`) | Replace branch with an eligibility-flag check on the program (e.g. `program.eligibility.acceptsPension === true`) — NOT a product-line check |

### 4.2 `secured`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:108, :136](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L108) | `personal` (CD-secured / asset-secured personal loans) or `car`/`mortgage` per program. Use the existing `requiresCD` / `requiresAutoLoanAtABK` eligibility flags to distinguish — they already exist in `eligibility-config.dto.ts`. |

### 4.3 `buyout`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:109, :137](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L109) | `personal`. "Buyout" is a transaction TYPE within personal loans, not a product line. The pricing config already carries `buyoutRateDeltaPercent` + `buyoutRateMinFloorPercent` ([pricing-config.dto.ts:51,55](backend/src/bank-programs/dto/sub-configs/pricing-config.dto.ts#L51)) — those flags are the correct way to mark a buyout-capable program. |
| [backend/prisma/seed-demo.ts:216, :329](backend/prisma/seed-demo.ts#L216) — 2 demo programs use `productCategory: 'buyout'` | Recode to `personal` |

### 4.4 `credit_card_cross_sell`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:138-143](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L138) | `personal`. CC cross-sell is a personal-loan acquisition channel, gated by `competitorCardMustBeUnsecured` flag already present in [eligibility-config.dto.ts:74](backend/src/bank-programs/dto/sub-configs/eligibility-config.dto.ts#L74). |
| [backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts:50](backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts#L50) — 1 ABK catalog program | Recode to `personal` |

### 4.5 `auto_cross_sell`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:144](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L144) | `car`. Auto cross-sell is a car-loan acquisition channel. |
| [backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts:36, :43](backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts#L36) — 2 ABK catalog programs | Recode to `car` |

### 4.6 `wealth`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:145](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L145) | `personal`. Wealth-tier eligibility is already a separate gate (`customerProgramTier === 'wealth'` in eligibility config). |
| [backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts:121](backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts#L121) — 1 program | Recode to `personal` |
| [backend/src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts:100](backend/src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts#L100) — 1 program | Recode to `personal` |
| [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts:230](admin/src/app/features/bank-programs/list/bank-programs-list.page.ts#L230) — filter dropdown option | Remove option |

### 4.7 `clubs`

| Where it lives | Reclassify to |
|---|---|
| [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts:146](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L146) | `personal`. Club-membership is an employer/affinity eligibility check. |
| [backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts:170](backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts#L170) — 1 program | Recode to `personal` |

### 4.8 Orphan branch — `bankers`

| Where it lives | Action |
|---|---|
| [backend/src/matching/pipeline/approval-probability.ts:67](backend/src/matching/pipeline/approval-probability.ts#L67) — `program.productCategory === 'bankers'` | Value `bankers` is referenced in code but never seeded into either enum. Dead branch — replace with eligibility flag (`program.eligibility.companyType === 'banker'`) or remove. |

### 4.9 Admin filter dropdown — `buyout`

| Where it lives | Action |
|---|---|
| [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts:231](admin/src/app/features/bank-programs/list/bank-programs-list.page.ts#L231) | Remove option (matches Section 4.3 removal) |

---

## Section 5 — Proposed Cleanup Plan (do NOT execute until approved)

Ordered for safety. Each step is independently revertible until the migration in step 6.

### Step 1 — Lock the 3 product lines in code
- Define `const VALID_PRODUCT_CATEGORIES = ['personal', 'car', 'mortgage'] as const` + type alias in `backend/src/bank-programs/bank-programs.types.ts` (currently missing — `productCategory` is typed `string`).
- Same in `admin/src/app/features/bank-programs/bank-programs.types.ts:175,206,230,246` (replace `string` with `ProductCategory`).
- Add `@IsIn(['personal','car','mortgage'])` validator on `productCategory` in `create-bank-program.dto.ts` + `list-bank-programs.query.ts`.

### Step 2 — Trim enums
- In `backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts` delete lines 106-109, 134-146.
- Keep only `personal`, `car`, `mortgage` under both `loan_purpose` and `product_category`.

### Step 3 — Recode seed programs (RECLASSIFY, do NOT delete)
| File | Line | Old | New |
|---|---|---|---|
| `seed-demo.ts` | 202 | `education` | `personal` |
| `seed-demo.ts` | 216 | `buyout` | `personal` |
| `seed-demo.ts` | 287 | `education` | `personal` |
| `seed-demo.ts` | 329 | `buyout` | `personal` |
| `abk-egypt-2026.ts` | 36 | `auto_cross_sell` | `car` |
| `abk-egypt-2026.ts` | 43 | `auto_cross_sell` | `car` |
| `abk-egypt-2026.ts` | 50 | `credit_card_cross_sell` | `personal` |
| `abk-egypt-2026.ts` | 121 | `wealth` | `personal` |
| `abk-egypt-2026.ts` | 170 | `clubs` | `personal` |
| `salesfloor-egp-2026.ts` | 100 | `wealth` | `personal` |

Each program keeps its `programCode`, eligibility, pricing — only `productCategory` changes.

### Step 4 — Matching pipeline cleanup
- `backend/src/matching/pipeline/approval-probability.ts:67-68` — replace `productCategory === 'bankers' | 'pensions'` branches with eligibility-flag checks (`program.eligibility.companyType === 'banker'`, etc.) OR remove if dead.
- `backend/src/matching/engine.service.ts:365` — reasons string `program_category_${...}` remains valid; will now only emit `personal|car|mortgage`.

### Step 5 — Admin UI cleanup
- `admin/src/app/features/bank-programs/list/bank-programs-list.page.ts:230-231` — delete `wealth` + `buyout` `<nz-option>`.
- `admin/src/app/features/bank-programs/form/sections/identity-section.component.ts:123` (`productCategoryOptions`) is computed from the enum endpoint — will auto-reduce once Step 2 lands.
- Lookups page (`admin/src/app/features/lookups/lookups.page.ts:86,116`) still surfaces `loan_purpose` + `product_category` as managed enum lists — works correctly with reduced set.

### Step 6 — Prisma migration
- Add a `CHECK` constraint or migrate `productCategory` to a Prisma enum:
  ```prisma
  enum ProductCategory { personal car mortgage }
  ```
  Either:
  - **Option A** (loose): keep `String @db.VarChar(64)` and add a SQL `CHECK (productCategory IN ('personal','car','mortgage'))` constraint.
  - **Option B** (strict): convert column to `ProductCategory` enum. Requires data backfill ensuring every existing row maps to the 3 values (Step 3 covers seed data; production DB is empty pre-launch).
- Same decision for `Application.loanPurpose` ([schema.prisma:274](backend/prisma/schema.prisma#L274)).
- Generate named migration: `npx prisma migrate dev --name lock_product_category_to_three`.

### Step 7 — Data safety
- No production data exists (Prisma migrations only, demo seed). Seed re-run on a dev DB is safe.
- The `Application.loanPurpose` column will receive only `personal|car|mortgage` from the mobile wizard once Step 1 validator lands. Any historic test rows with `education`/`buyout`/etc. must be migrated or deleted before applying Option B; Option A leaves them but rejects new ones.
- Audit log entries referencing the old `productCategory` values stay intact (they're audit history; do not rewrite).

### Step 8 — Verification
- `npx prisma migrate dev` succeeds.
- `npm run start:dev` boots without enum-related errors.
- `GET /api/admin/bank-programs?productCategory=education` returns `{ success:false, code:'VALIDATION_FAILED' }`.
- `GET /api/admin/platform-enumerations/product_category` returns exactly 3 members.
- Admin atlas + lookups screens render with 3 categories only.

---

## Stop. Phase 1 complete.

Awaiting explicit approval before executing Phase 2.
