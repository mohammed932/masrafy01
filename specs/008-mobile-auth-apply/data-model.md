# Data Model: Mobile Authentication & Two-Path Registration

**Feature**: 008-mobile-auth-apply
**Phase**: 1 — Design
**Date**: 2026-05-26

This document specifies the Prisma schema additions/changes for this feature. Migration name: `008_mobile_auth_two_path_registration`.

---

## Enums

```prisma
enum RegistrationPath {
  PHONE
  SOCIAL
}

enum SocialProvider {
  GOOGLE
  APPLE
}

enum OtpPurpose {
  SIGNUP            // PHONE-signup mobile verification
  PROFILE_MOBILE    // SOCIAL Complete-Profile mobile binding (replaces former SOCIAL_LINK)
  FORGOT_PASSWORD
  MOBILE_CHANGE     // reserved, no UI in this feature
}
```

`OtpPurpose` does NOT include `LOGIN` (spec §1.2 / FR-017). The API rejects any request that attempts it and emits a canary alarm.

---

## Models

### `Customer`

```prisma
model Customer {
  id                String           @id @default(cuid())
  registrationPath  RegistrationPath
  fullName          String
  mobile            String?          // unique partial — set immediately for PHONE; set at SOCIAL mobile-verify
  mobileVerifiedAt  DateTime?        // set together with `mobile`
  email             String?          // set at signup for PHONE; may be null for SOCIAL until provider returns it or popup collects it
  age               Int?             // set at signup for PHONE; set at first loan submit for SOCIAL
  passwordHash      String?          // PHONE only; null for SOCIAL — select: false in Prisma
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  providers         CustomerProvider[]
  refreshTokens     CustomerRefreshToken[]
  passwordResets    PasswordResetToken[]
  applications      Application[]
  documents         Document[]
  questionnaireAnswers QuestionnaireAnswer[]

  @@unique([mobile])               // implemented as partial unique index: WHERE mobile IS NOT NULL (see migration notes below)
  @@index([registrationPath])
  @@index([email])
}
```

**Invariants (enforced at write time + by CHECK constraints in the migration)**:

- `registrationPath = PHONE` requires non-null `mobile`, `mobileVerifiedAt`, `fullName`, `email`, `passwordHash`, `age`. CHECK constraint: `age BETWEEN 18 AND 80`.
- `registrationPath = SOCIAL` allows nullable `mobile`, `mobileVerifiedAt`, `email`, `age`. `passwordHash` MUST be null. At least one `CustomerProvider` row must exist for SOCIAL customers (enforced by the SOCIAL sign-in transaction).
- `mobile` and `mobileVerifiedAt` are mutated together (both set in the same UPDATE statement) and are IMMUTABLE after first non-null write — enforced by application logic + a row-level trigger or a service-layer assertion (`if (customer.mobileVerifiedAt) throw IMMUTABLE_FIELD_VIOLATION`).
- `age` becomes IMMUTABLE after first non-null write (same enforcement pattern).
- `registrationPath` never mutates (enforced by trigger / service-layer).

**Indexes**:

- Partial unique index on `mobile` (`WHERE mobile IS NOT NULL`) — lets many SOCIAL customers exist with null mobile.
- Index on `registrationPath` (admin filters).
- Index on `email` (sparse — login + admin lookup).

---

### `CustomerProvider`

```prisma
model CustomerProvider {
  id              String         @id @default(cuid())
  customerId      String
  provider        SocialProvider
  providerUserId  String         // Google: sub; Apple: sub
  email           String?        // captured at link time (Apple may withhold on subsequent sign-ins; we trust the first)
  linkedAt        DateTime       @default(now())
  customer        Customer       @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([customerId])
}
```

One customer may have at most one row per `provider` (enforced by `@@unique([provider, providerUserId])` PLUS a service-layer check; we do not put an `@@unique([customerId, provider])` because re-linking after unlink is allowed in future iterations).

---

### `OtpChallenge`

```prisma
model OtpChallenge {
  id           String     @id @default(cuid())
  customerId   String?    // SET for PROFILE_MOBILE (SOCIAL Complete-Profile); null for SIGNUP / FORGOT_PASSWORD pre-customer-link
  mobile       String
  purpose      OtpPurpose
  codeHash     String                          // bcrypt cost 10 (never logged)
  attemptsLeft Int        @default(5)
  expiresAt    DateTime
  consumedAt   DateTime?
  createdAt    DateTime   @default(now())

  @@index([mobile, purpose, expiresAt])
  @@index([customerId, expiresAt])
}
```

`customerId` is nullable because PHONE-signup OTP is sent before any customer exists. For SOCIAL `PROFILE_MOBILE` OTP it's set (the customer exists already and is signed in).

---

### `VerifiedMobileToken`

