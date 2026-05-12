# Phase 0 Research: Matching Engine

**Feature**: 003-matching-engine-post
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md) (68 FRs, 22 SCs, 5 clarifications, 14 golden scenarios)
**Plan**: [plan.md](./plan.md)

All NEEDS-CLARIFICATION items from Technical Context = NONE — the 5 clarifications recorded in `spec.md` settled the remaining cross-cutting questions. This document captures the remaining technical decisions for engine architecture, PMT precision, HMAC verification, idempotency cache, retention pipeline, PII masking, rate-limit guard composition, suggestions implementation, and testing strategy.

---

## R1. Engine module boundary — pure module vs NestJS service

**Decision**: Pure module at `backend/src/matching/`. Entry point `match(profile, programs)` is a plain function exported from `engine/match.ts`. NO `@Injectable()` decorator on the engine itself. The wrapping `MatchingModule` registers only the suggestions helper (also pure) for DI convenience, but the engine function is callable WITHOUT going through DI.

**Rationale**:
- Principle V (matching engine is the core IP) — the engine MUST be importable by future ML / batch features without booting NestJS.
- FR-002 forbids HTTP / DB / DI imports.
- SC-019 mandates a dependency-graph audit — easier to enforce when the module exports a function, not a class.
- Pure functions trivially achieve determinism (SC-002).

**Alternatives considered**:
- `@Injectable() MatchingService` with `match()` method: idiomatic NestJS but couples the engine to the DI container; future CLI / batch features must spin up an Nest application context to invoke. Rejected — violates Principle V's reuse intent.
- Separate npm workspace package (`packages/matching-engine`): cleanest extraction, but adds workspace + tsconfig project-reference overhead that doesn't pay off until a second consumer exists. Defer to a future extraction PR.

**Boundary enforcement**:
- ESLint rule (research R3) — `matching/` may only import from itself + `@prisma/client` (for `Prisma.Decimal` types) + a types-only file from `bank-programs/cascade/cascade.types.ts`.
- The `match.ts` entry imports `evaluatePricing` / `evaluateLoanLimit` / `evaluateTenor` from `@/bank-programs/cascade/cascade.evaluator` — that module is ALREADY pure (feature 002 research R2), so importing it preserves Principle V.

---

## R2. PMT computation precision + banker's rounding

**Decision**: PMT computed in `Prisma.Decimal` arithmetic with intermediate precision 20 digits. Final installment rounded to 2 decimals using banker's rounding (round-half-to-even — `ROUND_HALF_EVEN` in `Decimal.js`'s rounding modes). Annual rate divided by 100 then by 12 to get monthly rate. Tenor (months) is integer.

**Formula** (FR-026):
```
r = annualRate / 100 / 12        // Decimal
factor = (1 + r) ^ n             // Decimal.pow(1 + r, n)
installment = P * r * factor / (factor - 1)
```

**Special cases**:
- Zero-rate program (`annualRate === 0`): `installment = P / n` (exact division, rounded banker).
- `n === 0` is rejected at DTO validation (FR-042 enforces `preferredTenorMonths >= 6`).

**Rationale**:
- Principle I — `Decimal` only, no floats. Anti-pattern A3 protected.
- Banker's rounding matches Egyptian banking convention; documented by Central Bank circulars.
- Intermediate precision 20 digits absorbs `factor = (1+r)^n` precision loss at n = 360 months.

**Alternatives considered**:
- IEEE 754 `number` with multiplication-by-100 trick: rejected — drift on long tenors + multiplication chains is observable + violates Principle I.
- Closed-form approximation: rejected — banking-grade precision requires exact PMT.

---

## R3. Boundary enforcement — ESLint rule for engine purity

**Decision**: Add ESLint rule `no-restricted-imports` scoped to `backend/src/matching/**/*.ts` files. Allowed imports:
- `@/matching/**` (intra-module)
- `@prisma/client` (Decimal type ONLY — verified by an additional regex rule)
- `@/bank-programs/cascade/cascade.evaluator` (the pure cascade module from feature 002)
- `@/bank-programs/cascade/cascade.types` (types-only)
- Node built-ins: `node:crypto` (for sha256 in pii-mask)

