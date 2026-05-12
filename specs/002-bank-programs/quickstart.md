# Quickstart: BankProgram Management (Feature 002)

**Audience**: Masrafy operators (admin + super_admin) + developers verifying a fresh environment.
**Prerequisites**: Feature 001 admin auth shipped + dev infrastructure up per the root [CLAUDE.md](../../CLAUDE.md).

This walkthrough takes a fresh local environment from boot to a configured bank program live in the matching-engine candidate list, end-to-end. Steps marked **dev** are infrastructure; steps marked **operator** are dashboard flows you'll repeat per-program.

---

## §1 · Bring up infrastructure (dev)

```bash
# from repo root
docker compose -f docker/compose.dev.yml up -d postgres redis
```

## §2 · Apply the bank-program migration (dev)

```bash
cd backend
npx prisma migrate dev --name add_bank_programs
npx prisma generate
```

Migration creates the `BankProgram` table + the `searchVector` GIN index + the new `AuditEventType` enum members.

## §3 · Start backend + admin (dev)

```bash
# terminal 1
cd backend && npm run start:dev          # http://localhost:3000

# terminal 2
cd admin && npm start                    # http://localhost:5173
```

OpenAPI docs at `http://localhost:3000/api/docs`.

## §4 · Sign in (operator)

Open `http://localhost:5173`. Sign in with the bootstrap super_admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `backend/.env` — set up in feature 001's quickstart).

## §5 · Seed the ABK Egypt catalog (super_admin only)

From the dashboard sidebar → **Bank programs** → **Seed catalogs** → **ABK Egypt 2026** → confirm.

Or via API:

```bash
curl -X POST http://localhost:3000/api/admin/bank-programs/seeds/abk \
  -H "Authorization: Bearer $JWT_ACCESS_TOKEN"
```

The response lists every catalog entry with `status: 'created' | 'skipped'` and the verified rate. Re-running is idempotent.

**Optional — competitor catalogs**:

```bash
# Sales-floor catalog from the spec appendix (4 products: SF-BLUE-PLUS, SF-SELF-EMP, SF-HIGH-END, SF-AUTO)
curl -X POST http://localhost:3000/api/admin/bank-programs/seeds/competitor/salesfloor-egp-2026 \
  -H "Authorization: Bearer $JWT_ACCESS_TOKEN"

# Bank NXT example competitor
curl -X POST http://localhost:3000/api/admin/bank-programs/seeds/competitor/bank-nxt-2026 \
  -H "Authorization: Bearer $JWT_ACCESS_TOKEN"
```

If any rate fails verification, the response carries `code: SEED_RATE_VERIFICATION_FAILED` with the mismatched programs listed and the seed is rolled back.

## §6 · List + filter (operator)

Open **Bank programs**. You should see the 20 ABK programs (+ any competitor programs you seeded). Try:

- Filter: **Active = true** + **Product category = personal**
- Search: type `bank` — matches by `bankName`; type `قروض` — matches by `friendlyNameAr`.
- Sort by **Rate** to inspect cascade-resolved base/effective rates.

Each row shows `programCode`, `friendlyName`, `bankName`, `productCategory`, `currencies`, base or effective rate, deprecation-warning badge if any, and a role-gated action menu.

## §7 · Open a program and inspect the cascade preview (operator)

Click any seeded program — e.g., `ABK-AUTO-CARS` (or the seeded `SF-AUTO` if you ran the salesfloor catalog).

In the detail view, scroll to **Try a sample applicant**. Pick:

- Employment type: `salaried`
- Transfer type: `payroll_cat_a`
- Tenor: 60 months
- Down payment: 35 %
- Asset value: 3,200,000 EGP

The cascade preview should render:

```
Rate cascade:
  rateByDownPaymentPercent: matched 30 % band (applicant 35 %)  → 25.5000 %  ✓
  Result: 25.5000 %
  Fee waiver: not applicable
  Insurance waiver: not applicable
```

Change down payment to 45 % → the cascade jumps to the 45-band (22.5000 %). Change to 65 % → still resolves to the 60-band (21.7500 %) per the floor-to-≤ rule.

Set asset value to 4,500,000 → if the program seeded the asset-value band, the resolved rate adjusts (e.g., 24.5000 % at 30 % down + > 4M car) and the derivation chip renders `"24.5 % = 25.5 % from down-payment band − 1 % high-value-car discount"`.

## §8 · Create a brand-new program from scratch (operator)

Click **Add bank program** (top-right). The side-drawer opens with these sections:

1. **Identity** — programCode, bankName, friendlyName (+ Arabic), programType, productCategory, currencies, active toggle.
2. **Tenor** — min/max months + tier overrides.
3. **Loan limits** — per-currency min/max + tier overrides + qualitativeReviewMaxEGP (gated by eligibility flag).
4. **Pricing** — isVariableRate toggle, base or current effective rate, cascade tier maps.
5. **Eligibility** — accepted employment types, age range, income gates, boolean flags (incl. `requiresQualitativeReview`, `requiresNoDocuments`, wealth gates).
6. **Performance criteria** (optional) — MOB gates for buyout / cross-sell programs.
7. **Income-assumption** — strategy switcher; only the selected strategy's table is visible.
8. **Fees** — admin fee, stamp duty, life insurance, late-payment, payoff.

