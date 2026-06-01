---
description: "Task list for 008-mobile-auth-apply implementation"
---

# Tasks: Mobile Authentication & Two-Path Registration

**Input**: Design documents from `/specs/008-mobile-auth-apply/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included — spec §10 explicitly specifies a Test Plan (backend Jest, Flutter cubit/widget/golden/integration, admin smoke). Tests are not constitutional gates (Principle XVI/XXVII v1.2.0) but are part of the deliverable.

**Organization**: Tasks grouped by user story. Three platforms touched in lockstep per Principle XXIX.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependencies on incomplete tasks)
- **[Story]**: US1 / US2 / US3 / US4 / US5 / US6 (maps to spec.md user stories)

## Path Conventions

- Backend: `/Users/HD/Programming/masrafy01/backend/`
- Admin: `/Users/HD/Programming/masrafy01/admin/`
- Mobile: `/Users/HD/Programming/masrafy01/mobile/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-level prerequisites — env vars, dependencies, migration scaffolding.

- [x] T001 Add customer-JWT env-var schema entries to `backend/src/infra/env/env.schema.ts`: `GOOGLE_OAUTH_CLIENT_IDS`, `APPLE_BUNDLE_ID`, `SMS_GATEWAY_PROVIDER`, `SMS_GATEWAY_FROM`, `ADMIN_DOCUMENT_PRESIGNED_READ_TTL_SECONDS`. (Customer-JWT secrets + S3 vars already existed from feature 001/005.)
- [x] T002 [P] Update `backend/.env.example` with the new keys + already-existing CUSTOMER_JWT_* (which were missing from the example).
- [x] T003 [P] Installed `google-auth-library` + `jose` via npm. `@aws-sdk/*` already present from feature 005.
- [x] T004 [P] Added mobile pub deps in `mobile/pubspec.yaml`: `google_sign_in`, `sign_in_with_apple`, `sms_autofill`, `image_picker`, `json_annotation`, `json_serializable`. `flutter pub get` succeeded.
- [ ] T005 [P] Add migration directory scaffold `backend/prisma/migrations/008_mobile_auth_two_path_registration/migration.sql` (empty file — populated by T012).
- [x] T006 [P] Added feature-008 error codes to `backend/src/common/errors/error-codes.ts` with HTTP status mappings. Existing codes (`CUSTOMER_PHONE_ALREADY_REGISTERED`, `CUSTOMER_INVALID_CREDENTIALS`, etc.) reused where the semantics match.
- [x] T007 [P] Synced new error codes to `admin/src/i18n/error-codes.ar-EG.json` + `admin/src/i18n/error-codes.en-US.json` (Principle XXIX + A22).
- [x] T008 [P] Scaffolded Flutter ARB: created `mobile/l10n.yaml`, `mobile/lib/l10n/intl_ar.arb`, `mobile/lib/l10n/intl_en.arb` with all feature-008 error-code keys prefixed `auth_*`. (Mobile codebase did not yet have l10n infrastructure — bootstrapped here.)
- [ ] T009 [P] Pin Apple Sign-In Capability in iOS project (`mobile/ios/Runner.xcodeproj` Capabilities → Sign In with Apple).
- [ ] T010 [P] Add Google Sign-In iOS URL scheme (`mobile/ios/Runner/Info.plist`) + Android SHA-1 fingerprint to Google Cloud Console (manual ops step — document in T011).
- [ ] T011 Document Google + Apple OAuth client-ID setup in `specs/008-mobile-auth-apply/quickstart.md` "Native integrations" section (add subheading + steps).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure all stories depend on — Prisma migration, repositories, customer JWT strategy, mobile customer-auth scaffold.

**⚠️ CRITICAL**: No user story work can begin until Phase 2 is complete.

### Backend — Prisma migration + repositories

- [x] T012 Authored Prisma schema changes in `backend/prisma/schema.prisma`: added `RegistrationPath`, `SocialProvider`, `OtpPurpose` enums + 13 new `AuditEventType` values; added 6 new models (`CustomerProvider`, `OtpChallenge`, `VerifiedMobileToken`, `SocialSession`, `PasswordResetToken`, `QuestionnaireAnswer`); altered existing `CustomerAccount` to add `registrationPath` (default PHONE, backfilled), `mobileVerifiedAt`, `age`, and relax `phone` + `passwordHash` to nullable. `npx prisma validate` + `npx prisma format` pass. Note: feature targets existing `CustomerAccount` table (not a fresh `Customer` table — uses existing field names `phone`/`name` rather than `mobile`/`fullName` to keep blast radius small).
- [x] T013 Hand-authored migration SQL at `backend/prisma/migrations/20260526180000_008_mobile_auth_two_path_registration/migration.sql`. Includes: enum creation, AuditEventType additions, customer_account ALTER (add columns + relax NOT NULLs + backfill `mobileVerifiedAt = createdAt` for existing PHONE rows), three CHECK constraints (NOT VALID — grandfathers legacy data, enforces new writes), six new tables with FKs + indexes. Partial unique index NOT needed — Postgres UNIQUE allows multiple NULLs by default so existing `customer_account_phone_key` works as-is for nullable phone.
- [x] T013a Patched existing `customer-account.repository.ts` types `CustomerForLogin` + `CustomerListRow` to make `phone`/`passwordHash` nullable. Added defensive `passwordHash === null` check in `customer-auth.service.ts:login()` returning generic `CUSTOMER_INVALID_CREDENTIALS` per FR-023 (no enumeration of SOCIAL customers via phone+password login). Backend TypeScript compile clean.
- [ ] T014 [P] Implement `backend/src/auth/repositories/customer.repository.ts` — CRUD + `findByMobile`, `findById`, `updateMobileBound`, `updateEmailAndAge`, `updatePasswordHash` (all per FR write-authority matrix in data-model.md).
- [ ] T015 [P] Implement `backend/src/auth/repositories/otp-challenge.repository.ts` — `create`, `findActiveByMobileAndPurpose`, `consume`, `decrementAttempts`.
- [ ] T016 [P] Implement `backend/src/auth/repositories/verified-mobile-token.repository.ts` — `create`, `consume`, `findByHash`.
- [ ] T017 [P] Implement `backend/src/auth/repositories/social-session.repository.ts` — `create`, `findById`, `consume`, `findByProviderUserId`.
- [ ] T018 [P] Implement `backend/src/auth/repositories/password-reset-token.repository.ts` — `create`, `consume`, `findByHash`.
- [ ] T019 [P] Implement `backend/src/auth/repositories/customer-refresh-token.repository.ts` — `create`, `findActiveByHash`, `revoke`, `revokeAllForCustomer`, `revokeAllForCustomerExcept`.
- [ ] T020 [P] Implement `backend/src/auth/repositories/customer-provider.repository.ts` — `create`, `findByProviderUserId`, `listForCustomer`.

### Backend — auth shared services + guards

