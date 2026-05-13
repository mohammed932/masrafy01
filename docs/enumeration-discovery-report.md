# Enumeration Discovery Report

**Generated**: 2026-05-13
**Scope**: backend (NestJS + Prisma) + admin (Angular 18 dashboard)
**Goal**: identify every dropdown / enum / fixed value-set across the monorepo and route each into one of three buckets — **MANAGED** (becomes super_admin CRUD via the existing `PlatformEnumeration` registry), **KEEP-HARDCODED** (system invariant), or **MIRROR** (backend authoritative; admin keeps a typed-only mirror under the same-PR i18n rule).

The migration target — `PlatformEnumerationsRepository` — already exists in `backend/src/platform-enumerations/`. v1 ships an in-memory stub; v2 will swap to a Postgres-backed implementation behind the same DI contract (zero call-site change).

---

## Section 1 — Executive summary

| Metric | Count |
|---|---:|
| Total distinct dropdowns / enums / fixed sets found | **72** |
| Backend findings | 45 |
| Admin findings | 27 |
| Currently hardcoded | 58 |
| Already managed via `PlatformEnumeration` (in-memory v1) | 14 |
| **Recommend MANAGE** (migrate to PlatformEnumeration) | **17** |
| **Recommend KEEP-HARDCODED** (system invariant) | **28** |
| **Recommend MIRROR** (typed-only mirror of backend authority) | **13** |
| Estimated migration effort | ~6–8 PRs over 2–3 weeks |

### What "MANAGED" buys us

- super_admin adds an outcome flag like `USER_REQUESTED_CALLBACK` without a deploy.
- Sales managers introduce a new lead-reassignment reason without a code change.
- Compliance team retires a deprecated `documentType` (e.g., handwritten payslips) without breaking historical activity rows — the `deprecatedAt` lifecycle already exists in the registry.
- Operations add a new currency or city tier as the business expands.

### What "KEEP-HARDCODED" buys us

- Auth role names, state-machine enums, audit-event types, HTTP status codes, matching-engine cascade orders, approval-tier buckets all live in code because **changing them is a code change** — they're wired into guards, transitions, payload schemas, or weighted-scoring math. Letting an operator add `super_super_admin` via a UI does nothing without code that recognizes the new role.

### What "MIRROR" buys us

- Activity-type matrix + activity reasons live in `backend/src/activities/activity-reasons.ts`. The Angular dialog imports a typed mirror — keeps autocomplete + type-checking working without an extra HTTP round-trip per dialog open.
- Same-PR rule already enforces: adding a literal touches three files at once (backend const + admin mirror + AR/EN i18n). The MANAGED move below replaces the backend const with a registry lookup; the admin mirror becomes a thin enum-list fetch cached for the session.

---

## Section 2 — Detailed findings, grouped by recommended action

### 2.1 MANAGED — operator-CRUD candidates (17)

These move to `PlatformEnumeration`. Lifecycle (active/deprecated) already supported by the registry. Each row carries a migration step under "How".