Forbidden:
- `@nestjs/*`, `@/applications/*`, `@/auth/*`, `@/common/*` (the engine has its own narrow utility set — copy what's needed, don't import side-effecting modules)
- `axios`, `fetch`, `node-fetch`, `https`, `http`
- `@/audit/*`, `@/users/*`, `@/health/*`
- `winston`, `pino`, `console.*` (use returned trace strings instead of logging)

**Rationale**: SC-019 binds the engine's dependency graph. ESLint enforcement catches drift at PR time instead of waiting for the sanity-check script to fail.

**Alternatives considered**: dependency-cruiser. Same result + more capable but adds a new tool. ESLint already runs in CI from feature 001.

---

## R4. Engine internal architecture — function pipeline vs class

**Decision**: Function pipeline. `match(profile, programs)` iterates programs; per program runs a fixed sequence: eligibility → income resolution → tier resolution → PMT → DBR → fees + waivers → approval probability → result mapping. Each step is a pure function in its own file. The dispatcher returns a `MatchResult[]` collected before the ranking step.

Sequence (per program):

```
forEach program in programs:
  Step 1. evaluateEligibility(profile, program) → { passedChecks[], failedChecks[] }
            includes: employment, age, income-min-floor, tenure, loan-purpose,
                       transfer-type, currency, required-X flags, wealth-gate,
                       performance-criteria, no-documents
  Step 2. if failedChecks > 0 → record MatchResult { eligible: false, failedChecks } → continue
  Step 3. resolveIncome(profile, program) → effectiveIncome (or reject with INCOME_LOOKUP_FAILED)
  Step 4. resolveTier(profile, program) → { effectiveRate, effectiveLoanLimit, effectiveTenor, cascadeTrace }
  Step 5. effectiveLoanAmount = min(profile.requestedAmount, program.loanLimits.max, effectiveLoanLimit)
            effectiveTenorMonths = min(profile.preferredTenor, effectiveTenor)
  Step 6. installment = pmt(effectiveLoanAmount, rateWithPenalties, effectiveTenorMonths)
  Step 7. fees = computeFees(effectiveLoanAmount, program, ratePostCascade)
            applies waivers + penalties (FR-028, FR-029, FR-030)
  Step 8. dbrPass = evaluateDbr(profile, installment, program) → boolean or maxLoanAvailable
            if dbrPass = false → record MatchResult { eligible: false, failedChecks: ['DBR_EXCEEDED'], offer.maxLoanAvailableEGP }
  Step 9. approvalProb = computeApprovalProbability(profile, program, effectiveRate, dbr)
  Step 10. matchReasons[] = derivePositiveReasons(profile, program)
  Step 11. record MatchResult { eligible: true, offer: { ... }, cascadeTrace }

After loop:
  Step 12. rankResults(results, priority) → sorted MatchResult[]
```

**Rationale**:
- Each step is independently testable.
- Pipeline order is fixed by spec FRs — no per-program variation.
- DBR is intentionally AFTER PMT so the engine knows the new-installment value before computing the burden ratio.

**Alternatives considered**:
- Class with internal state (`MatchContext`): rejected — purity is non-negotiable; state is awkward + invites mutation.
- Visitor pattern: over-engineered for 12 fixed steps.

---

## R5. Storage shape — Application + BankOffer tables

**Decision**:
- `application` table — single row per submission. Top-level scalar columns for status, dates, applicantUserId (nullable for guest), idempotencyKey (nullable), submissionCorrelationId. JSONB columns for `applicantProfile` (the full submitted DTO), `summary` (`{ totalProgramsChecked, eligibleCount, primaryFailureReason }`), `noMatchSummary` (nullable; only populated when status = `no_match`).
- `bank_offer` table — one row per matched program. Foreign key to application. Scalar columns for everything that matters at index / sort time: programCode, programVersion, currency, effectiveRatePercent, monthlyInstallmentEGP, requestedLoanAmountEGP, effectiveLoanAmountEGP, requestedTenorMonths, effectiveTenorMonths, approvalProbabilityPercent, qualitativeReviewBadge, selfDeclared, createdAt. JSONB columns for `feesBreakdown`, `cascadeTrace`, `requiredDocuments`, `matchReasons`. NEVER mutated post-creation (FR-046).
- Indexes: `application(status, createdAt DESC)` for the list filter; `application(applicantUserId)` for "my applications" later; `bank_offer(applicationId)` for detail-page join; `bank_offer(programCode, createdAt DESC)` for analytics later; `application(idempotencyKey, expiresAt)` partial index where idempotencyKey IS NOT NULL.

