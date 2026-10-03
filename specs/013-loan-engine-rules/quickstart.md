# Quickstart — verifying 013 Loan Engine rules

This follows the repo testing policy: no new unit tests. Existing suites stay green; if one becomes wrong, it is updated, not duplicated. Proof comes from the real DB, the seeds, a browser and the checks.

## 1. Bring-up
```bash
docker compose -f docker/compose.dev.yml up -d postgres redis
cd backend && npx prisma migrate dev && npx prisma generate && npm run start:dev
cd admin && npm start          # http://localhost:5173 → sidebar "Loan Engine"
```

## 2. Before ANY code: capture the figures
```bash
cd backend
# the script's baseline path is fixed to specs/012-…/parity-baseline.json; the plan adds an
# OUT override (PARITY_OUT env) so 013 keeps its own baseline instead of overwriting 012's
PARITY_OUT=../specs/013-loan-engine-rules/parity-baseline.json npx tsx scripts/quote-preview-apply-parity.ts --write
npm run quote:surrogate > /tmp/013-surrogate-before.txt
npm run quote:car-plans  > /tmp/013-car-before.txt
npm run check:question-scope -- --report > /tmp/013-scope-before.txt
```

## 3. After the widened band key + `conditions` migration (no data edited yet)
Re-run §2 into `*-after.*` files. They must be **byte-identical** to the before files. This proves that R1 and the empty column move no money, and that `mustAnswerQuestionCodes` is unchanged while no condition exists.
```bash
npm run seed:blueprints     # 0 written / 0 refused
npm run seed:sheet-figures  # 0 written / 0 refused
```

## 4. Effect rows over HTTP (Story 1)
Pick a payslip program, e.g. one of the 8 bank car programs that today read no answer, and a NUMERIC question linked to a figure.

1. `GET /api/admin/loan-engine/questions/<code>` → the program is listed with `rate.editable = true` and `rows: []`.
2. `PUT …/effects/rate` with `between 1–100 → 22`, `gt 100 → 19`, `useFallback` → 200.
3. `POST /api/admin/matching/simulate` with answers 1, 100, 100.01 and 150 → rates 22, 22, 19 and 19 on that program. Every other program equals the baseline.
4. Boundary sweep, one operator at a time, each at X−0.01, X and X+0.01: `lt`, `lte`, `gte`, `gt`, `eq` (all with X = 100).
5. Stale `expectedVersion` → 409 `CONFLICT_STALE_DATA`.
6. Refusals:
   - both edges → 422 `both_edges`;
   - an option code the question lacks → 422 `unknown_option`;
   - a multi-axis grid → 422 `read_only_surface`.
7. Restore: `PUT` with `rows: []`. The program's figures equal the baseline again.

## 5. Conditions over HTTP (Story 2)
1. `PUT /programs/<code>/conditions` with `business_months = over_24` OR `has_guarantor = yes`, reason `BUSINESS_TOO_NEW` → 200.
2. Simulate, and apply as a seeded customer, with each answer pair:

| Answers | Result |
|---|---|
| under_24 + no | refused, `gateId: condition:min_business_age`, `BUSINESS_TOO_NEW` |
| under_24 + yes | quotes |
| over_24 + no | quotes |

   The program is never missing from the list.
3. Preview equals apply on all three. The parity script shows 0 differences.
4. A criterion on `monthly_income` → 422 `engine_input`.
5. `GET /v1/questionnaire?category=…&programNameKey=<a name under the program>` → `business_months` and `has_guarantor` are required. `check:question-scope` stays clean (FR-008).
6. Restore: `PUT conditions: []`, re-run §2 → identical to the baseline. Delete the test applications.

## 6. Browser
- `/loan-engine` in light, dark, RTL and the ar-EG build, at 1440, 1024 and 720 px.
- Page overflow 0, console clean, focus visible.
- The side-sheet row editor uses `NzDrawerService` (full-viewport scrim, A34).
- Money and figure inputs use `appMoneyInput` (A27).
- The 012 question panel's tiles land on `/loan-engine?question=…&effect=…`.

## 7. Checks
- `check:codes`: +1 code (`LOAN_ENGINE_RULE_INVALID`) in sync across backend, ar-EG and en-US.
- `check:income-proof`, `check:parent-keys`, `check:questionnaire`, `check:question-scope`, `check:money`, `check:conditions`.
- `tsc` on both; lint ≤ HEAD on the touched files.
- Backend and admin suites green.
- Both locale builds, with untranslated ids equal to a HEAD worktree.