- [ ] T021 Implement `backend/src/auth/customer-token.service.ts` — `issueTokenPair(customerId)` (mint 15-min access HS256-signed + 64-byte opaque refresh, persist refresh hash via T019), `verifyAccessToken(token)`, `rotateRefresh(refreshToken)`, `revoke(refreshToken)`, `revokeAllExcept(customerId, exceptHash)`.
- [ ] T022 Implement `backend/src/auth/customer-otp.service.ts` — `issueOtp({ mobile, purpose, locale, customerId? })` (rate-limit check via Redis: max 3 active / 15 min, 5 / hour, 20 / day per mobile; **enforce 60-sec resend lock per mobile per FR-019**; bcrypt-hash code; store row; dispatch SMS), `verifyOtp({ otpId, code, purpose })` (attempts decrement, expiry check, consume on success).
- [ ] T023 Implement `backend/src/auth/strategies/customer-jwt.strategy.ts` — passport-jwt strategy reading the `CUSTOMER_JWT_ACCESS_SECRET`, validating `sub` (customer id) + standard claims, hydrating `req.customer`.
- [ ] T024 Implement `backend/src/auth/guards/customer-jwt.guard.ts` extending `AuthGuard('customer-jwt')`.
- [ ] T025 Implement `backend/src/common/decorators/auth.decorator.ts` — `@Auth(['hmac'])` and `@Auth(['hmac','customer'])` composition decorators that stack `HmacGuard` (existing) + `CustomerJwtGuard` per Principle XIII.
- [ ] T026 Add `backend/src/auth/sms-gateway/sms-gateway.module.ts` interface + `MockSmsGateway` impl (logs OTP code via Pino with code masked to `••••••`). Real provider impl deferred to ops.

### Backend — common cross-cutting

- [ ] T027 [P] Populate `backend/src/common/error-codes.ts` values + HTTP-status mapping for all new codes (built on T006 scaffold). Update `backend/src/common/filters/typed-error.filter.ts` if new statuses required.
- [ ] T028 [P] Extend `backend/src/audit/audit-event.types.ts` with the new event-type strings listed in data-model.md §AuditEvent.
- [ ] T029 [P] Configure Pino redaction in `backend/src/infra/pino.config.ts` to mask: `*.mobile`, `*.code` (OTP), `*.password`, `*.passwordHash`, `*.refreshToken`, `Authorization`. Verify with a unit test (T060).

### Mobile — customer_auth feature scaffold