```prisma
model VerifiedMobileToken {
  id          String    @id @default(cuid())
  tokenHash   String                          // bcrypt cost 10
  mobile      String                          // the OTP-verified mobile this token attests to
  expiresAt   DateTime
  consumedAt  DateTime?
  createdAt   DateTime  @default(now())

  @@index([mobile, expiresAt])
}
```

Used ONLY for the PHONE-signup path (R5). SOCIAL Complete-Profile uses Customer JWT instead (R6).

---

### `SocialSession`

```prisma
model SocialSession {
  id                  String         @id @default(cuid())
  provider            SocialProvider
  providerUserId      String
  email               String?
  fullName            String?
  resolvedCustomerId  String?                  // set if the provider+sub matches an existing customer
  expiresAt           DateTime
  consumedAt          DateTime?
  createdAt           DateTime       @default(now())

  @@index([provider, providerUserId])
}
```

Short-lived (15 min). Issued by `/auth/social/google` and `/auth/social/apple`. Consumed by `/auth/social/login` (existing customer) or by the SOCIAL-signup transaction (new customer).

---

### `PasswordResetToken`

```prisma
model PasswordResetToken {
  id         String    @id @default(cuid())
  customerId String
  tokenHash  String                            // bcrypt cost 10
  expiresAt  DateTime                          // 15-min TTL
  consumedAt DateTime?
  createdAt  DateTime  @default(now())
  customer   Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId, expiresAt])
}
```

PHONE customers only (only path with passwords).

---

### `CustomerRefreshToken`

```prisma
model CustomerRefreshToken {
  id              String    @id @default(cuid())
  customerId      String
  tokenHash       String                       // SHA-256 of opaque token
  expiresAt       DateTime                     // 30 days
  createdAt       DateTime  @default(now())
  createdByDevice String?                      // UA hash for admin diagnostics
  revokedAt       DateTime?
  customer        Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([customerId])
  @@index([tokenHash])
}
```

Rotated on every use (R11). Revoked on logout, on password change/reset (per Q1), on explicit "sign out of all other devices".

---

### `Application` (existing — small additions)

```prisma
model Application {
  id              String              @id @default(cuid())
  customerId      String
  bankProgramId   String
  status          ApplicationStatus   @default(submitted)   // existing enum
  currency        String              @default("EGP")
  tenorMonths     Int
  submittedAt     DateTime            @default(now())
  // ... existing fields preserved ...
  customer        Customer            @relation(fields: [customerId], references: [id])
  documents       Document[]
  questionnaireAnswers QuestionnaireAnswer[]
  // No schema changes to this table for this feature beyond ensuring `customerId` is non-null (already so).

  @@index([customerId])
  @@index([bankProgramId])
}
```

If `Application` does not exist yet in the current Prisma schema, this migration creates it. If it does exist, this feature only ensures `customerId` is required (FK constraint).

---

### `Document` (existing — small additions)

```prisma
model Document {
  id            String              @id @default(cuid())
  customerId    String
  applicationId String?             // null between upload-URL issuance and apply-time binding
  documentType  DocumentType                              // existing enum + NATIONAL_ID_FRONT, NATIONAL_ID_BACK
  s3Key         String
  contentType   String
  uploadedAt    DateTime?                                 // set on confirm-by-customer (we treat the upload-URL issuance moment as the start; the "is uploaded" check happens during apply)
  verifiedAt    DateTime?                                 // set when bound to an application during apply
  createdAt     DateTime            @default(now())
  customer      Customer            @relation(fields: [customerId], references: [id])
  application   Application?        @relation(fields: [applicationId], references: [id])

  @@index([customerId])
  @@index([applicationId])
  @@unique([id])
}

enum DocumentType {
  NATIONAL_ID_FRONT
  NATIONAL_ID_BACK
  // ... existing values preserved
}
```

---

### `QuestionnaireAnswer` (new, or extend existing)

```prisma
model QuestionnaireAnswer {
  id            String       @id @default(cuid())
  customerId    String
  applicationId String?                                  // null until linked at apply submission
  loanType      LoanType
  amountRequested  Decimal                               // Principle I — Decimal not Float
  monthlySalary    Decimal?
  employmentType   EmploymentType
  currentLoans     Decimal?
  priorityFactor   PriorityFactor
  // ... full questionnaire payload, fields per the existing matching engine input ...
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  customer      Customer     @relation(fields: [customerId], references: [id])
  application   Application? @relation(fields: [applicationId], references: [id])

  @@index([customerId])
  @@index([applicationId])
}
```

The questionnaire is now server-persisted (no local-only Hive box — per FR-007 v2). Each customer has at most one "active" (unlinked) questionnaire row; on loan submission, the active row's `applicationId` is set, freezing the snapshot.

---

### `AuditEvent` (existing — new event types)

The following `auditEvent.type` values are added (string enum or text column, depending on existing schema):