| Name | Kind | File:Line | Sample values | Where it shows up | How to migrate |
|---|---|---|---|---|---|
| `ApplicationPriority` (Prisma enum) | prisma-enum | `backend/prisma/schema.prisma:100` | `lowest_installment, lowest_interest, fastest_approval, least_paperwork` | User wizard priority picker (mobile) + admin filter | Add `enumerationType='application_priority'`, drop Prisma enum, store as `VARCHAR(48)` keyed to registry. **Schema change**. |
| `APPLICATION_PRIORITIES` | const-array | `backend/src/matching/types.ts:312` | same as above | matching engine input | Replace with `registry.getActiveMembers('application_priority').then(m => m.map(x => x.key))`. |
| `ACTIVITY_TYPES` (14 values) | const-array | `backend/src/activities/activities.types.ts:7` | `CALLED_USER, SENT_WHATSAPP, …, STALE_LEAD_FLAGGED` | Add Activity dialog type select + activity-timeline icon map | `enumerationType='activity_type'`. Cache 5-min server-side. SYSTEM-ONLY types stay marked via a `system_only` flag column added to PlatformEnumeration. |
| `ACTIVITY_REASONS` matrix (~79 codes across 14 types) | const-object | `backend/src/activities/activity-reasons.ts:8` | per-type reason lists | Reason dropdown in Add Activity dialog (auto-repopulates per type) | `enumerationType='activity_reason'` with a `parent_key` column (= activityType). Two-level lookup. |
| `ASSIGN_REASONS` (6 values) | const-array | `backend/src/applications/dto/assign-lead.dto.ts:4` | `INITIAL_ASSIGNMENT, WORKLOAD_REBALANCE, SKILL_MATCH, AGENT_DEACTIVATED, MANAGER_OVERRIDE, OTHER` | Lead Assign dialog reason picker | `enumerationType='lead_reassign_reason'`. |
| `OUTCOME_FLAG_OPTIONS` (5 values) | const-array | `admin/.../add-activity.dialog.ts:61` | `USER_CONFIRMED, USER_REQUESTED_RESCHEDULE, USER_UNREACHABLE, INFORMATION_CAPTURED, NEEDS_MANAGER` | Add Activity dialog chip listbox | `enumerationType='activity_outcome_flag'`. |
| `DOCUMENT_TYPE_OPTIONS` (9 values) | const-array | `admin/.../activity-attachments-uploader.component.ts:39` | `passport, national_id, bank_statement, salary_slip, …` | Per-file type dropdown in uploader | Already partially in `required_document` registry. Merge — adopt the registry as the single source. |
| `SOURCE_OPTIONS` (6 values) | const-array | `admin/.../activity-attachments-uploader.component.ts:51` | `whatsapp, email, in_person, mobile_app, courier, other` | Per-file source dropdown | `enumerationType='document_source'`. |
| `ALLOWED_DOCUMENT_MIME_TYPES` (4 values) | const-array | `backend/src/activities/activities.types.ts:121` | `image/jpeg, image/png, image/heic, application/pdf` | Document upload validation | `enumerationType='allowed_mime_type'`. Used by the presigned-URL gate. |
| `bankCategory` union | string-union | `backend/src/applications/dto/apply.dto.ts:59` | `public, commercial` | Mobile wizard employment section | `enumerationType='bank_category'`. |
| `requestedCurrency` `@IsIn(['EGP','USD','EUR','GBP'])` | IsIn-decorator | `backend/src/applications/dto/apply.dto.ts:175` | 4 currencies | Mobile wizard | Already partly in `currency` registry — extend to cover GBP + drop the inline IsIn. |
| Document `status` union | string-union | `backend/src/documents/dto/document.response.dto.ts:15` | `uploaded, verified, rejected, erased` | Document workflow projections | `enumerationType='document_status'` — but flag as **system-only** (state machine; operator can rename labels but cannot add states without a code change). |
| Document `uploadedByContext` union | string-union | `backend/src/documents/documents.repository.ts:11` | `agent_on_behalf, user` | Document audit trail | `enumerationType='document_upload_context'`. |
| Document `uploadedBySource` union | string-union | `backend/src/documents/dto/request-upload-url.dto.ts:38` | `whatsapp, email, in_person, mobile_app, courier, other` | Document source tracking | Same as admin `SOURCE_OPTIONS` row above — converge on one `document_source` registry type. |
| Bank-programs list category filter (inline) | inline-template-array | `admin/.../bank-programs-list.page.ts:100` | `personal, car, mortgage, wealth, buyout` | List filter | Replace inline literal with `getActiveMembers('product_category')` (already managed; the admin is duplicating the list). |
| `INCOME_ASSUMPTION_STRATEGIES` (10 strategies) | const-array | `backend/src/bank-programs/dto/sub-configs/income-assumption-config.dto.ts:23` | `declared, byYearsInJob, byYearsInPractice, byProfessorRank, byMilitaryGrade, byCDValue, byCarInstallment, byCarLoanAmount, byCreditCardLimit, byBankStatementPercent` | Bank program form strategy picker | Each strategy is implemented by a **function** in the matching engine, so adding a new strategy is a code change. **Verdict revised:** mark these as MIRROR + machine-readable — operator can disable a strategy but can't add one. Move to `enumerationType='income_assumption_strategy'` with `system_only=true`. |
| Auto-strategy `combinationRule` (`lesser_of` / `greater_of`) | IsIn-decorator | same file:57 | 2 values | Bank program form | Same as above — `enumerationType='income_combination_rule'`, system-only. |

**Already MANAGED in v1 registry (14 types — confirmed in `in-memory-platform-enumerations.repository.ts`):**

`salary_category`, `transfer_type`, `employment_type`, `loan_purpose`, `property_type`, `city_tier`, `professor_rank`, `military_grade`, `product_category`, `customer_program_tier`, `performance_tier`, `company_type`, `required_document`, `currency`. **Gap**: the v2 Postgres-backed implementation is not yet shipped; the in-memory stub is the only path, and an operator can't actually CRUD any of these from the UI today. **First migration PR**: ship the Postgres-backed `PlatformEnumerationRepository` + a super_admin-only `/admin/enumerations` CRUD surface.

### 2.2 MIRROR — backend authoritative, admin keeps typed mirror (13)

