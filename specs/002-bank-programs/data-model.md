# Phase 1 Data Model: BankProgram Management

**Feature**: 002-bank-programs
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

This document captures the canonical entity shapes, relationships, validation rules, state transitions, and Prisma schema sketch. The storage decision (single JSONB blob per sub-config) is from R1; the cascade order is frozen per R2.

---

## Entity inventory

| Entity | Purpose | Storage shape |
|---|---|---|
| `BankProgram` | Top-level configuration aggregate per loan product | Postgres row + JSONB sub-configs |
| `BankProgramAuditEvent` | Append-only audit record (extends feature 001's `AuditEvent` table) | Postgres row (single audit table, polymorphic) |
| `PlatformEnumeration` | Read-only reference catalog (consumed via stub; feature 003 owns the registry) | In-memory stub for now |

Sub-configurations of `BankProgram` (each one a JSONB field on the parent row):

| Sub-config | Field path |
|---|---|
| Tenor configuration | `tenor` |
| Loan-limits configuration | `loanLimits` |
| Pricing configuration | `pricing` |
| Eligibility configuration | `eligibility` |
| Performance-criteria configuration | `performanceCriteria` |
| Income-assumption configuration | `incomeAssumption` |
| Fees configuration | `fees` |
| Required documents list | `requiredDocuments` |

---

## `BankProgram` — top-level entity

### Fields

| Field | Type | Constraints | Source |
|---|---|---|---|
| `id` | `uuid` | PK, default `uuid()` | server-generated |
| `programCode` | `string` | UNIQUE, NOT NULL, immutable post-create, `^[A-Z0-9_-]{3,32}$` | FR-001, FR-012 |
| `bankName` | `string` | NOT NULL, length 1–80 | FR-001 |
| `friendlyName` | `string` | NOT NULL, length 1–120 | FR-001 |
| `friendlyNameAr` | `string?` | optional Arabic display name | FR-034 |
| `programType` | `enum` `'income_proof' \| 'income_surrogate'` | NOT NULL | FR-001 |
| `productCategory` | `string` (resolves to `PlatformEnumeration.product_category`) | NOT NULL | FR-001 |
| `currencies` | `string[]` (ISO 4217 codes; resolves to `PlatformEnumeration.currency`) | NOT NULL, default `['EGP']`, min 1 | FR-001, FR-008g |
| `active` | `boolean` | NOT NULL, default `true` | FR-024 |
| `version` | `integer` | NOT NULL, default 1, increments on every persisted save | FR-021, R14 |
| `operatorNotes` | `string?` (max 4000) | free-form internal notes | FR-001 |
| `operatorTips` | `string[]` (each ≤ 500 chars, max 20 entries) | free-form internal tips | FR-001 |
| `requiredDocuments` | `string[]` (max 50 entries; each resolves to `PlatformEnumeration.required_document`) | NOT NULL, default `[]` | FR-001 |
| `tenor` | `JSONB` (shape = TenorConfig) | NOT NULL | FR-002 |
| `loanLimits` | `JSONB` (shape = LoanLimitsConfig) | NOT NULL | FR-003, FR-003a |
| `pricing` | `JSONB` (shape = PricingConfig) | NOT NULL | FR-004 |
| `eligibility` | `JSONB` (shape = EligibilityConfig) | NOT NULL | FR-005, FR-005c, FR-005c.1, FR-005d |
| `performanceCriteria` | `JSONB?` (shape = PerformanceCriteriaConfig) | nullable (only buyout + cross-sell programs configure) | FR-005a, FR-005b |
| `incomeAssumption` | `JSONB` (shape = IncomeAssumptionConfig) | NOT NULL | FR-006 |
| `fees` | `JSONB` (shape = FeesConfig) | NOT NULL | FR-007 |
| `searchVector` | `tsvector` (GENERATED ALWAYS AS …) | GIN-indexed | R9 |
| `createdAt` | `timestamp` | NOT NULL, default `now()` | audit |
| `updatedAt` | `timestamp` | NOT NULL, updated on every save | audit |
| `createdBy` | `uuid` (FK → `StaffAccount.id`) | NOT NULL | audit |
| `updatedBy` | `uuid` (FK → `StaffAccount.id`) | NOT NULL | audit |

### Relationships

- `BankProgram` ↔ `BankProgramAuditEvent` — one-to-many (each event references one program; deletes preserved by audit-event retention rule).
- `BankProgram` ↔ `BankOffer` (future matching feature) — one-to-many; offers snapshot bank-program values at match time and are NEVER mutated when the program changes (FR-020, Principle I).
- `BankProgram` ↔ `StaffAccount` (`createdBy` / `updatedBy`) — many-to-one.

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `bank_program_program_code_key` | `programCode` (UNIQUE) | FR-012 |
| `bank_program_active_idx` | `active` (partial WHERE `active = true`) | mobile list endpoint hot path |
| `bank_program_bank_name_idx` | `bankName` | filter by bank |
| `bank_program_product_category_idx` | `productCategory` | filter by category |
| `bank_program_search_idx` | `searchVector` (GIN) | FR-016 bilingual search |
| `bank_program_audit_event_program_id_occurred_at_idx` | `bankProgramId, occurredAt DESC` | detail-view audit timeline |

### State transitions

```text
[ created ] → active = true → [ active ]
[ active ] ⇄ toggle → [ inactive ]
[ active | inactive ] → super_admin delete + no referencing offers → [ deleted (hard) ]
[ active | inactive ] → super_admin delete + has offers → REJECTED (BANK_PROGRAM_HAS_OFFERS)
```

Clone is a `[created]` event for the new program; source program state unchanged.

Version field increments on: create (1), every update (n → n+1), toggle (n → n+1), clone-source (no increment — clone is a new program, not an edit of the source), rate-update (n → n+1, same save path as update).

---

## Sub-configuration: `TenorConfig`

```ts
type TenorConfig = {
  minMonths: number;                        // integer ≥ 1
  maxMonths: number;                        // integer ≤ 480 (40-year cap)
  maxMonthsBySalaryCategory?: Record<string, number>;   // keys resolve to PlatformEnumeration.salary_category
  maxMonthsByEmploymentType?: Record<string, number>;   // keys resolve to PlatformEnumeration.employment_type
};
```

**Validation**:
- `minMonths < maxMonths` strict (FR-009).
- All override values must be `> 0` and `≤ maxMonths` (a per-tier max larger than the program max is a configuration error).
- All keys validated against `PlatformEnumerationRepository.isActiveMember(type, key)` at save time.

---

## Sub-configuration: `LoanLimitsConfig`

```ts
type LoanLimitsConfig = {
  // Per-currency bounds; currency code → bounds. Validation REQUIRES one entry per program.currencies member.
  perCurrency: Record<string, {
    minAmount: Decimal;    // DECIMAL(13,2)
    maxAmount: Decimal;    // DECIMAL(13,2)
  }>;
  maxByCDTier?: Array<{ minCDValueEGP: Decimal; maxAmountEGP: Decimal }>;     // range-keyed, floor-to-≤
  maxByPropertyType?: Record<string, Decimal>;             // keys → PlatformEnumeration.property_type
  maxByCityTier?: Record<string, Decimal>;                 // keys → PlatformEnumeration.city_tier
  maxByTransferType?: Record<string, Decimal>;             // keys → PlatformEnumeration.transfer_type
  maxBySalaryCategory?: Record<string, Decimal>;           // keys → PlatformEnumeration.salary_category
  maxByEmploymentType?: Record<string, Decimal>;           // keys → PlatformEnumeration.employment_type
  maxByPerformanceTier?: Record<string, Decimal>;          // keys → PlatformEnumeration.performance_tier (MOB bands)
  maxTopUpEGP?: Decimal;
  ltvCeilingPercent?: Decimal;                              // DECIMAL(7,4); for secured loans
  qualitativeReviewMaxEGP?: Decimal;                        // FR-003a — operator-uplift ceiling
  otherCitiesMaxEGP?: Decimal;                              // rural cap override
};
```

**Validation**:
- For every currency in `program.currencies`, `perCurrency[currency]` MUST exist with `minAmount < maxAmount`.
- `qualitativeReviewMaxEGP` REQUIRES `eligibility.requiresQualitativeReview === true` (FR-003a) — else reject with `INVALID_QUALITATIVE_REVIEW_CEILING`.
- `qualitativeReviewMaxEGP > perCurrency.EGP.maxAmount` strict (FR-003a) — else reject with `QUALITATIVE_REVIEW_CEILING_BELOW_BASE`.
- `maxByCDTier` entries sorted by `minCDValueEGP` ascending; bands evaluated floor-to-≤ per R2.

---

## Sub-configuration: `PricingConfig`

```ts
type PricingConfig = {
  isVariableRate: boolean;
  baseRatePercent?: Decimal;                                // DECIMAL(7,4); REQUIRED when isVariableRate=false
  currentEffectiveRatePercent?: Decimal;                    // REQUIRED when isVariableRate=true
  variableRateNote?: string;                                // free-form disclosure text
  spreadMinPercent?: Decimal;
  spreadMaxPercent?: Decimal;

  rateByEmploymentType?: Record<string, RateBandValue>;
  rateBySeniority?: Record<string, RateBandValue>;
  rateByTransferType?: Record<string, RateBandValue>;       // includes payroll_cat_a / payroll_cat_b / etc.
  rateByTenor?: Record<string, RateBandValue>;              // key = months bucket, e.g., "1-6y" or "84"
  rateByTenorAndCustomerType?: Record<string, RateBandValue>;  // composite key, e.g., "salaried_lt_5y"
  rateByDownPaymentPercent?: Record<string, RateBandValue>;    // range-keyed; FR-008o + FR-008o.1
  rateByCustomerProgramTier?: Record<string, RateBandValue>;
  rateByAssetValueBand?: Record<string, RateBandValue>;        // range-keyed; FR-008p + FR-008p.1
  rateByLoanAmountBand?: Record<string, RateBandValue>;        // range-keyed

  buyoutRateDeltaPercent?: Decimal;                         // negative-allowed
  buyoutRateMinFloorPercent?: Decimal;                      // clamp floor

  feeWaiverEnabledAtRatePercent?: Decimal;                  // FR-008j
  feeWaiverMinTenorMonths?: number;
  feeWaiverPenaltyRatePercent?: Decimal;                    // FR-008k default 2.0
  feeWaiverPenaltyMinTenorMonths?: number;                  // default 36
  insuranceWaiverPenaltyRatePercent?: Decimal;              // FR-008r default 2.0
  insuranceWaiverPenaltyMinTenorMonths?: number;            // default 36
};

type RateBandValue = {
  value: Decimal;                                           // DECIMAL(7,4); the rate the cascade selects
  derivation?: DerivationChain;                             // FR-008s — documentation only
};

type DerivationChain = {
  sourceRatePercent: Decimal;
  deltaPercent: Decimal;                                    // signed
  reason: string;                                           // operator-readable
};
```

**Validation**:
- `isVariableRate === true` ⇒ `currentEffectiveRatePercent` REQUIRED, `baseRatePercent` MUST be null (FR-011a) — else reject with `INVALID_VARIABLE_RATE_CONFIGURATION`.
- `isVariableRate === false` ⇒ `baseRatePercent` REQUIRED, `currentEffectiveRatePercent` MUST be null.
- For every `RateBandValue` with `derivation` present: `|derivation.sourceRatePercent + derivation.deltaPercent − value| ≤ 0.0001` (FR-008s) — else reject with `DERIVATION_ARITHMETIC_MISMATCH`.
- Range-keyed tier maps (`rateByDownPaymentPercent`, `rateByAssetValueBand`, `rateByLoanAmountBand`) keys MUST parse as positive decimals; cascade evaluator applies floor-to-≤ at match time (R2).
- All discrete keys validated against the `PlatformEnumeration` registry at save time.

---

## Sub-configuration: `EligibilityConfig`

```ts
type EligibilityConfig = {
  acceptedEmploymentTypes: string[];                        // keys → PlatformEnumeration.employment_type
  ageMin: number;                                           // integer years
  ageMax: number;
  ageMinSelfEmployed?: number;
  ageMaxSelfEmployed?: number;
  minMonthlyIncomeEGP: Decimal;
  minMonthlyIncomeSelfEmployedEGP?: Decimal;
  minMonthsInJob: number;                                   // integer ≥ 0
  minMonthsInJobBySalaryCategory?: Record<string, number>;
  acceptedLoanPurposes: string[];                           // keys → PlatformEnumeration.loan_purpose
  dbrCapPercent: Decimal;                                   // default 50.0
  skipDbrCheck: boolean;                                    // default false; true for secured
  acceptedTransferTypes: string[];                          // keys → PlatformEnumeration.transfer_type

  // Boolean flags (FR-005) — defaults false unless noted
  requiresCD: boolean;
  requiresAutoLoanAtABK: boolean;
  requiresAutoLoanAtOtherBank: boolean;
  requiresCreditCardAtOtherBank: boolean;
  requiresCompoundProperty: boolean;
  requiresCollateral: boolean;
  requiresClubMembership: boolean;
  requiresExistingLoan: boolean;
  requiresFRMUVerification: boolean;
  requiresQualitativeReview: boolean;                       // FR-005c gate for FR-003a uplift
  requiresNoDocuments: boolean;                             // FR-005d — separate candidate pool

  minimumCreditCardHoldingMonths?: number;
  competitorCardMustBeUnsecured?: boolean;
  eligibleCarPriceMinEGP?: Decimal;
  eligibleDownPaymentPercent?: Decimal;
  clubClass?: string;
  compoundClass?: string;
  companyType?: string[];                                   // keys → PlatformEnumeration.company_type
  commercialBankIncomePercent?: Decimal;
  publicBankIncomePercent?: Decimal;

  // Wealth-tier gates (FR-005c + FR-005c.1)
  minBankStatementBalanceEGP?: Decimal;                     // AND-combined with minAssetsValueEGP when both set
  minAssetsValueEGP?: Decimal;
};
```

**Validation**:
- `ageMin < ageMax` strict (FR-009).
- `minMonthsInJob ≥ 0`.
- When `requiresQualitativeReview === false`, `loanLimits.qualitativeReviewMaxEGP` MUST be null (FR-003a).
- When BOTH `minBankStatementBalanceEGP` AND `minAssetsValueEGP` are non-null, the matching engine combines them with AND (FR-005c.1) — no schema-level enforcement needed; this is matching-engine behaviour.
- `requiresNoDocuments` programs MUST have `loanLimits.perCurrency.EGP.maxAmount ≤ 1_000_000` (soft warning, not block — operator may override with explicit confirmation; FR-005d's spirit).

---

## Sub-configuration: `PerformanceCriteriaConfig`

```ts
type PerformanceCriteriaConfig = {
  requiredMOBMonths: number;                                // integer
  iScoreMOBPerformanceCheck: boolean;
  bkt1NoHitWithinMonths?: number;
  bkt2NoHitWithinMonths?: number;
  requireCurrentLoanStatus: boolean;
};
```

Hybrid evidence source (FR-005b) — declared by applicant + optional bureau auto-verify; `selfDeclared: true` badge on the resulting offer when bureau is unavailable. Evidence collection + verification are NOT this feature's concern; this feature ships the gate definitions only.

---

## Sub-configuration: `IncomeAssumptionConfig`

```ts
type IncomeAssumptionConfig =
  | { strategy: 'declared' }
  | {
      strategy: 'byYearsInJob' | 'byYearsInPractice';
      incomeTable: Array<{ minYears: number; maxYears: number; incomeEGP: Decimal }>;
    }
  | { strategy: 'byProfessorRank'; rankIncomeMap: Record<string, Decimal> }       // keys → PlatformEnumeration.professor_rank
  | { strategy: 'byMilitaryGrade'; gradeIncomeMap: Record<string, Decimal> }       // keys → PlatformEnumeration.military_grade
  | {
      strategy: 'byCDValue';
      incomeTable?: Array<{ minCDValueEGP: Decimal; assumedIncomeEGP: Decimal }>;
      cdIncomePercent?: Decimal;
      cdIncomeMinEGP?: Decimal;
      cdIncomePercentOfDeposits?: Decimal;
      combinationRule?: 'lesser_of' | 'greater_of';                                // FR-006
    }
  | { strategy: 'byCarInstallment'; carInstallmentMultiplier: Decimal }
  | { strategy: 'byCarLoanAmount'; carLoanAmountPercent: Decimal }
  | { strategy: 'byCreditCardLimit'; creditCardLimitMultiplier: Decimal }
  | { strategy: 'byBankStatementPercent'; bankStatementPercent: Decimal };
```

**Validation** (FR-011):
- Discriminated union — the table appropriate to the strategy MUST be present and structurally valid.
- `byYearsInJob` / `byYearsInPractice`: `minYears < maxYears` per band; bands non-overlapping.
- `byCDValue` with both `cdIncomePercent` AND `cdIncomePercentOfDeposits` MUST declare `combinationRule`.
- All discrete keys validated against `PlatformEnumeration`.

---

## Sub-configuration: `FeesConfig`

```ts
type FeesConfig = {
  adminFeePercent: Decimal;                                 // 0.0000 allowed (CD holders, High End)
  adminFeeDisplay?: string;                                 // localized human-readable; e.g., "0% — waived for CD holders"
  adminFeeRangeMin?: Decimal;                               // secured loans quote a range
  adminFeeRangeMax?: Decimal;
  stampDutyPercent: Decimal;                                // default 0.5
  lifeInsurancePercent: Decimal;                            // default 0.5
  lifeInsuranceMandatory: boolean;                          // default false (true for pensions)
  lifeInsuranceMinLoanEGP?: Decimal;                        // self-employed: only mandatory above this loan
  latePaymentFeePercent: Decimal;                           // default 4.0
  payoffCashPercent: Decimal;                               // default 12.0
  payoffBuyoutPercent: Decimal;                             // default 15.0
  collateralReplacementFeeEGP?: Decimal;                    // flat fee, secured loans only
  collateralDecreaseFeeEGP?: Decimal;                       // flat fee, secured loans only
};
```

**Validation**:
- All percentages within `[0.0000, 100.0000]`.
- `adminFeeRangeMin ≤ adminFeeRangeMax` when both set.

---

## `BankProgramAuditEvent` — extends feature 001's `AuditEvent`

Single audit table from feature 001; new event-type enum values added via migration. Discriminated payload typed by event type (see R6 in research.md for full table).

```ts
// New AuditEventType enum values:
type BankProgramEventType =
  | 'BANK_PROGRAM_CREATED'
  | 'BANK_PROGRAM_UPDATED'
  | 'BANK_PROGRAM_TOGGLED'
  | 'BANK_PROGRAM_CLONED'
  | 'BANK_PROGRAM_DELETED'
  | 'BANK_PROGRAM_RATE_UPDATED'
  | 'BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED';
```

Payload schemas live in `backend/src/audit/payloads/bank-program.payloads.ts` and are validated at write time. No PII in any payload (Principle VI).

---

## `PlatformEnumeration` — read-only stub

```ts
interface PlatformEnumerationRepository {
  isActiveMember(type: EnumerationType, key: string): Promise<boolean>;
  getActiveMembers(type: EnumerationType): Promise<EnumerationMember[]>;
  isAvailable(): Promise<boolean>;     // fail-closed when false
}

type EnumerationType =
  | 'salary_category'
  | 'transfer_type'
  | 'employment_type'
  | 'loan_purpose'
  | 'property_type'
  | 'city_tier'
  | 'professor_rank'
  | 'military_grade'
  | 'product_category'
  | 'customer_program_tier'
  | 'performance_tier'
  | 'company_type'
  | 'required_document'
  | 'currency';

type EnumerationMember = {
  type: EnumerationType;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  deprecated: boolean;
};
```

Stub seeds members at boot (R4). Feature 003 will swap the implementation behind the same interface.

---

## Prisma schema sketch

```prisma
model BankProgram {
  id                  String   @id @default(uuid()) @db.Uuid
  programCode         String   @unique @db.VarChar(32)
  bankName            String   @db.VarChar(80)
  friendlyName        String   @db.VarChar(120)
  friendlyNameAr      String?  @db.VarChar(120)
  programType         BankProgramType
  productCategory     String   @db.VarChar(64)
  currencies          String[] @db.VarChar(3)
  active              Boolean  @default(true)
  version             Int      @default(1)
  operatorNotes       String?  @db.VarChar(4000)
  operatorTips        String[] @db.VarChar(500)
  requiredDocuments   String[] @db.VarChar(80)

  tenor               Json
  loanLimits          Json
  pricing             Json
  eligibility         Json
  performanceCriteria Json?
  incomeAssumption    Json
  fees                Json

  // Generated tsvector column declared at SQL level (not yet a first-class Prisma type;
  // emitted via Unsupported() + a migration-time `GENERATED ALWAYS AS … STORED` clause)
  // searchVector       Unsupported("tsvector")

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  createdBy           String   @db.Uuid
  updatedBy           String   @db.Uuid

  createdByStaff      StaffAccount @relation("BankProgramCreatedBy", fields: [createdBy], references: [id])
  updatedByStaff      StaffAccount @relation("BankProgramUpdatedBy", fields: [updatedBy], references: [id])

  auditEvents         AuditEvent[] @relation("BankProgramAuditEvents")

  @@index([active])
  @@index([bankName])
  @@index([productCategory])
}

enum BankProgramType {
  income_proof
  income_surrogate
}

// AuditEventType enum (existing) — new values added:
//   BANK_PROGRAM_CREATED
//   BANK_PROGRAM_UPDATED
//   BANK_PROGRAM_TOGGLED
//   BANK_PROGRAM_CLONED
//   BANK_PROGRAM_DELETED
//   BANK_PROGRAM_RATE_UPDATED
//   BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED
```

Search vector + GIN index added in a follow-up raw-SQL migration block (Prisma `migration.sql` supports raw SQL):

```sql
ALTER TABLE "BankProgram"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', lower(coalesce("programCode", ''))), 'A') ||
    setweight(to_tsvector('simple', lower(coalesce("friendlyName", ''))), 'B') ||
    setweight(to_tsvector('simple', lower(coalesce("friendlyNameAr", ''))), 'B')
  ) STORED;

CREATE INDEX "bank_program_search_idx" ON "BankProgram" USING GIN ("searchVector");
```

---

## Open data-model TODOs (none blocking)

- The `BankOffer` model is a forward dependency for FR-027 (refuse delete when offers reference the program). The matching feature will introduce that model; this feature's delete endpoint queries `BankOffer.count({ where: { bankProgramId } })` and refuses on count > 0. Until the matching feature lands, the table is empty and all deletes succeed — acceptable interim state.