- `auth.signup.phone.requested` / `.completed`
- `auth.signup.social.completed`
- `auth.otp.requested` (tagged by `purpose`)
- `auth.otp.verified`
- `auth.login.attempted` / `.succeeded` / `.failed` / `.locked`
- `auth.logout`
- `auth.password.change` / `.reset`
- `auth.tokens.revoked` (with reason: `logout`, `password_change`, `password_reset`)
- `customer.profile.mobile_bound`
- `customer.profile.email_set`
- `customer.profile.age_set`
- `application.apply.submitted`

Every event row carries `correlationId`, `actorId` (customer ID or admin user ID), `maskedMobile` if relevant, and an outcome.

---

## Migration order (`008_mobile_auth_two_path_registration`)

Migrations are run in this strict order — each step is its own SQL file under `prisma/migrations/008_mobile_auth_two_path_registration/`:

1. **Enums**: `CREATE TYPE RegistrationPath`, `CREATE TYPE SocialProvider` (idempotent IF NOT EXISTS), update `OtpPurpose` enum to drop `LOGIN` if present and add `PROFILE_MOBILE`.
2. **New tables**: `CustomerProvider`, `VerifiedMobileToken`, `SocialSession`, `PasswordResetToken`, `CustomerRefreshToken` (if not present), `QuestionnaireAnswer` (if not present).
3. **`Customer` ALTER**:
   - ADD `registrationPath RegistrationPath` — initially nullable.
   - Backfill existing rows to `PHONE` (any pre-existing customer that was registered via the old flow is treated as PHONE).
   - ALTER COLUMN `registrationPath` SET NOT NULL.
   - ADD `mobileVerifiedAt TIMESTAMPTZ` (nullable). Backfill `mobileVerifiedAt = createdAt` for existing PHONE-tagged customers if their mobile was already verified in prior flows (otherwise leave null and treat as "needs re-verification" — flag for ops).
   - ADD `age INT` if not present. Existing customers may have null age; the new FR-002 invariant is enforced at WRITE time, not retroactively.
   - ALTER `passwordHash` — make NULLABLE (it may have been NOT NULL).
4. **Partial unique index**: `CREATE UNIQUE INDEX customer_mobile_unique ON "Customer"("mobile") WHERE mobile IS NOT NULL;`
5. **CHECK constraints**: `ALTER TABLE "Customer" ADD CONSTRAINT customer_age_range CHECK (age IS NULL OR (age >= 18 AND age <= 80));` + a CHECK ensuring SOCIAL customers have null `passwordHash` and PHONE customers have non-null `passwordHash`, non-null `mobile`, non-null `email`, non-null `age` (only enforced for new rows; existing rows grandfathered via `NOT VALID` initially, validated as a separate step once backfill is complete).
6. **FK indexes**: per Principle XI, add indexes on every FK column added above.

The migration is REVERSIBLE in the sense that the new tables can be dropped and the new columns nulled. Backfilled `registrationPath = PHONE` rows are NOT reverted by rollback (data preservation). Coordinate rollback with ops before merging.

---

## Field-level write authority matrix

| Field | When written | By whom | Immutable after |
|---|---|---|---|
| `Customer.registrationPath` | Customer creation | `auth.service` | Always |
| `Customer.fullName` | Customer creation | `auth.service` (PHONE) or social verify (SOCIAL) | First write |
| `Customer.mobile` + `mobileVerifiedAt` (PHONE) | Customer creation | `auth.service` | First write |
| `Customer.mobile` + `mobileVerifiedAt` (SOCIAL) | `/auth/profile/mobile-verify-otp` | `profile.controller` | First write |
| `Customer.email` (PHONE) | Customer creation | `auth.service` | Never (admin can later edit if provided a feature; not in this spec) |
| `Customer.email` (SOCIAL, provider-supplied) | Customer creation | `auth.service` | Never |
| `Customer.email` (SOCIAL, popup-supplied) | Inside `/applications/apply` transaction | `apply.service` | After first set |
| `Customer.passwordHash` | PHONE customer creation, password change, password reset | `auth.service` | Mutable (PHONE only) |
| `Customer.age` (PHONE) | Customer creation | `auth.service` | First write |
| `Customer.age` (SOCIAL) | Inside `/applications/apply` transaction | `apply.service` | First write |

This matrix is the source of truth — any controller that violates it MUST be rejected at code review (Principle XXIX A25).

---

## Relationships diagram

```text
Customer 1 ── N CustomerProvider
Customer 1 ── N CustomerRefreshToken
Customer 1 ── N PasswordResetToken
Customer 1 ── N Application
Customer 1 ── N Document
Customer 1 ── N QuestionnaireAnswer
Application 1 ── N Document
Application 1 ── N QuestionnaireAnswer  (1 active "snapshot" once submitted)
OtpChallenge — independent (mobile-scoped)
VerifiedMobileToken — independent (mobile-scoped, PHONE-signup only)
SocialSession — independent (provider-scoped, ephemeral)
```