Validation runs on blur. Submit is disabled until the form is structurally valid. The footer shows the cascade-determinism note: "Rate cascade is frozen at the platform level — see FR-008b."

Submit. Toast: "Bank program created." You return to the list with the new program visible.

## §9 · Edit + version conflict (operator)

Open the program you just created. Change `pricing.baseRatePercent` from 24 to 25. In a second browser tab, open the same program. Edit some field in tab 2 and save first. Now save tab 1 — you should see:

```
This program was changed by someone else; please reload.
(submittedVersion: 2, currentVersion: 3)
```

This is the optimistic-concurrency guard (FR-021). Click **Reload** in the toast, re-apply your edit against the current state, and save.

## §10 · Clone + toggle + delete (operator)

- **Clone**: in any row's action menu → **Clone** → enter a new programCode (e.g., `ABK-AUTO-V2`). The drawer opens in edit mode with every sub-config copied.
- **Toggle**: hit the active-toggle switch in the row. The program disappears from the matching candidates (verified by `GET /api/mobile/v1/bank-programs` no longer returning it).
- **Delete** (super_admin only): action menu → **Delete** → confirm by typing the program code. If the program has no `BankOffer` rows referencing it, deletion succeeds. If any exist, you receive `BANK_PROGRAM_HAS_OFFERS` with the offer count — deactivate instead.

## §11 · Mobile read-only API verification (dev)

```bash
# Set up a mobile-client HMAC secret (env-driven in dev; per-client in prod)
export MOBILE_CLIENT_ID=dev
export MOBILE_CLIENT_SECRET=dev-secret-please-change

TIMESTAMP=$(date +%s)
NONCE=$(uuidgen)
BODY_SHA=$(echo -n "" | shasum -a 256 | cut -d ' ' -f 1)
SIG_INPUT="GET\n/api/mobile/v1/bank-programs\n${TIMESTAMP}\n${NONCE}\n${BODY_SHA}"
SIG=$(printf "$SIG_INPUT" | openssl dgst -sha256 -hmac "$MOBILE_CLIENT_SECRET" | cut -d ' ' -f 2)

curl http://localhost:3000/api/mobile/v1/bank-programs \
  -H "X-Client-Id: $MOBILE_CLIENT_ID" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIG"
```

Confirm the response includes ONLY active programs and the reduced mobile shape (no `id`, no `version`, no internal tier maps, no `derivation`).

Attempt to GET an inactive program by code: expect `404 NOT_FOUND` with no metadata leakage.

## §12 · Locale + RTL verification (operator)

Toggle the dashboard locale to Arabic (top-bar locale menu). Every label, hint, validation message, and cascade descriptor MUST appear in Arabic. Layout flips to RTL. Monetary fields render with Egyptian Pound formatting; percentages render with `26.5500%` style.

Toggle back to English. Layout flips to LTR. Same data, same precision, locale-correct presentation.

## §13 · WCAG 2.2 AA spot-check (operator/dev)

- **Keyboard-only**: tab through the list → open a program → tab through every section of the create drawer → submit. Visible focus indicator at every stop. No mouse used.
- **Screen reader**: turn on macOS VoiceOver or NVDA. Each section header is announced. Each field's label + hint + validation state is announced when focused.
- **Contrast**: brand-navy CTAs on white meet AA contrast (≥ 4.5:1).

## §14 · Audit trail (operator)

From any program's detail view, open the **Audit timeline** drawer. You should see, in reverse-chronological order:

- `BANK_PROGRAM_CREATED` (your §8 create)
- `BANK_PROGRAM_UPDATED` (your §9 edit) — includes a structured diff
- `BANK_PROGRAM_RATE_UPDATED` (paired with §9 if you changed the rate)
- `BANK_PROGRAM_CLONED` (your §10 clone — the source program shows the event)
- `BANK_PROGRAM_TOGGLED` (your §10 toggle)
- `BANK_PROGRAM_DELETED` (your §10 delete, if you got that far)

Every event carries `actor`, `programCode`, `correlationId`, `occurredAt`, and a structured payload. ZERO applicant PII anywhere.

---

## Acceptance summary

Running all 14 sections end-to-end exercises every user story:

| User story | Sections |
|---|---|
| US1 (create) | §8 |
| US2 (list + view) | §6, §7 |
| US3 (edit + toggle) | §9, §10 |
| US4 (clone) | §10 |
| US5 (super_admin delete + mobile API) | §10, §11 |

Plus the constitutional gates: §12 (Principle IV i18n), §13 (Principle XXIII / a11y), §14 (Principles VI + VII observability).

If any section fails, log the failure to `specs/002-bank-programs/quickstart-failures.md` (create on demand) with the exact step, expected behaviour, observed behaviour, and a screenshot or curl-output excerpt — that goes into the matching impec polish pass.
