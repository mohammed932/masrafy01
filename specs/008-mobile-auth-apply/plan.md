# Implementation Plan: Mobile Authentication & Two-Path Registration

**Branch**: `008-mobile-auth-apply` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-mobile-auth-apply/spec.md`

## Summary

Ship the customer-facing mobile authentication and loan-request flow for the Masrafy mobile app. Two registration paths gate the entire app (no guest mode):

> **v4.0.0 update**: Both paths now create a LITE row, then a MANDATORY profile-completion step finalizes the account. No "fully-upfront PHONE", no SOCIAL loan-request popup. Profile completion uploads profile photo + National ID front/back FIRST, then `POST /v1/auth/profile/complete` writes `firstName`, `lastName`, `birthday` (age derived, never stored), and PHONE `password`. Apply/select-offer are gated on `PROFILE_INCOMPLETE`. Guest plumbing (`Application.isGuest`, `mobileClientId`, claim flow) removed.

- **PHONE path**: mobile + OTP creates a LITE PHONE customer (tokens issued) → mandatory profile completion (photo + National ID + firstName/lastName/birthday/password) → apply gate passes.
- **SOCIAL path**: tap Continue with Google/Apple → lite Customer from provider profile → mandatory profile completion (bind mobile via OTP, photo + National ID + firstName/lastName/birthday, no password). Mobile+`mobileVerifiedAt` persist immediately on OTP success (avoids re-sending OTP after abandon — OTP cost rule); name/birthday/photo persist via `/auth/profile/complete` (before apply, not at submission).

Returning users sign in via mobile+password (PHONE) or by re-tapping the original social provider (SOCIAL); no SMS on either return path. Forgot-password is PHONE-only.

Technical approach: extend the existing NestJS backend with `/api/v1/auth/*` customer-JWT endpoints (per constitution principle XIII), a `/api/v1/applications/apply` atomic submission endpoint gated on profile completeness, `/api/v1/auth/profile/*` profile-completion + mobile-OTP + customer-scoped presign endpoints, plus presigned-document-upload endpoints scoped to authenticated customers. Add the data model (Prisma migrations) for `CustomerAccount` with `registrationPath` tag + `firstName`/`lastName`/`birthday`/`profilePhotoKey` + nullable social fields, `CustomerProvider`, `OtpChallenge`, `VerifiedMobileToken`, `SocialSession`, `PasswordResetToken`. Build the Flutter mobile feature module `customer_auth` and extend the existing `apply` feature with the profile-completion flow. Extend the Angular admin dashboard to show the new fields. All three platforms ship in lockstep (principle XXIX).

## Technical Context

**Language/Version**:
- Backend: Node.js 22 LTS, TypeScript 5.6+ (strict, noImplicitAny, strictNullChecks, noUncheckedIndexedAccess)
- Admin: Angular 18, TypeScript 5.4+ (same strictness)
- Mobile: Flutter 3.24+ / Dart 3.5+

**Primary Dependencies**:
- Backend: NestJS 10, Prisma 5, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` (12 for passwords / 10 for OTP), `@nestjs/throttler` + `ioredis`, `class-validator`, `class-transformer`, `nestjs-pino`, `@nestjs/swagger`, `zod` (env validation), `google-auth-library` (Google ID token verify), `apple-auth` or `jose` (Apple ID token verify), AWS S3 SDK (presigned URLs)
- Admin: Angular Material 18, `@angular/cdk`, `@angular/localize`, signals, standalone components, typed reactive forms, `inject()` DI
- Mobile: `flutter_bloc` (Cubit) + `freezed`, `get_it` + `injectable` + `build_runner`, `dio` (HMAC interceptor), `auto_route` v9+, `flutter_secure_storage`, `image_picker` (camera/gallery), `google_sign_in`, `sign_in_with_apple`, `sms_autofill` (Android SMS Retriever), `dartz` or equivalent `Either`

**Storage**:
- PostgreSQL 16 (Prisma migrations — `db push` forbidden in prod per Principle XI)
- Redis 7 (rate-limit + lockout sliding-window counters)
- S3-compatible object storage (existing bucket reused for National ID images; SSE-AES-256, presigned URLs only)

**Testing**: No constitutional test gates (Principles XVI / XXVII v1.2.0). Pragmatic testing chosen per layer: backend Jest unit + integration; mobile Flutter cubit unit tests + widget tests + a single integration test for the full SOCIAL Complete-Profile flow; admin smoke tests for the customer-detail extension.

**Target Platform**:
- Backend: Linux server (Docker multi-stage, non-root)
- Admin: modern evergreen browsers (Chromium / Firefox / Safari)
- Mobile: iOS 13+, Android API 23+ (Apple Sign-In iOS-only for v1)

**Project Type**: Three-platform monorepo — backend service + Angular admin SPA + Flutter mobile app (matches existing repo layout).

**Performance Goals**:
- SC-001: PHONE signup ≤ 90s end-to-end on Egyptian 4G; SOCIAL sign-in ≤ 15s
- SC-002: home-to-submit ≤ 4 min
- SC-003: returning login ≤ 15s
- SC-007: 95% of loan submissions complete in ≤ 3s
- SC-010: 95% of valid-token app starts reach home in ≤ 1.5s

**Constraints**:
- Customer JWT: 15-min access + 30-day refresh (response-body strings, NOT cookies — mobile clients) — per Principle XIII v1.8.0
- HMAC headers required on every `/api/v1/*` request (anonymous reads + auth'd writes both) — Principle XIII
- bcrypt cost ≥ 12 for passwords, cost 10 for OTP hashes
- OTP rate limits: max 3 active codes / mobile / 15 min; max 5 / hour; max 20 / day; 60-sec resend cooldown
- Login lockout: 10 failed attempts / 15 min → 30 min lockout
- Anonymous matching endpoint removed (no guest mode — `/api/v1/matching/preview` no longer required; matching is now an authenticated endpoint)
- National ID admin read presigned URL TTL: 1 hour (per spec clarification Q2)
- Mobile field becomes immutable on first OTP-verified write; `birthday` becomes immutable on first non-null write (age derived in code, never stored)
- `Customer.registrationPath` is set at creation and never mutates

**Scale/Scope**:
- Egypt-only; expected 10k–50k registered customers in first 6 months
- ~5–10 OTP sends per registered customer per LIFETIME (not per session); SMS budget scales with registration funnel, not session count
- ~15 new backend endpoints, ~10 new mobile screens, ~3 admin dashboard surface extensions
- 1 destructive-additive Prisma migration (additive on new tables; ALTER on existing `Customer` to add `registrationPath`, nullable social fields)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Financial Data Integrity | ✓ | No money fields added in this feature. Existing `BankOffer` immutability untouched. |
| II. Banks are Data | ✓ | No new loan category. Spec lists `personal`/`car`/`mortgage`/`business` — matches v1.7.0 scope-lock. A26 satisfied. |
| III. Typed Errors | ✓ | New error codes (`MOBILE_INVALID_FORMAT`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_CONSUMED`, `OTP_ATTEMPTS_EXCEEDED`, `VERIFIED_MOBILE_TOKEN_EXPIRED`, `MOBILE_ALREADY_REGISTERED`, `SOCIAL_TOKEN_INVALID`, `PROFILE_INCOMPLETE`, `AGE_INVALID`, `DOCUMENTS_MISSING`, `DOCUMENTS_NOT_OWNED`, `ACCOUNT_LOCKED`, `CREDENTIALS_INVALID`, `PASSWORD_WEAK`, `PASSWORD_SAME_AS_OLD`, `CURRENT_PASSWORD_INVALID`) MUST be added to backend `error-codes.ts`, Angular `error-codes.{ar-EG,en-US}.json`, Flutter ARB in the same PR (Principle XXIX + A22). |
| IV. Arabic-First | ✓ | All user-visible strings via `@angular/localize` on admin / ARB on mobile. RTL-tested. Logical CSS only. A19/A20 honored. |
| V. Matching Engine | ✓ | No change to engine. Anonymous preview endpoint removed; matching service now requires Customer JWT. |
| VI. PII Protection | ✓ | National ID encrypted at rest (S3 SSE-AES-256), 1-hour presigned admin read URL (per Q2), masked mobile in logs (`+20••••••7890`), OTP bcrypt-hashed never logged. Audit events append-only. |
| VII. Observability | ✓ | `X-Correlation-Id` on every request, structured Pino JSON logs, `otp.sms_sent` metric tagged by purpose with canary alarm for `login`. |
| VIII. Brand | ✓ | Mobile uses `MasrafyColorTheme` (`#06152D`). No raw hex in new code. |
| IX. Feature Modules | ✓ | New backend feature: `auth` (extends existing) + `applications/apply` + `documents/upload-url`. No `common/` → feature dependency. |
| X. Repository Pattern | ✓ | New repos: `CustomerRepository`, `OtpChallengeRepository`, `VerifiedMobileTokenRepository`, `SocialSessionRepository`, `PasswordResetTokenRepository`, `CustomerProviderRepository`. Services never touch Prisma directly. |
| XI. Prisma Migrate | ✓ | One named migration `008_mobile_auth_two_path_registration` (additive new tables + ALTER existing). `db push` forbidden. Index FKs + hot WHERE/ORDER BY. |
| XII. DTO vs Entity | ✓ | `class-validator` DTOs at controllers, Prisma types stay in repos. Global `ValidationPipe({ whitelist, forbidNonWhitelisted })`. A8 satisfied. |
| XIII. Dual Auth | ✓ | HMAC + Customer JWT layered exactly per v1.8.0 paragraph. The v1.7.0 24-hour `mobileClientId` claim endpoint was removed in the v1.8.0 amendment (same PR as this feature). No deviation remains. |
| XIV. API Contract | ✓ | Envelope `{ success, data, pagination? }`, `/api/v1/` versioned, OpenAPI published at `/api/docs`. |
| XV. Rate Limits | ✓ | Per-mobile + per-IP via `@nestjs/throttler` + Redis. Spec's OTP limits are stricter than constitution baseline. |
| XVI. Backend Testing | n/a | No constitutional gate (v1.2.0). |
| XVII–XXVII. Angular | ✓ | Customer-detail extension uses standalone, signals, new control flow, `inject()`, typed reactive forms, design tokens, `HttpClient` + interceptors, `canActivateFn` / `canMatchFn`. |
| XXIII. UI UX Skill Pipeline | ✓ | New admin customer-detail extension MUST invoke `promax` BEFORE designing and `impec` AFTER first implementation (per task list). A17 binding. |
| XXVIII. Flutter Foundations | ✓ | New `customer_auth` feature follows three-layer arch, Cubit + Freezed, per-flow page library, get_it/injectable, Dio HMAC interceptor, auto_route, secure storage of refresh token + HMAC secret. |
| XXIX. No Half Updates | ✓ | Every new error code lands in 3 places same PR. `Customer` schema changes touch backend repos + admin types + Flutter models in lockstep. Customer-detail card updates touch list + detail views together. |
| XXX–XXXV. Flutter UI | ✓ | `customer_auth` feature mirrors `data/domain/presentation`; per-flow imports library; shape-matched shimmer on the National ID upload (FR-012); shared widgets `MasrafyOtpInput`, `MasrafyMobileInput`, `MasrafyGateDialog` placed under `mobile/lib/core/widgets/` only if reused twice (lazy promotion per XXXV). |
| A1–A27. Anti-patterns | ✓ | All honored. No raw hex (A18), no `BehaviorSubject` for state (A11), no `NgModule` (A10), no `*ngIf`/`*ngFor` (A12/A13), no `any` (A15), no template-driven forms (A16), no manual `fetch` (A21). Money inputs not used in this feature so A27 n/a. |

**Result: PASS**. Constitution v1.8.0 amendment landed in the same PR rewrites Principle XIII to remove the v1.7.0 claim-endpoint language and codify the two-path registration model. No `Complexity Tracking` rows required.

## Project Structure

### Documentation (this feature)

```text
specs/008-mobile-auth-apply/
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 — OpenAPI fragments
│   ├── auth-signup-phone.yaml
│   ├── auth-otp.yaml
│   ├── auth-social.yaml
│   ├── auth-login-logout-refresh.yaml
│   ├── auth-password.yaml
│   ├── auth-me.yaml
│   ├── auth-profile-complete.yaml
│   ├── applications-apply.yaml
│   └── documents-upload-url.yaml
├── checklists/
│   └── requirements.md  # already created by /speckit.specify
└── tasks.md             # Phase 2 output of /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── auth/                              # extended
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts             # adds /signup/phone, /otp/request, /otp/verify, /social/google, /social/apple, /social/login, /login, /logout, /refresh, /me, /password/reset, /password/change
│   │   ├── profile.controller.ts          # NEW — /profile/mobile-verify, /profile/mobile-otp-verify (SOCIAL Complete-Profile)
│   │   ├── auth.service.ts
│   │   ├── customer-otp.service.ts        # NEW
│   │   ├── customer-token.service.ts      # NEW (mints customer JWT + refresh, separate from admin JWT)
│   │   ├── social/
│   │   │   ├── google-verify.service.ts   # NEW
│   │   │   └── apple-verify.service.ts    # NEW
│   │   ├── dto/                           # signup, login, otp request/verify, social, profile-completion, password reset/change
│   │   ├── strategies/
│   │   │   └── customer-jwt.strategy.ts   # NEW
│   │   ├── guards/
│   │   │   └── customer-jwt.guard.ts      # NEW
│   │   └── repositories/                  # CustomerRepository, OtpChallengeRepository, VerifiedMobileTokenRepository, SocialSessionRepository, PasswordResetTokenRepository, CustomerProviderRepository, CustomerRefreshTokenRepository
│   ├── applications/                      # extended
│   │   ├── apply.controller.ts            # NEW — /api/v1/applications/apply (atomic submission)
│   │   └── apply.service.ts               # NEW — orchestrates atomic transaction
│   ├── documents/                         # extended
│   │   └── upload-url.controller.ts       # NEW — /api/v1/documents/upload-url (Customer JWT only)
│   ├── matching/                          # extended
│   │   └── matching.controller.ts         # ADJUSTED — preview endpoint now requires Customer JWT
│   ├── audit/                             # extended — new event types
│   ├── common/
│   │   ├── filters/                       # error-code response shape (existing)
│   │   ├── error-codes.ts                 # NEW codes added
│   │   └── guards/                        # HmacGuard + CustomerJwtGuard composition decorator (@Auth(['hmac','customer']))
│   └── infra/
│       └── s3-client.service.ts           # presigned URL issuance (existing or new)
└── prisma/
    └── migrations/008_mobile_auth_two_path_registration/

admin/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── customers/                 # extended
│   │   │   │   ├── detail/                # adds registrationPath, mobileVerifiedAt, firstName/lastName, birthday(+derived age), profilePhotoKey, email, profileComplete, linkedProviders, hasPassword, last-10-OTPs
│   │   │   │   └── list/                  # adds "has applications" filter
│   │   │   └── audit-log/                 # extended — auth event filters
│   │   └── core/
│   │       └── i18n/
│   │           └── error-codes.{ar-EG,en-US}.json  # extended
│   └── styles/                            # no new tokens

mobile/
└── lib/
    ├── features/
    │   ├── customer_auth/                 # NEW (replaces draft "auth_apply" naming from source brief)
    │   │   ├── data/
    │   │   │   ├── datasources/customer_auth_remote_datasource.dart
    │   │   │   ├── models/                # Signup{Phone}Request, OtpRequestModel, OtpVerifyModel, SocialSessionModel, LoginRequest, ProfileCompletionRequest, TokenEnvelopeModel, CustomerModel
    │   │   │   └── repositories/customer_auth_repository_impl.dart
    │   │   ├── domain/
    │   │   │   ├── entities/              # CustomerEntity, TokenEnvelopeEntity, SocialSessionEntity, OtpChallengeEntity
    │   │   │   ├── enums/                 # RegistrationPath (PHONE / SOCIAL), OtpPurpose, SocialProvider
    │   │   │   ├── repositories/customer_auth_repository.dart
    │   │   │   └── usecases/customer_auth_usecase.dart
    │   │   └── presentation/
    │   │       ├── cubits/
    │   │       │   ├── phone_signup_cubit.dart + _state.dart   # Freezed
    │   │       │   ├── social_signin_cubit.dart + _state.dart
    │   │       │   ├── login_cubit.dart + _state.dart
    │   │       │   ├── forgot_password_cubit.dart + _state.dart
    │   │       │   └── complete_profile_cubit.dart + _state.dart
    │   │       └── pages/
    │   │           ├── customer_auth_pages.imports.dart        # XXXII per-flow library
    │   │           ├── landing/                                # CTAs: Phone signup / Google / Apple / Log in
    │   │           ├── phone_signup/                           # mobile → OTP (creates LITE PHONE customer)
    │   │           ├── login/
    │   │           ├── forgot_password/
    │   │           └── complete_profile/                       # both paths: photo + National ID + firstName/lastName/birthday (+ PHONE password / SOCIAL mobile-OTP)
    │   └── apply/                         # extended (NOT new)
    │       └── presentation/pages/apply/                       # gated on PROFILE_INCOMPLETE → routes to complete_profile; submission binds pre-existing National ID docs
    └── core/
        ├── widgets/                       # MasrafyOtpInput, MasrafyMobileInput, MasrafyGateDialog (promoted only if reused twice — XXXV)
        ├── theme/
        ├── routing/                       # auto_route — new routes for landing, phone_signup, login, forgot_password, complete_profile, app shell post-auth
        └── storage/                       # extend StorageKeys: refreshToken
```

**Structure Decision**: Three-platform mirror of the existing repo (backend / admin / mobile). New backend work concentrates in `backend/src/auth/` + `applications/apply.controller.ts` + `documents/upload-url.controller.ts`. New admin work is contained in `admin/src/app/features/customers/` + `audit-log/` + i18n JSON. New mobile work is a brand-new `mobile/lib/features/customer_auth/` feature plus minor extensions to an existing `apply` feature. The previous source brief's naming (`auth_apply`) is replaced by `customer_auth` to reflect the new model where authentication is upfront and "apply" is a separate post-auth feature.

## Glossary

Canonical terms to avoid drift across spec / plan / tasks / contracts:

| Term | Meaning |
|---|---|
| **Apply / Loan-Request flow** | Identical concept. The user-facing flow that creates an `Application` entity. Mobile feature folder = `apply`; backend controller = `apply.controller.ts`; admin filter = "has applications". When narrating user journeys, prefer "loan-request flow". When naming code, use `apply`. |
| **SOCIAL sign-in** | The Google / Apple authentication path (canonical phrasing). Avoid "social signup", "social signin" — pick "SOCIAL sign-in". |
| **PHONE signup** | The mobile + OTP path that creates a LITE PHONE customer (canonical phrasing). v4.0.0: name/birthday/password come later, at profile completion. |
| **Profile-completion flow** | The full-screen flow (both paths) that finalizes a LITE row: photo + National ID front/back + firstName/lastName/birthday (PHONE also password; SOCIAL also mobile-OTP). Mobile feature path = `customer_auth/.../complete_profile/`. |
| **Profile gate** | v4.0.0: apply/select-offer return `PROFILE_INCOMPLETE` while the profile is incomplete; the app routes to the profile-completion flow. Replaces the pre-v4.0.0 SOCIAL "gate popup". |
| **Customer JWT** | Customer-facing access + refresh token pair (Principle XIII v1.8.0). Distinct from admin JWT. |
| **Verified-mobile token** | Short-lived single-use bearer issued by `/auth/otp/verify` (PHONE-signup path only). |

## Complexity Tracking

No constitution violations. No rows required.