- [ ] T030 Create feature folder `mobile/lib/features/customer_auth/{data,domain,presentation}/` with skeleton files per Principle XXX (one file per layer placeholder).
- [ ] T031 [P] Implement `mobile/lib/features/customer_auth/domain/enums/registration_path.dart` (`PHONE`, `SOCIAL`), `social_provider.dart` (`GOOGLE`, `APPLE`), `otp_purpose.dart` (`SIGNUP`, `PROFILE_MOBILE`, `FORGOT_PASSWORD`, `MOBILE_CHANGE`).
- [ ] T032 [P] Implement `mobile/lib/features/customer_auth/domain/entities/customer_entity.dart` (Freezed; nullable `mobile`, `mobileVerifiedAt`, `email`, `age`; non-null `id`, `registrationPath`, `fullName`; computed `requiresProfileCompletion`).
- [ ] T033 [P] Implement `mobile/lib/features/customer_auth/domain/entities/token_envelope_entity.dart` (Freezed; `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `refreshTokenExpiresAt`).
- [ ] T034 [P] Implement `mobile/lib/features/customer_auth/domain/entities/otp_challenge_entity.dart` (Freezed; `otpId`, `maskedMobile`, `expiresInSeconds`, `resendAvailableInSeconds`).
- [ ] T035 [P] Implement `mobile/lib/features/customer_auth/domain/entities/social_session_entity.dart` (Freezed; `socialSessionId`, `provider`, `profile`, `existingCustomer?`, `newCustomer?`).
- [ ] T036 Implement `mobile/lib/features/customer_auth/domain/repositories/customer_auth_repository.dart` abstract interface — every method returns `Future<Either<Failure, T>>`. Methods: `signupPhoneStart`, `signupPhoneComplete`, `requestOtp`, `verifyOtp`, `socialGoogle`, `socialApple`, `socialLogin`, `login`, `logout`, `refresh`, `me`, `requestPasswordReset`, `resetPassword`, `changePassword`, `profileMobileRequestOtp`, `profileMobileVerifyOtp`.
- [ ] T037 [P] Implement `mobile/lib/features/customer_auth/data/models/customer_model.dart` + `fromJson` / `toJson` / `toEntity`. (T032 already supplies entity.)
- [ ] T038 [P] Implement `mobile/lib/features/customer_auth/data/models/token_envelope_model.dart`.
- [ ] T039 [P] Implement request models in `mobile/lib/features/customer_auth/data/models/`: `signup_phone_start_request.dart`, `signup_phone_complete_request.dart`, `otp_request_request.dart`, `otp_verify_request.dart`, `social_signin_request.dart`, `social_login_request.dart`, `login_request.dart`, `refresh_request.dart`, `password_reset_request.dart`, `password_change_request.dart`, `profile_mobile_request_otp_request.dart`, `profile_mobile_verify_otp_request.dart`.
- [ ] T040 Implement `mobile/lib/features/customer_auth/data/datasources/customer_auth_remote_datasource.dart` with Dio methods for every endpoint in `contracts/` (typed, no `Map<String, dynamic>` past this file — Principle XXVIII).
- [ ] T041 Implement `mobile/lib/features/customer_auth/data/repositories/customer_auth_repository_impl.dart` — wraps each datasource call with `ApiHandler.callApi` (existing helper), maps to `Either<Failure, T>`.
- [ ] T042 [P] Run `dart run build_runner build --delete-conflicting-outputs` to generate Freezed + JsonSerializable files for T032..T039.

### Mobile — Dio interceptors + token storage

- [ ] T043 Extend `mobile/lib/core/storage/storage_keys.dart` with `customerRefreshToken` key. Implement `mobile/lib/core/storage/secure_storage_service.dart` `getCustomerRefreshToken` / `setCustomerRefreshToken` / `clearCustomerRefreshToken`.
- [ ] T044 Implement in-memory `mobile/lib/core/auth/access_token_holder.dart` — singleton holding access token + expiry; cleared on logout.
- [ ] T045 Implement `mobile/lib/core/network/customer_jwt_interceptor.dart` — attaches `Authorization: Bearer <accessToken>` to outgoing requests when present; on 401 + refresh-token available, calls `/auth/refresh`, rotates tokens, retries the original request once.
- [ ] T046 Wire `customer_jwt_interceptor.dart` into `mobile/lib/core/network/dio_factory.dart` AFTER the existing HMAC interceptor (HMAC first; JWT second) per Principle XIII.

### Mobile — routing scaffold

- [ ] T047 Add auto_route entries to `mobile/lib/core/routing/app_router.dart` for: `LandingRoute`, `PhoneSignupRoute` (with sub-routes: mobile, otp, profile), `LoginRoute`, `ForgotPasswordRoute` (sub: mobile, reset), `CompleteProfileRoute` (sub: mobile, otp, email, age), `AuthenticatedShellRoute` (post-auth home). Regenerate router via build_runner.
- [ ] T048 Implement `mobile/lib/core/routing/auth_redirect_guard.dart` — auto_route guard that consults `access_token_holder` + `secure_storage_service.getCustomerRefreshToken` + tries silent refresh; redirects to `LandingRoute` if no refresh token, to `AuthenticatedShellRoute` if refresh succeeds, to `LandingRoute` if refresh fails.

### Mobile — DI registration

- [ ] T049 Register `CustomerAuthRemoteDatasource`, `CustomerAuthRepositoryImpl`, `CustomerAuthUsecase`, the new cubits (US-specific cubits registered in their phases) in `mobile/lib/core/di/injection.dart` via `@LazySingleton` / `@injectable` annotations. Run `dart run build_runner build`.

**Checkpoint**: Foundation ready. User stories may now proceed in parallel.

---

## Phase 3: User Story 1 — PHONE signup → questionnaire → matching → loan request (Priority: P1) 🎯 MVP

**Goal**: First-time user signs up via phone (mobile + OTP + name + email + password + age), browses catalog, answers questionnaire, sees matched offers, taps Apply, uploads National ID, submits loan application.

**Independent Test**: Install fresh app → tap "Sign Up with Phone" → complete all registration steps → confirm Customer row exists fully populated and tokens are issued → browse, match, apply → confirm Application row created against the same customer.

### Tests for User Story 1

- [ ] T050 [P] [US1] Backend Jest unit test for `customer-otp.service.ts` request + verify happy-paths, rate-limit boundaries, code expiry, attempts decrement — `backend/test/unit/auth/customer-otp.service.spec.ts`.
- [ ] T051 [P] [US1] Backend Jest unit test for `customer-token.service.ts` issue + rotate + revoke — `backend/test/unit/auth/customer-token.service.spec.ts`.
- [ ] T052 [P] [US1] Backend Jest e2e test for `/auth/signup/phone/start` + `/auth/otp/verify` + `/auth/signup/phone/complete` happy path — `backend/test/e2e/auth-signup-phone.e2e-spec.ts`.
- [ ] T053 [P] [US1] Backend Jest e2e test for `/applications/apply` PHONE happy path (mocked offer + documents) — `backend/test/e2e/applications-apply-phone.e2e-spec.ts`.
- [ ] T054 [P] [US1] Flutter cubit unit test `PhoneSignupCubit` — every state transition — `mobile/test/features/customer_auth/presentation/cubits/phone_signup_cubit_test.dart`.
- [ ] T055 [P] [US1] Flutter widget test for `phone_signup_otp_page` paste + resend countdown — `mobile/test/features/customer_auth/presentation/pages/phone_signup/otp_page_test.dart`.
- [ ] T056 [P] [US1] Flutter golden test (RTL Arabic) for the PHONE signup mobile + OTP + profile screens — `mobile/test/features/customer_auth/golden/phone_signup_golden_test.dart`.
- [ ] T057 [P] [US1] Flutter integration test: full PHONE signup → apply happy path — `mobile/integration_test/phone_signup_apply_test.dart`.

### Implementation for User Story 1 — Backend

- [ ] T058 [US1] Implement `backend/src/auth/dto/signup-phone-start.dto.ts` (`mobile`, `locale`) with `class-validator` (Egyptian E.164 regex) and `backend/src/auth/dto/signup-phone-complete.dto.ts` (`verifiedMobileToken`, `fullName`, `email`, `password`, `age`).
- [ ] T059 [US1] Implement `backend/src/auth/auth.service.ts` methods: `startPhoneSignup` (rate-limit, issue OTP), `completePhoneSignup` (consume verifiedMobileToken in a `prisma.$transaction` together with `customer.create({ registrationPath: 'PHONE', mobile, mobileVerifiedAt: now(), fullName, email, passwordHash: bcrypt(password,12), age })` + issue tokens; catch `P2002` unique violation → throw `MOBILE_ALREADY_REGISTERED`).
- [ ] T060 [US1] Implement `backend/src/auth/auth.controller.ts` routes `POST /signup/phone/start`, `POST /signup/phone/complete` wired to T059. Add HmacGuard (no Customer JWT — pre-auth). Throttle: 5 / 15 min / IP.
- [ ] T061 [US1] Implement `backend/src/auth/dto/otp-request.dto.ts` + `otp-verify.dto.ts`. Reject `purpose: "LOGIN"` with HTTP 400 + emit `audit.security.alarm` event (FR-017).
- [ ] T062 [US1] Implement `auth.controller.ts` routes `POST /auth/otp/request`, `POST /auth/otp/verify` calling `customer-otp.service`. Throttle per spec rules.
- [ ] T063 [US1] Implement `backend/src/applications/apply.controller.ts` `POST /api/v1/applications/apply` with `@Auth(['hmac','customer'])`. DTO: `apply.dto.ts` (`profileCompletion?`, `offerSelection`, `questionnaire`, `documents`).
- [ ] T064 [US1] Implement `backend/src/applications/apply.service.ts` — atomic `prisma.$transaction`:
  1. SELECT customer FOR UPDATE.
  2. Validate per FR-002 (mobile + email + age present for PHONE — abort with PROFILE_INCOMPLETE if not; SOCIAL handled in US4).
  3. SELECT documents FOR UPDATE (verify ownership + unbound).
  4. Validate offer (BankProgram still matches profile minimums; call `MatchingEngine.validateSelection`).
  5. INSERT Application.
  6. UPDATE documents.applicationId.
  7. INSERT QuestionnaireAnswer rows.
  8. emit `application.apply.submitted` audit event.
  9. Return `{ customer, application }`.
- [ ] T065 [US1] Implement `backend/src/documents/upload-url.controller.ts` `POST /api/v1/documents/upload-url` (`@Auth(['hmac','customer'])`). Uses S3 SDK to issue 10-minute PUT URL; persists `Document` row with `customerId` set, `applicationId` null. DTO `upload-url-request.dto.ts` enums `documentType`, `contentType`.
- [ ] T066 [US1] Adjust `backend/src/matching/matching.controller.ts` to require `@Auth(['hmac','customer'])` on the preview endpoint (no anonymous matching anymore per Q4). Anonymous `/api/v1/matching/preview` is removed if present.
- [ ] T067 [US1] Add `audit-event` writes at every step in T059/T064: `auth.signup.phone.requested`, `auth.signup.phone.completed`, `auth.otp.requested`, `auth.otp.verified`, `auth.login.attempted`, `auth.login.succeeded`, `auth.login.failed`, `auth.login.locked`, `auth.logout`, `auth.tokens.revoked`, `application.apply.submitted` — every event carries correlationId + masked mobile per FR-040.
- [ ] T067a [P] [US1] Implement backend questionnaire-answer controller + service + repository at `backend/src/questionnaire/` covering FR-007: `GET /api/v1/questionnaire` (read draft for authenticated customer), `PUT /api/v1/questionnaire` (upsert draft fields), `DELETE /api/v1/questionnaire` (reset). All endpoints `@Auth(['hmac','customer'])`. Persist to `QuestionnaireAnswer` table (data-model.md). Cross-device resume works because the table is keyed by `customerId`.
- [ ] T067b [P] [US1] Adjust `backend/src/catalog/catalog.controller.ts` and `backend/src/enumerations/enumerations.controller.ts` to require `@Auth(['hmac','customer'])` instead of `@Auth(['hmac'])` (per FR-006: no unauthenticated catalog access). Update OpenAPI security blocks.
- [ ] T067c [P] [US1] Add Mobile questionnaire-answers datasource + repository + cubit wire-up to call T067a endpoints from the existing questionnaire feature. Replace any remaining local-only Hive box with server-backed reads/writes (FR-007).

### Implementation for User Story 1 — Mobile (Flutter)

- [ ] T068 [US1] Implement `mobile/lib/features/customer_auth/presentation/cubits/phone_signup_cubit.dart` + `phone_signup_state.dart` (Freezed sealed: `idle`, `requestingOtp`, `otpSent`, `verifyingOtp`, `mobileVerified`, `submittingProfile`, `success`, `failure`).
- [ ] T069 [US1] Implement `customer_auth_pages.imports.dart` library scaffold per Principle XXXII.
- [ ] T070 [US1] Implement landing page `mobile/lib/features/customer_auth/presentation/pages/landing/landing_page.dart` with three CTAs (Phone signup / Continue with Google / Continue with Apple — Apple hidden on Android per R15) + "Log In" link.
- [ ] T071 [US1] Implement PHONE signup mobile page `mobile/lib/features/customer_auth/presentation/pages/phone_signup/mobile_page.dart` — single mobile field + "Send code".
- [ ] T072 [US1] Implement OTP page `mobile/lib/features/customer_auth/presentation/pages/phone_signup/otp_page.dart` — 6-digit OTP, paste, auto-submit, 60-sec resend countdown, "change number" link. Android: integrate `sms_autofill` SMS Retriever.
- [ ] T073 [US1] Implement profile page `mobile/lib/features/customer_auth/presentation/pages/phone_signup/profile_page.dart` — fullName + email + password (show/hide toggle) + confirm-password + age. Typed reactive validators.
- [ ] T074 [US1] Implement post-signup token persistence: on cubit `success`, write `refreshToken` to `secure_storage_service`, set `access_token_holder`, navigate to `AuthenticatedShellRoute`.
- [ ] T075 [US1] Build `apply` feature extensions: extend `mobile/lib/features/apply/presentation/pages/apply/national_id_page.dart` with shape-matched shimmer (Principle XXXIV) + camera/gallery via `image_picker` + image compression ≤2MB before upload + per-side progress.
- [ ] T076 [US1] Implement summary page `mobile/lib/features/apply/presentation/pages/apply/summary_page.dart` displaying offer + customer masked-mobile + doc upload status + "Submit Application" CTA. On tap: call `submitApplyUsecase` (Customer JWT auth'd). On submission FAILURE (FR-015): keep the apply cubit's document IDs + selected-offer + email/age fields in state so the user can retry without re-uploading or re-entering — verified by widget test.
- [ ] T077 [US1] Implement success page `mobile/lib/features/apply/presentation/pages/apply/success_page.dart` with "View Application Status" CTA. On entry (FR-014): clear the pending-offer-selection client cache + apply cubit's document IDs; navigate via auto_route's `replace` so the user cannot back-button into a stale apply flow.

### Implementation for User Story 1 — Admin (Angular)

- [ ] T078 [US1] Extend customer-list filter UI in `admin/src/app/features/customers/list/customers-list.component.ts` to support `?hasApplications=true|false` query param (typed Reactive Form filter; signal-driven).
- [ ] T079 [US1] Extend customer-detail card in `admin/src/app/features/customers/detail/customers-detail.component.ts` + template to display `registrationPath`, `mobileVerifiedAt` (or "not yet verified"), `age` (or "not yet collected"), `email` (or "not yet collected"), `linkedProviders`, `hasPassword`, latest 10 OTP challenges (status-only). Apply UI UX skills: invoke `promax` before designing, `impec` after first implementation (Principle XXIII / A17 — manually triggered by author).

**Checkpoint**: User Story 1 is fully functional — PHONE customer can sign up, browse, match, apply.

---

## Phase 4: User Story 2 — Returning user login (PHONE password + SOCIAL re-signin) (Priority: P1)

**Goal**: Returning PHONE customers sign in with mobile + password (no SMS); returning SOCIAL customers re-tap their original provider button (no SMS).

**Independent Test**: After US1 succeeds on Device A, on Device B: enter same mobile + password → home. Confirm `otp.sms_sent` metric is NOT incremented during login.

### Tests for User Story 2

- [ ] T080 [P] [US2] Backend Jest e2e test for `/auth/login` happy + wrong-password + unknown-mobile + SOCIAL-customer-using-phone-login → all return same `CREDENTIALS_INVALID` — `backend/test/e2e/auth-login.e2e-spec.ts`.
- [ ] T081 [P] [US2] Backend Jest unit test for login lockout: 10 failed attempts / 15 min → `ACCOUNT_LOCKED` with `unlockAt` — `backend/test/unit/auth/login-lockout.service.spec.ts`.
- [ ] T082 [P] [US2] Backend Jest e2e test for `/auth/social/login` happy + invalid session — `backend/test/e2e/auth-social-login.e2e-spec.ts`.
- [ ] T083 [P] [US2] Flutter cubit unit test `LoginCubit` covering valid + invalid + lockout — `mobile/test/features/customer_auth/presentation/cubits/login_cubit_test.dart`.

### Implementation for User Story 2

- [ ] T084 [US2] Implement `backend/src/auth/dto/login.dto.ts` (`mobile`, `password`).
- [ ] T085 [US2] Implement `backend/src/auth/auth.service.ts:loginPhone` — `findByMobile`, bcrypt compare, on success issue tokens + audit `auth.login.succeeded`; on failure increment Redis counter `login:fail:<mobile>` → if ≥10 within 15 min, set lockout key `login:lock:<mobile>` TTL=30min + return `ACCOUNT_LOCKED`; else return `CREDENTIALS_INVALID` (same code for unknown mobile / SOCIAL-customer-no-password — no enumeration).
- [ ] T086 [US2] Implement controller routes `POST /auth/login`, `POST /auth/social/login` in `backend/src/auth/auth.controller.ts`. Throttle 5/15min/IP.
- [ ] T087 [US2] Implement `backend/src/auth/social/google-verify.service.ts` — uses `google-auth-library.verifyIdToken({ idToken, audience: GOOGLE_OAUTH_CLIENT_IDS })`, returns `{ providerUserId, email?, fullName }`.
- [ ] T088 [US2] Implement `backend/src/auth/social/apple-verify.service.ts` — uses `jose` to verify against Apple JWKs (cached 24 h), extracts `sub`, `email?`; accepts the optional first-call `userInfo` payload for name + email.
- [ ] T089 [US2] Implement `auth.service.ts:socialSignIn(provider, idToken, userInfo?)` — verify token; lookup `CustomerProvider`; if found → create `SocialSession` referencing existingCustomer; if not → create LITE SOCIAL Customer + `CustomerProvider` link + issue tokens (R3 + R6).
- [ ] T090 [US2] Implement `auth.service.ts:socialLogin(socialSessionId)` — consume SocialSession, must have non-null `resolvedCustomerId`, issue tokens.
- [ ] T091 [US2] Implement controller routes `POST /auth/social/google`, `POST /auth/social/apple`.
- [ ] T092 [US2] Implement Flutter `mobile/lib/features/customer_auth/presentation/pages/login/login_page.dart` — typed reactive form mobile + password + "Forgot password?" link + submit.
- [ ] T093 [US2] Implement Flutter `LoginCubit` + state — handle `CREDENTIALS_INVALID`, `ACCOUNT_LOCKED` (show unlockAt in Arabic), success.
- [ ] T094 [US2] Implement Flutter Google Sign-In flow on landing: tap → `GoogleSignIn.signIn()` → get idToken → call `socialGoogleUsecase` → if `newCustomer` present, persist tokens + navigate home; if `existingCustomer` present, call `socialLoginUsecase` → persist tokens + home.
- [ ] T095 [US2] Implement Flutter Apple Sign-In flow (iOS only — button hidden on Android): tap → `SignInWithApple.getAppleIDCredential()` → idToken → similar branch as Google.

**Checkpoint**: PHONE + SOCIAL returning users can both sign back in with no SMS sent.

---

> **SUPERSEDED by v4.0.0** (Phase 10 / T150–T156): this phase's gate-popup + email/age-held-client-side + National-ID-at-apply model no longer applies. SOCIAL completes via the mandatory profile-completion step; apply is gated on `PROFILE_INCOMPLETE`.

## Phase 5: User Story 4 — SOCIAL sign-in + Complete-Profile + loan request (Priority: P1)

**Goal**: First-time user signs in via Google/Apple → lite Customer created with provider profile → browses catalog + matches → on Apply, mandatory gate popup → Complete-Profile screen (mobile + OTP saved immediately; email + age held client-side) → National ID upload → submit (email + age persisted atomically with application).

**Independent Test**: Tap "Continue with Google" → land on home with `requiresProfileCompletion=true` → tap Apply on offer → gate popup → CTA → enter mobile + OTP (verify customer.mobile + mobileVerifiedAt persisted IMMEDIATELY via DB query) → enter email + age → upload IDs → submit → verify customer.email + customer.age persisted with the application in one transaction.

### Tests for User Story 4

- [ ] T096 [P] [US4] Backend Jest e2e test for `/auth/profile/mobile-request-otp` + `/auth/profile/mobile-verify-otp` — verify customer.mobile + mobileVerifiedAt are committed immediately and mobile becomes immutable — `backend/test/e2e/auth-profile-complete.e2e-spec.ts`.
- [ ] T097 [P] [US4] Backend Jest e2e test for `/applications/apply` SOCIAL happy path — supplies `profileCompletion.email` + `profileCompletion.age`, verifies they're written atomically with the application — `backend/test/e2e/applications-apply-social.e2e-spec.ts`.
- [ ] T098 [P] [US4] Backend Jest e2e test for SOCIAL apply rollback: simulate document validation failure mid-transaction → confirm customer.email + customer.age reverted to null — `backend/test/e2e/applications-apply-social-rollback.e2e-spec.ts`.
- [ ] T099 [P] [US4] Backend Jest e2e test for mobile collision in `/auth/profile/mobile-verify-otp`: pre-seed another customer with the same mobile → confirm `MOBILE_ALREADY_REGISTERED` + caller's mobile stays null — `backend/test/e2e/auth-profile-mobile-collision.e2e-spec.ts`.
- [ ] T100 [P] [US4] Flutter cubit unit test `CompleteProfileCubit` — covers gate-popup CTA, OTP-saved-immediately invariant, email + age held client-side, submission flow — `mobile/test/features/customer_auth/presentation/cubits/complete_profile_cubit_test.dart`.
- [ ] T101 [P] [US4] Flutter widget test for gate popup (no dismiss / outside-tap-to-close ignored) — `mobile/test/features/customer_auth/presentation/widgets/gate_dialog_test.dart`.
- [ ] T102 [P] [US4] Flutter integration test for full SOCIAL flow: Google → home → Apply → gate → Complete-Profile → ID → submit — `mobile/integration_test/social_signin_apply_test.dart`.

### Implementation for User Story 4 — Backend

- [ ] T103 [US4] Implement `backend/src/auth/profile.controller.ts` `POST /api/v1/auth/profile/mobile-request-otp` + `POST /api/v1/auth/profile/mobile-verify-otp` with `@Auth(['hmac','customer'])`. Reject PHONE callers with HTTP 403.
- [ ] T104 [US4] Implement `auth.service.ts:requestProfileMobileOtp(customerId, mobile)` — pre-check mobile not collide via partial unique index simulate (read), call `customer-otp.service.issueOtp({ mobile, purpose: 'PROFILE_MOBILE', customerId })`.
- [ ] T105 [US4] Implement `auth.service.ts:verifyProfileMobileOtp(customerId, otpId, code)` — verify OTP, then `prisma.$transaction(tx => tx.customer.update({ where: { id: customerId }, data: { mobile, mobileVerifiedAt: now() } }))` catching P2002 → throw `MOBILE_ALREADY_REGISTERED`. Audit `customer.profile.mobile_bound`.
- [ ] T106 [US4] (depends on T064) Extend `apply.service.ts` (from T064) with SOCIAL branch: if `customer.registrationPath === 'SOCIAL'`, accept `payload.profileCompletion.email` (only if currently null) + `payload.profileCompletion.age` (write always, since SOCIAL.age is null until first apply). Within the same transaction call `tx.customer.update({ where, data: { email?, age } })`. Audit `customer.profile.email_set` (if upserted) + `customer.profile.age_set`.
- [ ] T107 [US4] Extend `apply.service.ts` to refuse SOCIAL customers with `customer.mobile === null` → return `PROFILE_INCOMPLETE` (mobile must be bound via T105 BEFORE submission).

### Implementation for User Story 4 — Mobile

- [ ] T108 [US4] Implement `mobile/lib/core/widgets/dialogs/masrafy_gate_dialog.dart` — a non-dismissible AlertDialog with single CTA, ignores barrierDismissible, ignores back button (via WillPopScope). Lives under `core/widgets/dialogs/` per Principle XXXIII naming (`MasrafyGateDialog`).
- [ ] T109 [US4] Implement `CompleteProfileCubit` + state in `mobile/lib/features/customer_auth/presentation/cubits/complete_profile_cubit.dart` — Freezed sealed: `idle`, `requestingOtp`, `otpSent`, `verifyingOtp`, `mobileBound`, `awaitingEmail`, `awaitingAge`, `readyForNationalId`, `failure`.
- [ ] T110 [US4] Implement Complete-Profile pages in `mobile/lib/features/customer_auth/presentation/pages/complete_profile/`: `mobile_page.dart`, `otp_page.dart`, `email_page.dart`, `age_page.dart`. Each page advances the cubit; the cubit auto-skips a step if the corresponding customer field is already non-null (per FR-009b + R6).
- [ ] T111 [US4] Wire the gate popup into the `apply` feature: in `mobile/lib/features/apply/presentation/pages/apply/apply_entry_handler.dart` (new), inspect `CustomerEntity.requiresProfileCompletion` — if true, show `MasrafyGateDialog`; on CTA tap, route to `CompleteProfileRoute`; on cancel, pop back to offers.
- [ ] T112 [US4] On Complete-Profile finished (`readyForNationalId`), route into the existing `apply` National-ID flow (T075). Email + age values are held in the apply cubit state and included in the `/applications/apply` payload (`profileCompletion`).
- [ ] T113 [US4] Implement Flutter mobile-collision handling in `complete_profile_cubit`: catch `MOBILE_ALREADY_REGISTERED` after OTP verify; surface inline error + "Log in to existing account" CTA that routes to `LoginRoute` with mobile pre-filled.

**Checkpoint**: SOCIAL customers can complete the full journey end-to-end.

---

## Phase 6: User Story 3 — Silent re-auth on app start (Priority: P2)

**Goal**: A user with a valid refresh token in secure storage reopens the app and lands on the authenticated home screen without seeing login.

**Independent Test**: After US1 or US4 success, force-quit + relaunch the app. Confirm: no landing screen, no login screen, home shown.

### Tests for User Story 3

- [ ] T114 [P] [US3] Flutter cubit/widget test for `auth_redirect_guard.dart` — covers (a) no refresh token → landing, (b) valid refresh → home, (c) expired/invalid → login — `mobile/test/core/routing/auth_redirect_guard_test.dart`.

### Implementation for User Story 3

- [ ] T115 [US3] Refine `mobile/lib/core/routing/auth_redirect_guard.dart` (scaffolded in T048): on app boot, read refresh token from secure storage; if absent → `LandingRoute`; if present → call `customer_auth_usecase.refresh` via `customer_jwt_interceptor` silent path; on success populate `access_token_holder` + navigate `AuthenticatedShellRoute`; on failure clear secure storage + navigate `LoginRoute`.
- [ ] T116 [US3] Wire startup observer in `mobile/lib/main_dev.dart` / `main_staging.dart` / `main_prod.dart` to trigger the guard before the first widget renders (avoid landing-flash).
- [ ] T117 [US3] Add Flutter golden test for the splash → home transition when refresh token is valid — `mobile/test/golden/silent_reauth_golden_test.dart`.

**Checkpoint**: Silent re-auth complete; existing users skip the landing screen.

---

## Phase 7: User Story 5 — Forgot password (Priority: P2)

**Goal**: PHONE customer taps "Forgot password?" → enters mobile → receives OTP → enters code → sets new password → signed in.

**Independent Test**: Sign up via PHONE → logout → tap "Forgot password?" → complete flow → confirm signed in + old password no longer works + all other refresh tokens revoked.

### Tests for User Story 5

- [ ] T118 [P] [US5] Backend Jest e2e test for the full forgot-password flow including reset-token TTL expiry + token-reuse rejection — `backend/test/e2e/auth-forgot-password.e2e-spec.ts`.
- [ ] T119 [P] [US5] Backend Jest e2e test confirming SOCIAL-customer forgot-password requests return the same generic outcome WITHOUT dispatching an SMS (no enumeration) — `backend/test/e2e/auth-forgot-password-social-noop.e2e-spec.ts`.
- [ ] T120 [P] [US5] Flutter cubit unit test `ForgotPasswordCubit` — `mobile/test/features/customer_auth/presentation/cubits/forgot_password_cubit_test.dart`.

### Implementation for User Story 5

- [ ] T121 [US5] Extend `customer-otp.service.ts.verifyOtp` to branch on `purpose=FORGOT_PASSWORD`: instead of returning a verifiedMobileToken, look up the customer by mobile → if PHONE customer exists, issue `PasswordResetToken` (bcrypt-hashed, 15-min TTL) → return `{ passwordResetToken }`; if no PHONE customer (mobile unknown OR mobile maps to SOCIAL) → return the SAME shape with a fake-but-syntactically-valid token (or 200 with empty data — implementation choice as long as no enumeration leak) and DO NOT send the SMS.
- [ ] T122 [US5] Implement `backend/src/auth/dto/password-reset.dto.ts` (`passwordResetToken`, `newPassword`) and `POST /api/v1/auth/password/reset` route.
- [ ] T123 [US5] Implement `auth.service.ts:resetPassword(token, newPassword)` — consume token in transaction, update `customer.passwordHash = bcrypt(newPassword, 12)`, revoke ALL refresh tokens for customer EXCEPT issue a new pair for the caller, audit `auth.password.reset` + `auth.tokens.revoked` (reason=password_reset).
- [ ] T124 [US5] Implement Flutter `mobile/lib/features/customer_auth/presentation/cubits/forgot_password_cubit.dart` + state.
- [ ] T125 [US5] Implement Flutter pages `mobile/lib/features/customer_auth/presentation/pages/forgot_password/mobile_page.dart` + `otp_page.dart` + `reset_page.dart` (new password + confirm).

**Checkpoint**: Forgot-password complete for PHONE customers; SOCIAL customers see no leak.

---

## Phase 8: User Story 6 — Authenticated password change (Priority: P3)

**Goal**: Signed-in PHONE customer can change their password from the account settings screen.

**Independent Test**: Sign in via PHONE → open password-change form → enter current + new + confirm → on success, sign out → sign back in with new password (old password fails).

### Tests for User Story 6

- [ ] T126 [P] [US6] Backend Jest e2e test `/auth/password/change` happy + wrong-current + same-as-old + SOCIAL-customer-forbidden — `backend/test/e2e/auth-password-change.e2e-spec.ts`.
- [ ] T127 [P] [US6] Flutter widget test for the change-password form — `mobile/test/features/customer_auth/presentation/pages/account/change_password_page_test.dart`.

### Implementation for User Story 6

- [ ] T128 [US6] Implement `backend/src/auth/dto/password-change.dto.ts` (`currentPassword`, `newPassword`).
- [ ] T129 [US6] Implement `auth.service.ts:changePassword(customerId, current, next)` — verify current via bcrypt compare; require PHONE customer (throw 403 if SOCIAL); reject `next === current` with `PASSWORD_SAME_AS_OLD`; update hash; revoke other refresh tokens + reissue for caller; audit `auth.password.change` + `auth.tokens.revoked` (reason=password_change).
- [ ] T130 [US6] Implement `POST /api/v1/auth/password/change` route in `auth.controller.ts` with `@Auth(['hmac','customer'])`.
- [ ] T131 [US6] Implement Flutter `mobile/lib/features/account/presentation/pages/change_password_page.dart` (new or extends existing account-settings feature). Typed reactive form. Only reachable for PHONE customers; SOCIAL customers see the option hidden.

**Checkpoint**: All six user stories independently functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting work that touches multiple stories.

- [ ] T132 [P] Add `/api/admin/customers/:id/presigned-read-url` admin endpoint with 1-hour TTL (per spec Q2) in `backend/src/admin/documents/admin-documents.controller.ts`. Admin JWT auth + `roles: ['support','underwriter','super_admin']`.
- [ ] T133 [P] Extend admin audit-log feature filters in `admin/src/app/features/audit-log/audit-log.component.ts` + service to support `eventTypes[]=auth.*` query (UI: multi-select chips).
- [ ] T134 [P] Add CI invariant SQL queries from `quickstart.md` §5 as nightly job in `backend/scripts/db-integrity-check.sql`. Failures alert ops.
- [ ] T135 [P] Add CI grep for PII in logs: `.github/workflows/ci.yml` step that scans recent backend log samples for unmasked mobile / OTP code / raw password.
- [ ] T136 [P] Add metric `otp.sms_sent` tagged by purpose with canary alarm on `purpose=login` to `backend/src/infra/metrics.service.ts` + datadog/prometheus dashboard.
- [ ] T137 [P] Add `audit.security.alarm` event filtering + admin notification (email/Slack via existing webhook) for `purpose=login` attempts.
- [ ] T138 [P] Update `CLAUDE.md` "Active Technologies" list — already updated by /speckit.plan run, verify only.
- [ ] T139 [P] Update `specs/008-mobile-auth-apply/quickstart.md` if any endpoint paths or env vars drifted during implementation.
- [ ] T140 Run `dart analyze` + fix any introduced lints in mobile feature (`mobile/lib/features/customer_auth/` + `mobile/lib/features/apply/`).
- [ ] T141 Run admin Angular `ng lint` + verify no `BehaviorSubject`-for-state regressions in extended customer-detail / list / audit-log code (A11).
- [ ] T142 Validate RTL on every new mobile screen: launch app in Arabic locale, screenshot every new screen, compare to LTR. Fix any leaked `EdgeInsets.left` / `Alignment.centerLeft` (A19).
- [ ] T143 Constitution gate re-validation: re-run mental check of every principle (I–XXXV) against the implemented code, document any regressions, file blocker tickets.
- [ ] T144 Run `quickstart.md` end-to-end smoke (PHONE + SOCIAL + login + forgot + change) and tick off every step as a manual acceptance pass.
- [x] T145 Constitution amendment landed: `.specify/memory/constitution.md` bumped to v1.8.0. Principle XIII rewritten to remove the 24-hour `mobileClientId` claim endpoint, codify the two-path registration model, and require Customer JWT on every reachable in-app feature. Sync impact report + Recent Changes + CLAUDE.md cross-references updated.
- [ ] T146 [P] Implement shared `backend/src/common/validators/password.validator.ts` — a `class-validator` `@IsStrongPassword({ min: 8, requireLetter: true, requireDigit: true })` constraint. Apply to `signup-phone-complete.dto.ts` (T058), `password-reset.dto.ts` (T122), `password-change.dto.ts` (T128). Add unit test `backend/test/unit/common/validators/password.validator.spec.ts` covering edge cases per FR-010. Closes /speckit.analyze finding U1.
- [ ] T147 [P] Author backend perf script `backend/perf/apply-submission.k6.js` asserting SC-007 (p95 < 3s on `/api/v1/applications/apply` under 50 RPS for 5 minutes). Wire into CI as a manual workflow (not blocking PRs but published as a dashboard). Closes /speckit.analyze finding C2 (SC-007 portion).
- [ ] T148 [P] Add mobile end-to-end timing assertions inside integration tests T057 + T083 + T102 + T114: assert PHONE-signup completion ≤ 90s (SC-001 PHONE), SOCIAL sign-in tap-to-home ≤ 15s (SC-001 SOCIAL), home-to-submit ≤ 4 min (SC-002), mobile+password login tap-to-home ≤ 15s (SC-003), silent-re-auth app-open-to-home ≤ 1.5s p95 (SC-010). Wraps existing tests; does not add new files. Closes /speckit.analyze finding C2 (SC-001 / SC-002 / SC-003 / SC-010 portion).
- [ ] T149 [P] Verify S3 bucket `S3_BUCKET_NAME` has default `ServerSideEncryption: AES256` via `aws s3api get-bucket-encryption --bucket "$S3_BUCKET_NAME"`. If not, apply via IaC (Terraform / CDK) — document the IaC change path in `backend/docs/s3-encryption.md`. Closes /speckit.analyze finding C3.

---

## Phase 10: Constitution v4.0.0 realignment — lite-row + mandatory profile completion

**Purpose**: Replace the "fully-upfront PHONE" + "SOCIAL loan-request popup" + "National-ID-at-apply" + "stored age" + guest plumbing model with the ratified v4.0.0 model: both paths create a LITE row, then a mandatory profile-completion step (photo + National ID + name + birthday; PHONE also password) finalizes the account. Apply/select-offer gated on `PROFILE_INCOMPLETE`.

- [x] T150 Migration `name`→`firstName`+`lastName`, `age`→`birthday` (DATE; age derived in code), add `profilePhotoKey`, add audit-only `nameSplitNeedsReview`, relax `passwordHash` nullable, drop guest columns (`Application.isGuest`, `mobileClientId` everywhere incl. refresh tokens + support). Reference migration `20260602120000_v4_customer_profile_and_guest_removal`. (DONE — backend.)
- [x] T151 Profile-completion endpoint `POST /v1/auth/profile/complete` (`firstName`, `lastName`, `birthday`, optional `password`; PHONE-required / SOCIAL-forbidden) + customer-scoped profile-photo (`/auth/profile/photo/upload-url`) and National ID (`/auth/profile/national-id/upload-url`) presign endpoints. National ID becomes two CUSTOMER-linked `Document` rows (`customerId` set, `applicationId` null). New error codes `PROFILE_ID_DOCS_MISSING`, `PASSWORD_REQUIRED_FOR_PHONE_PROFILE`, `PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE` added across the 3 surfaces. (DONE — backend.)
- [x] T152 `PROFILE_INCOMPLETE` gate guard on `POST /v1/applications/apply` and `/select-offer` (questionnaire submitted in apply body → gated too). Apply binds pre-existing customer National ID docs to the application; no apply-time `email`/`age`/`profileCompletion`/`isGuest`. (DONE — backend.)
- [x] T153 Remove guest plumbing: `Application.isGuest`, `mobileClientId` (everywhere), and the 24h claim flow. `Application` now has a required `applicantUserId`. Remove `CUSTOMER_GUEST_LINK_WINDOW_EXPIRED` error code. (DONE — backend.)
- [x] T154 Derive-age utility + 18–80 validation against `birthday` at profile completion (`AGE_INVALID` now raised here, not at apply). (DONE — backend.)
- [ ] T155 [mobile] Profile-completion screens replacing the apply-time gate popup + apply-time National ID pages: firstName/lastName, birthday picker (derived-age validation), profile-photo capture, National ID front/back — driven by the apply `PROFILE_INCOMPLETE` gate. Supersedes T073, T075, T110, T111, T112. (PENDING — mobile.)
- [x] T156 Constitution v4.0.0 sync: `.specify/memory/constitution.md` + `CLAUDE.md` updated to the lite-row + mandatory-profile-completion model. (DONE.)

> **SUPERSEDED by v4.0.0** (kept for history, do not re-implement as written):
> - T012 (schema added `age`, kept `name`/`fullName`) — superseded by T150 (`birthday`, `firstName`/`lastName`, `profilePhotoKey`, guest-column drop).
> - T032, T079 (entity / admin card with `age`, single `fullName`) — superseded by T150-aligned fields (`firstName`/`lastName`/`birthday`/`profilePhotoKey`/`profileComplete`).
> - T047 (`CompleteProfileRoute` sub: mobile/otp/email/age) — superseded by T155 (photo + National ID + name + birthday; no email/age steps).
> - T052, T058, T059, T060 (`/auth/signup/phone/complete` with `fullName`/`email`/`password`/`age`) — superseded by the LITE `/auth/signup/phone/verify` (T013-area) + T151 profile completion.
> - T063 apply DTO `profileCompletion?`, T106 SOCIAL apply branch writing `email`+`age`, T097/T098 SOCIAL-apply email/age tests — superseded by T152 gate (apply never mutates profile fields).
> - T073 profile page (fullName/email/password/age), T076 summary holding email/age, T110/T111/T112 gate-popup + Complete-Profile email/age screens — superseded by T155.
> - Phase 5 goal/independent-test (gate popup, email+age held client-side, National ID at apply) — superseded by the v4.0.0 model above.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: no dependencies; can start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1; BLOCKS all user stories.
- **Phase 3 (US1)**: depends on Phase 2.
- **Phase 4 (US2)**: depends on Phase 2; can run parallel with Phase 3 (different controllers, different cubits).
- **Phase 5 (US4)**: depends on Phase 2; shares the apply pipeline with Phase 3 (US1) — sequence Phase 3 → Phase 5 to avoid `apply.service.ts` conflicts, OR have a single dev own both.
- **Phase 6 (US3)**: depends on Phase 4 (US2) — relies on login flow existing; can also start after Phase 2 if guard development is mocked.
- **Phase 7 (US5)**: depends on Phase 4 (US2) for the login screen entry point; backend work can run parallel with Phase 4.
- **Phase 8 (US6)**: depends on Phase 4 (US2) for an authenticated session.
- **Phase 9 (Polish)**: depends on every user-story phase being complete.

### Within Each User Story

- Tests authored after the FR signatures are clear (no strict TDD; tests don't block per Principle XVI/XXVII v1.2.0).
- Repositories before services; services before controllers.
- Backend before mobile (mobile depends on contract shape).
- Admin extensions can run parallel with mobile of the same story.

### Parallel Opportunities

- Phase 1: T002–T010 all parallel (different files).
- Phase 2: T014–T020 (repository files), T031–T039 (mobile entities + models) all parallel.
- Phase 3–8: each story's backend Jest tests, mobile cubit tests, Flutter widget tests can run in parallel within the story.
- Across stories: US1 / US2 / US4 / US5 backend implementations are mostly file-independent — different controllers/DTOs — so they can be staffed in parallel after Phase 2.

---

## Parallel Example: User Story 1

```bash
# Backend tests (parallel):
T050 customer-otp.service.spec.ts
T051 customer-token.service.spec.ts
T052 auth-signup-phone.e2e-spec.ts
T053 applications-apply-phone.e2e-spec.ts

# Mobile tests (parallel):
T054 phone_signup_cubit_test.dart
T055 otp_page_test.dart
T056 phone_signup_golden_test.dart

# Backend implementation (sequential within service, parallel across services):
T058 + T059 + T060 + T061 + T062  → auth controller path
T063 + T064 + T065 + T066 + T067  → apply + documents + matching path (run parallel with auth path)

# Mobile implementation (parallel):
T068 PhoneSignupCubit
T069 imports library
T070 LandingPage
T071 PhoneSignupMobilePage
T072 OtpPage
T073 ProfilePage
T074 token persistence wire-up
T075 NationalIdPage (apply feature extension)
T076 SummaryPage
T077 SuccessPage

# Admin (parallel):
T078 customers list filter
T079 customers detail card extension (run promax before, impec after)
```

---

## Implementation Strategy

### MVP First (User Story 1 — PHONE happy path)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. STOP + VALIDATE: full PHONE signup → apply flow runs end-to-end against staging.
3. Deploy MVP to internal testers (TestFlight + Android internal track).

### Incremental delivery

1. Add US2 (returning login) → deploy.
2. Add US4 (SOCIAL) → deploy.
3. Add US3 (silent re-auth) → deploy.
4. Add US5 (forgot password) → deploy.
5. Add US6 (change password) → deploy.
6. Phase 9 polish → final cut.

### Parallel team strategy

With 2 backend + 2 mobile + 1 admin:

1. Whole team completes Setup + Foundational together (1 sprint).
2. After Foundational:
   - Backend Dev A: US1 backend + US5 backend.
   - Backend Dev B: US2 backend + US4 backend + US6 backend.
   - Mobile Dev A: US1 + US3 mobile.
   - Mobile Dev B: US2 + US4 mobile (the heaviest single phase) + US5 mobile + US6 mobile.
   - Admin Dev: US1 admin extensions + Phase 9 admin tasks.
3. Polish phase runs collectively post-integration.

---

## Notes

- [P] tasks = different files, no dependencies. Verify before running in parallel.
- Every error code lands in 3 places same PR (Principle XXIX + A22).
- The mobile `customer_auth` feature replaces the source-brief draft name `auth_apply`.
- The legacy anonymous `/api/v1/matching/preview` endpoint is REMOVED — confirm no callers remain after T066.
- Apple Sign-In on Android: button HIDDEN (R15). Web-flow deferred.
- (v4.0.0) `Customer.birthday` becomes immutable on first write (age derived in code, never stored); `Customer.mobile` + `mobileVerifiedAt` become immutable on first write (R8 + data-model.md write-authority matrix). The old `Customer.age` column is dropped (T150).
- Spec clarifications recap: Q1 (revoke other tokens on password change/reset) → T123 + T129; Q2 (admin doc URL 1h) → T132; Q3 (mobile_change deferred) → reserved enum only; Q4 (no guest mode + hybrid persistence) → enforced throughout; Q5 (multi-device sessions) → T021 + T123/T129.
- /speckit.analyze findings closed by this revision: A1 (T145 hardened blocker), C1 (T067a/T067b/T067c added), C2 (T147/T148 added), C3 (T149 added), C4 (T076/T077 augmented), U1 (T146 added), B1 (FR-018 quantified in spec), I1 (FR-005a wording aligned to "SOCIAL sign-in"), I2 (T106 depends-on annotated), D1 (plan.md glossary added), O1 (T067 enumeration extended), O2 (T022 resend lock explicit).
- Total tasks after remediation: 152 (was 145; added T067a, T067b, T067c, T146, T147, T148, T149).