**Rationale**:
- Top-level scalar columns for query-shaped fields keeps the list page fast (`status` + `createdAt` + `loanPurpose` filters → index-only scans). JSONB for variable-shape blobs (profile, fees, trace, documents) — same shape used in feature 002 BankProgram.
- Single row + N offer rows ≠ one denormalized blob — staff detail view + analytics both benefit from per-offer rows.
- FR-046 immutability enforced at the application layer (`bank_offer` is insert-only via the repository; no `update()` method).

**Alternatives considered**:
- Everything in a single JSONB column on `application`: harder to query; analytics on rate / installment becomes painful.
- Per-program offer table partitioned by `programCode`: premature optimization at our scale; standard b-tree on `programCode` is fine.

---

## R6. HMAC signature verification + nonce replay protection

**Decision**: Adopt the canonical scheme from Constitution Principle XIII:

```
SignatureBase = "{method}\n{path}\n{timestamp}\n{nonce}\n{sha256(body)}"
Signature = HMAC-SHA256(clientSecret, SignatureBase) → hex
```

Request headers:
- `X-Client-Id`: opaque mobile-client identifier
- `X-Timestamp`: unix seconds, ±5 min tolerance vs server clock
- `X-Nonce`: client-generated uuid v4 (single-use within 5 min window)
- `X-Signature`: hex HMAC

Server-side verification:
1. Look up `clientSecret` by `X-Client-Id` (env-mapped at startup; future feature 005 = mobile client registry).
2. Reconstruct `SignatureBase`, compute expected signature, constant-time-compare against `X-Signature`. Mismatch → 401 `UNAUTHENTICATED`.
3. Verify `|now - X-Timestamp| ≤ 5 minutes`. Reject otherwise.
4. Check Redis nonce store at key `mobile:nonce:{client_id}:{nonce}`. If present → 401 `UNAUTHENTICATED` (replay). Else `SETEX` with 5-minute TTL.
5. Set `req.mobileClientId = X-Client-Id` for downstream guards.

**Rationale**:
- Constitution Principle XIII fixes the shape; this research entry just nails the operational details.
- 5-minute timestamp window balances clock skew vs replay attack surface.
- Nonce store in Redis with TTL = window — automatically GC'd.
- Constant-time compare prevents timing attacks.

**Alternatives considered**:
- JWT-style bearer tokens: simpler but susceptible to replay without an additional nonce mechanism, and we already operate Redis.
- mTLS: stronger but adds cert-management burden for mobile clients before launch.

---

## R7. Retention pipeline — 24-month archival + erasure

**Decision**: Two coordinated mechanisms:

### Archival (FR-063)
- A cron job (`archive.scheduler.ts`) runs daily at 02:00 Africa/Cairo.
- Selects applications where `status IN ('matched', 'no_match') AND createdAt < now() - INTERVAL '24 months' AND status != 'archived'`.
- For each: streams the application + offer rows to S3 as `applications/{yyyy}/{mm}/{applicationId}.jsonl.gz` (gzipped JSONL — application row first, then each offer row). Manifest file `applications/{yyyy}/{mm}/manifest.jsonl` appended atomically.
- Transitions application status to `archived` in a single transaction with the S3 upload completion ack.
- Deletes the application + offer rows from the live store ONLY after the S3 write is verified (read-back round-trip on a random sample of each batch).
- A discrete audit event `application.archived` is emitted per row with applicationId + S3 key + `correlationId = 'archival-{date}'`.

### Right-to-erasure (FR-064)
- Erasure request enters via a future feature surface (mobile / support); for this feature we accept any verified `applicationId` (verification = user-side mobile auth + identity proof, out of scope).
- `erasure.service.ts` exposes `eraseApplication(applicationId)`:
  1. Read the application + offers from live store (or S3 archive if already archived).
  2. Generate the tombstone row: keep `applicationId`, `programCode` (per offer), `effectiveRatePercent`, `createdAt`, `archivedAt?`, `erasedAt`, audit trail; zero everything else.
  3. Write tombstone to the live `application` table with status = `erased`. Write tombstone `bank_offer` rows.
  4. If S3 archive exists, write a same-key replacement file `applications/{yyyy}/{mm}/{applicationId}.erased.jsonl.gz` containing only the tombstone fields. DELETE the original file. Update manifest with an `erased: true` flag for the row.
  5. Emit `data.erasure.completed` audit event (FR-065).
