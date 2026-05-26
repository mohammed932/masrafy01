# Research: Mobile Authentication & Two-Path Registration

**Feature**: 008-mobile-auth-apply
**Phase**: 0 — Outline & Research
**Date**: 2026-05-26

This document resolves every architectural decision the implementation depends on. No NEEDS CLARIFICATION markers remain after this phase.

---

## R1 — Customer JWT vs. session cookies for mobile

**Decision**: JWT (access + refresh) returned as response-body strings, stored in `flutter_secure_storage` on mobile.

**Rationale**: Principle XIII v1.8.0 mandates this exact shape — 15-min access + 30-day refresh, response body (not httpOnly cookie). Mobile clients can't use cookies for cross-origin API calls the same way browsers can; secure-storage-backed Bearer tokens are the standard mobile pattern. Refresh tokens are rotated on every use (Principle XIII), stored hashed server-side (SHA-256 of the random token), individually revocable.

**Alternatives considered**:
- httpOnly cookies — admin-side default, not appropriate for mobile (provider doesn't accept Set-Cookie on native HTTP clients reliably across iOS/Android; harder to expire mid-session).
- OAuth-style PKCE for first-party mobile — overkill given customer JWT is first-party.

---

## R2 — Customer JWT secrets management

**Decision**: Two separate env-var-loaded HMAC secrets — `CUSTOMER_JWT_ACCESS_SECRET` and `CUSTOMER_JWT_REFRESH_SECRET`. Each ≥ 256 bits of entropy. Validated at boot via Zod schema; service refuses to start if either is missing or shorter than 32 bytes.

**Rationale**: Per Principle XIII v1.8.0, customer JWT signing keys MUST be separate from admin JWT signing keys. Using HS256 (HMAC-SHA-256) avoids the asymmetric-key operational burden (rotation, distribution) since access tokens never leave Masrafy infrastructure for verification. Refresh tokens are verified opaquely against a `CustomerRefreshToken` row, not by signature alone — so even refresh-secret compromise is bounded by per-token revocation.

**Alternatives considered**:
- RS256 (asymmetric) — useful when verifiers are external; not our case.
- Shared secret with admin JWT — Principle XIII rejects this explicitly.

---

## R3 — Social ID token verification

**Decision**:
- **Google**: `google-auth-library` Node SDK `verifyIdToken({ idToken, audience })`, where `audience` is the iOS + Android client IDs of the Masrafy app. Verifies signature against Google's published JWKs, claims (`iss`, `exp`, `aud`, `email_verified`).
- **Apple**: `jose` package + Apple's public-key JWK set fetched from `https://appleid.apple.com/auth/keys` (cache 24 h). Verify `iss = https://appleid.apple.com`, `aud = <iOS bundle ID>`, `exp`, `iat`. Extract `sub` as the stable `appleUserId`; extract `email` (only present on first auth) and `name` (Apple sends only on first auth, via separate `userInfo` payload).

**Rationale**: Both libraries are well-maintained and validate signatures against publicly rotating keys. Apple's "email only on first sign-in" behavior requires persisting the email keyed to `appleUserId` on first contact (FR-029).

**Alternatives considered**:
- Manual JWT verification of Google tokens — error-prone; SDK does it correctly.
- `node-apple-signin-auth` — works but adds dependency surface over `jose`.

---

## R4 — OTP generation, hashing, storage

**Decision**:
- 6-digit numeric OTP generated via `crypto.randomInt(0, 1_000_000)` zero-padded.
- Hashed with bcrypt cost 10 (lower than passwords because expiry is ≤ 5 min — work factor balance favors lower cost so insertion isn't a bottleneck).
- Stored on `OtpChallenge` row: `mobile`, `purpose`, `codeHash`, `attemptsLeft = 5`, `expiresAt = now + 5 min`, `consumedAt` (nullable), `createdAt`.
- Indexed on `(mobile, purpose, expiresAt)` for fast lookup of the active code.

**Rationale**: bcrypt instead of HMAC because brute-force protection is needed even server-side (defense in depth against DB exfiltration). cost-10 is the OWASP rule-of-thumb for short-lived secrets. Attempt counter prevents online brute force.

**Alternatives considered**:
- HMAC-SHA-256 instead of bcrypt — faster but offers no work factor.
- Argon2id — heavier, no benefit for a 5-min secret.

---

## R5 — Verified-mobile token (PHONE path)

**Decision**: The PHONE-signup OTP-verify endpoint returns a `verifiedMobileToken` only when the OTP is correct and the mobile is NOT yet registered to any customer. Token is a 32-byte random value, `cuid()`-prefixed (`vmt_…`), held only in mobile-client memory, never persisted to disk on the device. Server-side stored on `VerifiedMobileToken` table with `tokenHash` (bcrypt cost 10), `mobile`, `expiresAt = now + 15 min`, `consumedAt`. The next step (PHONE signup profile-save) consumes it atomically (transaction: validate + mark consumed + create customer).

**Rationale**: Single-use, short-lived bearer prevents replay between OTP-verify and profile-save. For PHONE path we want to defer customer creation until the user enters name + email + password + age, so the OTP-verify alone doesn't create a customer (matches spec's two-step "OTP verifies but doesn't create" semantics). 15-minute TTL is plenty for a user to fill profile + age.

**Alternatives considered**:
- Create customer-pending row at OTP-verify, finalize on profile-save — adds a partial-customer state that complicates invariants.
- Embed a signed JWT — overkill; opaque tokens are simpler to revoke.

---

## R6 — SOCIAL Complete-Profile mobile binding without verified-mobile token

**Decision**: For a logged-in SOCIAL customer completing their profile, the mobile-OTP step uses the customer's own JWT as authorization — the verified-mobile-token bearer pattern (R5) is NOT used. The flow:

1. `POST /api/v1/auth/profile/mobile-request-otp` (auth: HMAC + Customer JWT) — body: `{ mobile }` → issues OTP, attaches `customerId` to the OtpChallenge row in addition to mobile.
2. `POST /api/v1/auth/profile/mobile-verify-otp` (auth: HMAC + Customer JWT) — body: `{ otpId, code }` → if valid, writes `customer.mobile = <verified mobile>` + `customer.mobileVerifiedAt = now()` in a single transaction (the unique-constraint check on mobile happens at this commit, so collision is detected here per spec edge case).

**Rationale**: The SOCIAL customer is already authenticated; there's no benefit to a separate token. Persisting mobile + `mobileVerifiedAt` immediately satisfies the OTP cost rule (Q4 / FR-009d). Mobile becomes immutable from this point.

**Alternatives considered**:
- Use the same `VerifiedMobileToken` pattern as PHONE — adds a step with no security gain when the user is already JWT-auth'd.
- Defer mobile persistence to atomic loan submission — explicitly rejected by user clarification (would cause re-OTP on abandon).

---

## R7 — Email and age persistence (SOCIAL path) — atomic with loan submission

**Decision**: The email-step and age-step of the SOCIAL Complete-Profile flow hold their values client-side only. The atomic `/api/v1/applications/apply` endpoint accepts these in its payload and writes them to the customer row alongside creating the application, documents, and questionnaire link — all in one Postgres transaction. On rollback, `customer.email` and `customer.age` revert to null (or to whatever they were before — `email` may have been already set if provider released it, in which case the request's email is ignored).

**Rationale**: Spec clarification (Q4 refinement) explicitly says mobile is immediate; email + age are atomic with submission. Saving them earlier risks leaving a half-complete customer with no application (acceptable, but the user explicitly wanted them transactional with submit).

**Alternatives considered**:
- Persist incrementally for all three fields — initially proposed and rejected by the user; keeps mobile immediate but emails/age deferred.

---

## R8 — Mobile uniqueness across paths

**Decision**: The `Customer.mobile` column has a unique constraint (sparse index — `WHERE mobile IS NOT NULL` per Postgres partial index). Collisions surface at the moment of the writing transaction:
- PHONE-signup customer creation transaction.
- SOCIAL Complete-Profile mobile-verify-otp transaction.

Both code paths catch the Postgres unique-violation error and translate to a typed `MOBILE_ALREADY_REGISTERED` response. The UI routes the user to the login screen with a pre-filled mobile.

**Rationale**: A partial unique index allows lite SOCIAL customers with `mobile = null` to coexist without index conflict. The constraint is the source of truth, not application-level pre-checks (avoids TOCTOU).

**Alternatives considered**:
- Application-level pre-check (`SELECT WHERE mobile = ?`) before insert — race condition between check and insert.
- Two tables (`PhoneCustomer` vs `SocialCustomer`) — explodes complexity, breaks single-identity model.

---

## R9 — Customer registration path tagging

**Decision**: Add `registrationPath` ENUM `{ PHONE, SOCIAL }` to `Customer`, set at creation, never mutated. Used by the loan-request flow to decide whether to short-circuit the gate popup (PHONE = no popup; SOCIAL = popup if mobile/email/age null). Admin dashboard displays it.

**Rationale**: Without this column, the loan-request endpoint would have to infer the path from "does this customer have a password?" — which is fragile if the product ever adds a "social customer sets a password" feature.

**Alternatives considered**:
- Infer from `hasPassword` boolean — fragile.
- Compute from `linkedProviders.length > 0` — wrong for a hypothetical PHONE customer who later links Google for convenience.

---

## R10 — Rate limiting layout

**Decision**: All rate limits backed by Redis via `@nestjs/throttler`'s Redis storage adapter. Per-mobile + per-IP (SHA-256-of-IP+salt) counters with sliding-window semantics. Specific limits per spec:

| Limit | Window | Scope |
|---|---|---|
| 3 active OTP codes | 15 min | per mobile |
| 5 OTP requests | 1 hour | per mobile |
| 20 OTP requests | 24 hours | per mobile |
| 60-sec resend lock | 60 sec | per mobile |
| 10 failed logins → 30-min lockout | 15 min | per mobile (PHONE customers) |
| 100 anon req (catalog GET, enums) | 15 min | per hashed-IP — Principle XV mobile-API baseline kept |
| 5 auth req | 15 min | per hashed-IP (login, signup, OTP) — Principle XV baseline kept |

**Rationale**: Redis sliding windows accurately enforce per-mobile rules without polluting Postgres with rate-tracking rows. Hashed IP storage avoids storing raw IPs (PII).

**Alternatives considered**:
- Postgres-backed rate counters — DB writes per request kill p95.
- Token bucket vs. sliding window — sliding window better matches "max N per H" wording in spec.

---

## R11 — Refresh-token storage + revocation

**Decision**: On issuance, generate a 64-byte random opaque token; persist its SHA-256 hash + customer ID + expiry + `createdByDevice` (UA fingerprint) + `revokedAt` (nullable) in `CustomerRefreshToken`. Token rotation on every use: the `/auth/refresh` endpoint verifies the incoming token's hash, marks it `revokedAt = now()`, issues a new token, persists its hash, returns the new pair to the client.

**Bulk revocation on password change/reset** (per Q1): set `revokedAt = now()` on every `CustomerRefreshToken` for that customer where `revokedAt IS NULL` EXCEPT the row that the requesting device is about to be issued. Concretely: revoke-all-then-issue-new, all in a single transaction.

**Multi-device concurrent sessions** (per Q5): no cap on the number of active rows; ordinary login on a new device does not touch existing rows.

**Rationale**: Hash-not-store matches password storage discipline (Principle VI). Rotation defeats refresh-token replay if a leaked refresh hits the endpoint twice. Bulk revoke on password change is industry default.

**Alternatives considered**:
- Stateless JWT refresh tokens — can't revoke individually without a blocklist; same DB pressure as hashed-table approach.

---

## R12 — Document presigned URL flow

**Decision**:
- **Upload** (`POST /api/v1/documents/upload-url`, Customer JWT required): client requests a presigned PUT URL by document type (`NATIONAL_ID_FRONT` | `NATIONAL_ID_BACK`) and `contentType` (`image/jpeg` | `image/png` | `application/pdf`). Server issues a 10-minute presigned URL using S3 SDK + writes a `Document` row in `pending` state with `customerId`, no `applicationId` yet, the eventual S3 key, the issued upload ID (`doc_…`). Client PUTs the file directly to S3.
- **Bind to application**: in the atomic `/applications/apply` transaction, the document IDs are looked up by `(uploadId, customerId)`, must exist, must NOT already have `applicationId`. Set `applicationId` + `verifiedAt = now()` in the transaction.
- **Admin read** (`GET /api/admin/documents/:id/presigned-read-url`): emits a 1-hour presigned GET URL per Q2 clarification.

**Rationale**: Direct-to-S3 upload avoids streaming through Node, keeps API tier stateless. The `Document` row pre-issued at upload-URL time scopes the upload to the customer immediately (no token-only proof needed, since Customer JWT is required).

**Alternatives considered**:
- Stream uploads through NestJS — adds bandwidth + memory pressure.
- Use a verified-mobile-token instead of Customer JWT for upload — outdated (was needed when customers didn't exist before apply; new model has customer-on-day-zero).

---

## R13 — Atomic loan-application transaction

**Decision**: `/api/v1/applications/apply` runs all writes in a single Prisma `$transaction()`:

```text
1. Validate Customer JWT → customerId
2. SELECT customer FOR UPDATE → ensure mobile + email + age are NON-NULL (per FR-002)
3. For SOCIAL: if email passed in payload and customer.email is null → SET customer.email
4. For SOCIAL: SET customer.age = payload.age (only if currently null; reject if outside 18-80)
5. SELECT documents WHERE id IN (frontUploadId, backUploadId) AND customerId = $1 AND applicationId IS NULL FOR UPDATE
6. Validate offer (bankProgramId valid + matches profile minimums)
7. INSERT Application (status = 'submitted', ...)
8. UPDATE documents SET applicationId = <new app id>
9. INSERT QuestionnaireAnswer rows linked to application
10. INSERT AuditEvent ('apply.submitted', correlationId)
11. Return { customer, application, tokens? } — tokens unchanged (user is already authenticated)
```

Postgres-level `SELECT … FOR UPDATE` prevents two concurrent submissions reusing the same document. Mobile uniqueness already enforced at customer-mobile column (R8).

**Rationale**: Single transaction = single rollback boundary. If any step throws, Prisma `$transaction` reverts everything.

**Alternatives considered**:
- Saga / compensating actions — way too much machinery for a single-DB synchronous flow.

---

## R14 — Mobile flutter feature naming

**Decision**: Rename the draft `auth_apply` feature (from the source brief) to `customer_auth` (auth + identity flows). The existing `apply` feature stays under that name and is extended with the gate popup and post-completion National ID step. Per spec, registration is now upfront — so "apply" is no longer part of the auth scope.

**Rationale**: Single Responsibility per feature module (Principle XXX). Mixing the registration flow and the loan-application flow in one feature violated the three-layer arch boundary.

**Alternatives considered**:
- Keep `auth_apply` — semantically wrong under the new model.

---

## R15 — Apple Sign-In on Android (defer)

**Decision**: Apple Sign-In ships **iOS only** for v1. On Android the "Continue with Apple" button is HIDDEN, not greyed out (per spec assumption). A follow-up spec adds Apple's web-flow for Android.

**Rationale**: Per spec Assumptions section; per Open Question #2 in the source brief; native Apple Sign-In SDK doesn't exist for Android, the web-flow OAuth route is non-trivial and not required at launch.

---

## R16 — National ID OCR (out of scope)

**Decision**: National ID images are stored as-is. Admin reviewers visually inspect them. No automated OCR / extraction in this feature.

**Rationale**: Per spec Assumptions section + source brief Open Question #3.

---

## R17 — Egyptian SMS gateway (operations-owned)

**Decision**: Backend abstracts the SMS gateway behind an `SmsGateway` interface; concrete implementation is selected via env var. Vendor selection is an operations decision and out of this spec's scope. The `SmsGateway` contract requires:

```text
sendOtp({ mobile, code, locale }) → Promise<{ providerMessageId, deliveryStatus }>
```

The Pino logger MUST mask the `code` parameter to `••••••` on every log line (already provided by Pino redact config).

**Rationale**: Decouples the spec from a specific vendor.

---

## R18 — Locale & RTL

**Decision**: Mobile app is Arabic-primary, English-secondary; toggle via app settings. RTL is the baseline. All new screens use `EdgeInsetsDirectional`, `AlignmentDirectional`, and `Directionality`. Admin dashboard uses `@angular/localize` and logical CSS only (`margin-inline-start`).

**Rationale**: Principle IV (Arabic-First). A19 + A20 bind.

---

## R19 — Logout endpoint (refresh-token revocation)

**Decision**: `POST /api/v1/auth/logout` (Customer JWT required) body: `{ refreshToken }`. Server marks that single refresh token row `revokedAt = now()`. Subsequent access-token use until expiry remains valid (short-lived 15 min — acceptable). Optional `?allOtherDevices=true` query param revokes every refresh token row for that customer EXCEPT the one currently identified by the bearer (mirrors password-change behavior).

**Rationale**: Per-token revocation, plus consistent "log me out of other devices" affordance.

---

## R20 — Anonymous matching endpoint deprecation

**Decision**: The previously planned `POST /api/v1/matching/preview` (anonymous) endpoint is REMOVED from this feature. With no guest mode, all matching is via the authenticated endpoint (`POST /api/v1/matching/run` or equivalent, requires Customer JWT). Source brief's rate-limit for anonymous matching (60/hour/IP) is therefore moot.

**Rationale**: Direct consequence of spec clarification Q4 (no guest mode).

---

## Decision summary

All decisions above resolve the spec's open architectural questions. No NEEDS CLARIFICATION markers remain. Phase 1 design proceeds against this research.