These do NOT become operator-CRUD. The backend is the source of truth, the admin mirror file stays for type safety + autocomplete, same-PR rule preserved.

| Name | Kind | File | Why MIRROR not MANAGED |
|---|---|---|---|
| `ErrorCode` (~67 codes) | string-union | `admin/src/app/core/auth/auth.types.ts:11` | Error codes carry English message keys in i18n + drive error-interceptor routing. Adding one is a code change. |
| `TierFilter` (`high/medium/needs_coaching`) | string-union | `admin/.../tier-filter-chips.component.ts:5` | Each chip's predicate is hardcoded in the repository LATERAL query. |
| `LeadFilter` (7 chip values) | string-union | `admin/.../lead-filter-chips.component.ts:5` | Same as TierFilter — each chip is a hand-written `where` predicate. |
| `ApprovalTier` (5 values) | string-union | `admin/.../approval-pill.component.ts:4` | Matching-engine output; weights baked into scoring config (Principle V). |
| Activity types + reasons (admin mirror) | const-array | `admin/.../activity-reasons.ts` + dialog files | Already a same-PR mirror of backend. Stays a mirror after MANAGE move on the backend; the admin loads it once per session via API. |
| `productCategoryOptions` computed | computed | `admin/.../identity-section.component.ts:109` | Already derived from `getActiveMembers('product_category')` — correctly a MIRROR. |
| `currencyOptions` computed | computed | same file:113 | Same pattern. |
| `employmentTypeOptions` computed | computed | `eligibility-section.component.ts:204` | Same pattern. |
| `loanPurposeOptions` computed | computed | same file:207 | Same pattern. |
| `transferTypeOptions` computed | computed | same file:210 | Same pattern. |
| `docOptions` computed | computed | `documents-section.component.ts:69` | Same pattern. |
| Inline `TYPES_REQUIRING_DURATION` / `TYPES_ALLOWING_ATTACHMENTS` | const-array | `add-activity.dialog.ts:54/55` | Drives conditional field rendering — admin-side UI logic mirroring backend validation rules. Same-PR mirror. |
| `SYSTEM_ONLY_ACTIVITY_TYPES` | const-array | `backend/src/activities/activities.types.ts:26` | System-actor invariant; mirrored client-side to hide types from the operator dropdown. |

### 2.3 KEEP-HARDCODED — system invariants (28)

These never become operator-managed. Changing any of them IS a code change.

**Auth / role-based access control:**
- `StaffRole` (Prisma + admin union): wired into `roleGuardFn` / `*can` / JWT claims. Adding a role means writing new guards.
- `CreatableRole` / `UPDATABLE_ROLES`: `@IsIn` decorators on user CRUD DTOs — bound to the StaffRole set above.
- `ACTIVITY_ACTOR_ROLES` (super_admin / sales_manager / sales_agent / system): same as above + the literal `'system'` is referenced by the cron's reserved-actor row insert.

**State machine enums:**
- `ApplicationStatus` (`draft / matched / no_match / archived / erased`): each transition is a code path in `applications.service.ts`.
- `LeadStatus` (`needs_first_contact / document_collection / ready_for_submission / submitted_to_bank / bank_decided`): every transition is hand-coded in `lead-status-transition.adapter.ts`.
- `AttemptOutcome`, `DecisionOutcome`, `BankProgramType`: ditto.

**Audit + observability:**
- `AuditEventType` (23 values): payload schemas per type are typed at the writer call site. Constitutional invariant (Principle VII).
- `ERROR_CODES` (60+ codes): same as ErrorCode union on the admin — each code carries HTTP-status mapping + i18n + per-code interceptor routing.

**Matching engine internals (Principle V — engine is IP):**
- `ApprovalTier` (Prisma + matching `APPROVAL_TIERS`): bucket boundaries baked into the scoring config.
- `PRICING_CASCADE_ORDER` (8 levels): cascade evaluation order is part of the engine's correctness proof.
- `LOAN_LIMIT_CASCADE_ORDER` (6 levels): same.
- `TENOR_CASCADE_ORDER` (2 levels): same.
- `PROGRAM_TYPES` (`income_proof / income_surrogate`): drives the income-assumption-strategy branch in the engine.

**UI primitives (not domain values):**
- Window-picker presets `[7, 30, 90, 180]` days on Lead/Scoring Analytics: visual chip sets, not domain options.
- Bank-programs list "Active / Inactive" status filter: maps to a `boolean` column.
- Page sizes, table column keys, dialog panel widths.

---

## Section 3 — Migration plan

### Phase 1: ship the v2 PlatformEnumeration backing store (1 PR)