- SLA: complete within 30 days of request (Egyptian PDPL — practical SLA aim 7 days; spec sets 30 to allow batch-style erasure).

### Cold-tier read path
- A `cold-tier-reader` utility exposes `readArchive(applicationId, year, month)` returning the rehydrated application + offers — auditor-only role guard (`COMPLIANCE_AUDITOR` future role).
- For v1 this read is operator-grade; we ship the writer + scheduler + erasure service. The read path is a thin function exposed via a future admin endpoint.

**Rationale**:
- Decouples retention from the hot path — engine never touches archival logic.
- S3 object storage is the cheapest durable tier; JSONL preserves human-readability for compliance review.
- Tombstones preserve the audit trail without exposing PII — regulators inspect the audit; the user's data is gone.
- Anti-pattern A4 (PII in logs) holds — tombstones strip PII; the `data.erasure.completed` event carries only the audit-correlation id.

**Alternatives considered**:
- TTL-based DB delete (no archive): violates Central Bank 7-year retention.
- Postgres partitioned tables (monthly partitions, drop old partitions): functional but loses readable cold-tier; cold tier in S3 is cheaper + more inspectable.

---

## R8. PII masking utility (FR-051)

**Decision**: A small pure helper at `backend/src/matching/pii-mask/mask.ts` (placed in the engine module so it's importable everywhere without depending on side-effecting modules). Exports:

```
maskNationalId(id) → "******1234"     // last 4 digits
maskPhone(phone) → "***********56"   // last 2 digits
maskEmail(email) → "j****@example.com" // first char + domain
maskName(name) → "J*** M*****"        // first char of each word
fingerprintApplicant(profile) → sha256(profile.nationalId ?? profile.deviceId + sourceIp)
```

Shared with the admin via a small TypeScript types-only export + a sibling Angular pipe at `admin/src/app/core/pii-mask/pii-mask.pipe.ts` that reproduces the same rules client-side (for the staff detail view).

**Rationale**:
- Principle VI — PII masking is a cross-cutting concern; shared helper avoids drift between mobile / API / admin layers.
- Placing it in the engine module is intentional: the engine's `applicantFingerprint` (used for FR-066 rate limiting) calls `fingerprintApplicant()`; the admin imports the same TypeScript signatures for type parity.
- The Angular pipe is a small re-implementation (the helper module itself isn't bundled to admin because we don't want to bring the backend's `crypto` import surface; admin uses `crypto.subtle` via WebCrypto for any client-side hashing — though for v1, admin only renders pre-masked data from the server).

**Alternatives considered**:
- Apply masking at the database view level: rejected — locks masking rules to Postgres SQL; harder to evolve.
- Apply masking at the controller level: fine but doesn't get reused by the engine's fingerprint code.

---

## R9. Rate-limit guard composition (FR-066)

**Decision**: Single `ApplicantRateLimitGuard` that composes two `@nestjs/throttler` checks:

1. **HMAC-client bucket** — limit 30 / hour, key = `mobile:rate:client:{X-Client-Id}` (sha256-hashed key for symmetry).
2. **Applicant-fingerprint bucket** — limit 5 / hour, key = `mobile:rate:applicant:{fingerprint}` where `fingerprint = sha256(nationalId)` when present else `sha256(deviceId + sourceIp)`.

The guard runs AFTER `HmacSignatureGuard` (which sets `req.mobileClientId`) and AFTER DTO validation (which exposes `nationalId` for fingerprint calculation). The guard reads BOTH buckets in a single Redis MULTI / pipeline call (`INCR`, `EXPIRE` with NX) to keep latency under 5 ms.

If the same `Idempotency-Key + payload-hash` is served from cache (FR-044), the guard is SKIPPED — idempotent re-submissions don't consume bucket capacity (FR-067).

**Rationale**:
- Two independent buckets capture two threat models: credential abuse (single client farming many fingerprints) + bot farms (single fingerprint cycling through clients).
- Reusing `@nestjs/throttler` from feature 001 keeps the operational story simple.
- Composition (single guard, two checks) keeps the controller signature clean.

**Alternatives considered**:
- Two separate `@UseGuards()` decorators: less efficient (two Redis round-trips) + harder to short-circuit idempotency case.
- IP-based bucket: rejected per Q5 clarification (Option D — breaks corporate-NAT users).

---

## R10. Suggestions engine — unlock-counter algorithm

**Decision**: For each candidate suggestion code, the `unlock-counter.ts` module computes `programsUnlocked` by:

1. Cloning the applicant profile.
2. Applying the suggestion's hypothetical adjustment (e.g., reduce `requestedAmountEGP` to the suggested value).
3. Re-running `match()` over the same program list.
4. Counting `result.eligible === true` outcomes.
5. Returning `(suggestedValue, programsUnlocked)`.

For magnitude computation (e.g., `SUGGEST_REDUCE_AMOUNT`'s value), the algorithm does a binary search across the candidate space — for amount: between the lowest program min and the originally requested amount; for tenor: across the program tenor distribution; for obligations: between zero and the applicant's current obligations.

**Complexity**: O(suggestions × log(amount-range) × programs). At 4 candidate suggestions × 20 programs × ~10 binary-search iterations → 800 evaluations. Each evaluation is the full match() pipeline (~500 ms total). Net suggestions-engine cost: < 100 ms in the realistic case (most binary searches converge in 5-6 iterations + many suggestions short-circuit early).

**Rationale**:
- Re-running the engine is the only honest way to count unlocks; cheaper approximations risk reporting fictitious unlock counts.
- Binary search converges fast; the engine is pure so re-runs are deterministic.

**Alternatives considered**:
- Reverse-engineer suggestions from failed-check error codes only (no re-evaluation): faster but produces incorrect unlock counts when adjustments interact (e.g., reducing amount also reduces fees-eligible programs).
- ML model trained on historical data: out of scope per assumption section.

---

## R11. Idempotency-key cache backing

**Decision**: Redis. Cache shape: `mobile:idempotency:{X-Client-Id}:{idempotencyKey}` → `{ payloadHash, applicationId, createdAt }` as a JSON-serialized value. TTL 1 hour (FR-044).

**Lookup flow**:
1. Compute `payloadHash = sha256(requestBody)`.
2. `GET mobile:idempotency:{clientId}:{key}` → if hit:
   - `cached.payloadHash === payloadHash` → return `applicationId` (re-fetch offers from Postgres + serve cached response).
   - `cached.payloadHash !== payloadHash` → 409 `IDEMPOTENCY_KEY_MISMATCH`.
3. Miss → engine runs normally; on success, `SETEX` the cache key.

**Rationale**:
- Spec FR-044 specifies 1-hour cache + payload-hash matching.
- Redis already operational from feature 001 (auth lockout + throttler).
- Cache stores only the `applicationId` — the offers themselves come from Postgres (single source of truth, immutable).

**Alternatives considered**:
- Postgres-backed cache: durable across Redis restarts but adds 5-10 ms / lookup. Not worth it for 1 h TTL.
- In-memory cache: doesn't survive horizontal scaling.

---

## R12. Test strategy (developer-discretion, not constitutional)

**Decision**: NO testing constitutionally mandated (v1.2.0). Developer discretion:

- Vitest unit suite (`backend/src/matching/match.checks.ts` already standalone; add `match.spec.ts` mirroring it) covering:
  - All 14 golden scenarios from spec Appendix
  - Each income strategy (9 cases)
  - Each cascade resolution rule (rate / loan limit / tenor) including floor-to-≤ + frozen-order assertions
  - PMT precision: 5 known PMT inputs vs hand-computed expected values
  - DBR + max-loan-binary-search: bounds + monotonicity
  - Approval probability: each weight applied in isolation + clamped to [10, 95]
  - Ranking: each of 4 priorities + tie-break order
  - Suggestions trigger matrix: each FR-047a row
- Vitest integration suite for `applications.service.ts` covering:
  - Single-transaction commit / rollback (mock Prisma transaction)
  - Idempotency cache hit / miss
  - HMAC verification path (mock Redis nonce store)
  - Audit-event emission count + payload shape (no PII assertion)

**Rationale**: The 14 golden scenarios in the spec Appendix are the regression bedrock — any regression they catch is worth the test cost. Constitutional gates removed in v1.2.0; this is discretion.

---

## R13. Approval-probability weights — single source of truth

**Decision**: All weights live in `backend/src/matching/scoring-weights.ts` as named `const` exports. Mirror written to `specs/003-matching-engine-post/contracts/scoring-weights.md` for stakeholder review. Weight change procedure:

1. Edit `scoring-weights.ts`.
2. Update the rationale comment.
3. Update the contracts/scoring-weights.md mirror.
4. Update golden-scenario fixtures (the approval-probability assertions need re-recording).
5. PR requires reviewer sign-off.

**Rationale**: FR-034 makes this a code-review block. Anti-pattern A24 (approval probability without documented weights) is the binding gate.

---

## R14. Cascade trace propagation

**Decision**: The engine's `tier-resolution/resolve-rate.ts` calls `evaluatePricing()` from feature 002's cascade evaluator (which already returns a `trace: CascadeTraceStep[]` per R2 of feature 002 research). The trace is attached to each offer's `cascadeTrace` JSONB field unchanged.

**Schema** (JSONB shape):
```
{
  trace: [{ level, matched, value?, reason? }],
  matchedLevel: 'rateByTenor' | ... | 'baseOrCurrentEffectiveRate',
  derivation?: { sourceRatePercent, deltaPercent, reason }
}
```

Admin detail view renders the trace as an ordered stepper — matched step highlighted; derivation chain rendered as a chip with the arithmetic visible.

**Rationale**: SC-014 binds — cascade trace + derivation chain must appear on every matched offer. Reusing feature 002's evaluator preserves the contract.

---

## R15. Engine error-code propagation

**Decision**: The engine emits stable error-code strings as TypeScript string literals — never throws English errors. Examples:

- Eligibility failures: `EMPLOYMENT_TYPE_NOT_ACCEPTED`, `AGE_OUT_OF_RANGE`, `INCOME_TOO_LOW`, `TENURE_TOO_SHORT`, `LOAN_PURPOSE_MISMATCH`, `TRANSFER_TYPE_NOT_ACCEPTED`, `CURRENCY_NOT_SUPPORTED`, `REQUIRES_CD`, `REQUIRES_AUTO_LOAN_ABK`, `REQUIRES_AUTO_LOAN_OTHER`, ... (one code per required flag), `WEALTH_GATE_BANK_STATEMENT`, `WEALTH_GATE_ASSETS`, `PERFORMANCE_MOB_INSUFFICIENT`, `PERFORMANCE_BKT1_HIT`, `PERFORMANCE_BKT2_HIT`, `NO_DOCUMENTS_VIOLATED`.
- Income lookup failures: `INCOME_LOOKUP_FAILED`, `MISSING_CD_RECORD`, `MISSING_CAR_LOAN_RECORD`, `MISSING_BANK_STATEMENT`.
- Computation failures: `DBR_EXCEEDED`, `TENOR_OUT_OF_RANGE`, `AMOUNT_OUT_OF_RANGE`.
- Positive reasons (offer `matchReasons[]`): `MATCH_HAS_CD`, `MATCH_PAYROLL_CAT_A`, `MATCH_AGE_OK`, `MATCH_INCOME_OK`, `MATCH_TENURE_OK`, `MATCH_DBR_OK`, `MATCH_PROGRAM_TYPE` etc.

Full catalog lives in `contracts/error-codes.md`; the same-PR rule from features 001 + 002 mandates AR/EN translation parity.

**Rationale**: Principle III + FR-038 + FR-055.

---

## Resolved unknowns

All NEEDS-CLARIFICATION markers from Technical Context = NONE. The 5 spec clarifications + this 15-entry research document cover every cross-cutting concern.

## Open items deferred to Phase 1

- Concrete Prisma schema sketch (R5) → `data-model.md`.
- OpenAPI shapes for `/api/v1/apply` + admin endpoints → `contracts/openapi.yaml`.
- New error codes + AR/EN translations → `contracts/error-codes.md`.
- Approval-probability weights mirror → `contracts/scoring-weights.md`.
- Operator + Postman quickstart → `quickstart.md`.