- Add `platform_enumeration` Prisma model + migration: `(id, type, key, labelAr, labelEn, active, deprecatedAt, systemOnly, parentKey?, sortOrder, createdAt, updatedAt, createdBy, updatedBy)`.
- Replace `InMemoryPlatformEnumerationsRepository` provider with the new Postgres-backed implementation behind the SAME abstract class — zero call-site changes.
- Seed it from the existing in-memory stub.

### Phase 2: super_admin CRUD UI (1 PR)

- New `/admin/enumerations` route gated by `roleGuardFn(['super_admin'])`.
- List view grouped by `type`. Inline edit for `active` toggle + `deprecate` button. Modal for create + label edit.
- Audit event `PLATFORM_ENUMERATION_*` (CREATED / UPDATED / DEACTIVATED / DEPRECATED) — new enum values + payload schemas.

### Phase 3: migrate the 17 MANAGED candidates, grouped by blast radius (3–4 PRs)

| Wave | Candidates | Why grouped |
|---|---|---|
| Wave A — additive only (low-risk) | OUTCOME_FLAG_OPTIONS, SOURCE_OPTIONS, ASSIGN_REASONS, document source/context | None of these are referenced by existing DB rows that require backfill. Add registry seeds + swap the const for `getActiveMembers()`. |
| Wave B — activity matrix | ACTIVITY_TYPES + ACTIVITY_REASONS matrix | High blast — touches the Add Activity dialog + validation. Move `parent_key` schema + matrix loader. Add a session-cached fetch so the dialog doesn't pay an HTTP round-trip per open. |
| Wave C — schema-changing | `ApplicationPriority` Prisma enum drop + `application_priority` registry. `requestedCurrency` IsIn → registry. | Needs a Prisma migration that converts the column type. Use a two-phase migration: add new VARCHAR column, copy values, drop the enum column, rename. |
| Wave D — fold duplicates | DOCUMENT_TYPE_OPTIONS (admin) ↔ `required_document` (registry); `bankCategory` ↔ `company_type` (overlap?). | Pure consolidation — replace inline arrays with registry calls. |

### Phase 4: AR/EN parity backfill

- Every registry row already carries `labelAr` + `labelEn`. Confirm coverage on every new key.
- Linter rule: any `getActiveMembers(...)` call site must consume the localized label, not the raw key.

---

## Section 4 — Anti-patterns flagged during the scan

- **Duplication between admin and `required_document` registry** — the uploader hardcodes a 9-item list while the registry has 8. Adding one without the other = silent UX drift. Fix: drop the admin const and consume the registry.
- **`bankCategory` (public/commercial)** is a brand-new dropdown invented inside the `apply.dto`; check whether it's the same domain as the existing `company_type` registry (`commercial_bank / public_bank`) — looks like a duplicate. If yes, fold; if not, document why.
- **Activity reasons matrix scoped per type** is not expressible in the current registry schema (one flat list per type). Phase 1 must add `parent_key` to support the activity-type → reasons relationship.
- **`ApplicationPriority` is the only operator-facing prisma enum**. Every other prisma enum is a state machine or auth/audit invariant. Dropping it would simplify the schema-as-code rule: prisma enums become "system invariants only".

---

## Section 5 — Effort estimate

| Wave | PRs | Engineering days |
|---|---:|---:|
| Phase 1 (v2 backing store) | 1 | 2 |
| Phase 2 (CRUD UI) | 1 | 3 (incl. promax + impec passes per Principle XXIII) |
| Phase 3 Wave A (additive) | 1 | 1 |
| Phase 3 Wave B (activity matrix) | 1 | 2 (DB schema for parent_key + session cache) |
| Phase 3 Wave C (schema-changing) | 1 | 2 (Prisma column-type migration is the long pole) |
| Phase 3 Wave D (fold dupes) | 1 | 0.5 |
| Phase 4 (AR/EN backfill + linter) | 1 | 0.5 |
| **Total** | **7 PRs** | **~11 days** |

---

## Appendix — Raw findings

Two parallel agents scanned the surfaces; full row-by-row output preserved in this report's Section 2 tables. The agents covered:

- **Backend**: every Prisma enum (8), every `export enum` / `export const ... as const` / `type = 'a' | 'b' | …` (24), every `@IsIn` decorator (8), every JSONB tier-map key in the bank-programs cascade (3 cascade types × ~8 keys each), the entire activity-reason matrix (1 const-object × 14 types), every error code (60+).
- **Admin**: every `mat-option` value array (12), every chip listbox (5), every inline template array (2), every typed mirror union (8).

Anything not appearing in this report's tables can be assumed to either be a UI primitive or a runtime-derived value (e.g., a list pulled from the API and rendered without a fixed schema).
