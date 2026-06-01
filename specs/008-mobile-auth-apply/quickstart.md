# Quickstart — Mobile Authentication & Two-Path Registration

**Feature**: 008-mobile-auth-apply
**Audience**: backend, mobile, and admin engineers picking up this feature.

This document is a smoke-run. It assumes the repo already builds (`backend`, `admin`, `mobile`). It does NOT cover production deployment — see `specs/008-mobile-auth-apply/plan.md` for the full plan and `data-model.md` for schema details.

---

## 0. Prerequisites

```bash
# Infra (Postgres + Redis)
docker compose -f docker/compose.dev.yml up -d postgres redis

# Backend env additions (add to backend/.env or docker-compose.dev.yml):
#   CUSTOMER_JWT_ACCESS_SECRET=<32-byte hex>
#   CUSTOMER_JWT_REFRESH_SECRET=<32-byte hex>          # MUST differ from access secret
#   ADMIN_JWT_ACCESS_SECRET=<existing>
#   GOOGLE_OAUTH_CLIENT_IDS=<ios-client-id>,<android-client-id>
#   APPLE_BUNDLE_ID=<your.bundle.id>
#   SMS_GATEWAY_PROVIDER=mock                          # 'mock' for dev: logs OTP to console
#   SMS_GATEWAY_FROM=+201000000000
#   S3_BUCKET_NAME=masrafy-dev-documents
#   AWS_REGION=eu-central-1
#   ADMIN_DOCUMENT_PRESIGNED_READ_TTL_SECONDS=3600     # 1 hour, per Q2
```

---

## 1. Apply Prisma migration

```bash
cd backend
npx prisma migrate dev --name 008_mobile_auth_two_path_registration
npx prisma generate
```

If existing Customer rows are present in dev DB:

- The migration backfills `registrationPath = 'PHONE'` on existing rows.
- `passwordHash` was previously NOT NULL; the migration makes it NULL-able. No data loss.
- (v4.0.0) `name` is split into `firstName` + `lastName` (split rows flagged `nameSplitNeedsReview = true`); `age` is dropped in favor of `birthday DATE` (age derived in code); `profilePhotoKey` added; guest columns (`Application.isGuest`, `mobileClientId`) dropped. Profile-completeness is enforced at WRITE time going forward.

---

## 2. Backend smoke

```bash
cd backend
npm install
npm run start:dev   # http://localhost:3000

# 2a. PHONE-signup happy path
curl -X POST http://localhost:3000/api/v1/auth/signup/phone/start \
  -H 'Content-Type: application/json' \
  -H 'X-App-Signature: <hmac>' -H 'X-Timestamp: <ts>' -H 'X-Nonce: <nonce>' \
  -d '{ "mobile": "+201234567890", "locale": "ar" }'
# → 200, otpId

# Read OTP code from console (mock provider) — say "654321"

curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{ "otpId": "otp_...", "code": "654321", "purpose": "SIGNUP" }'
# → 200, verifiedMobileToken

curl -X POST http://localhost:3000/api/v1/auth/signup/phone/verify \
  -H 'Content-Type: application/json' \
  -d '{ "verifiedMobileToken": "vmt_...", "locale": "ar" }'
# → 200, { accessToken, refreshToken, customer { registrationPath: "PHONE", profileComplete: false, ... } }

# Then complete the profile (upload photo + National ID via the presign endpoints first):
curl -X POST http://localhost:3000/api/v1/auth/profile/national-id/upload-url \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{ "documentType": "NATIONAL_ID_FRONT", "contentType": "image/jpeg" }'
# (repeat for NATIONAL_ID_BACK and /auth/profile/photo/upload-url; PUT the bytes to each presignedUrl)

curl -X POST http://localhost:3000/api/v1/auth/profile/complete \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{ "firstName": "محمد", "lastName": "فتحي", "birthday": "1992-03-14", "password": "Aa1aa1aa" }'
# → 200, customer { profileComplete: true } (password REQUIRED for PHONE; derived age validated 18–80)
```

```bash
# 2b. SOCIAL-signup (mock Google token) — for dev: stub the google-auth-library
# to accept any "dev-token" and return a fixed profile.
curl -X POST http://localhost:3000/api/v1/auth/social/google \
  -H 'Content-Type: application/json' \
  -d '{ "idToken": "dev-token" }'
# → 200, { newCustomer: { tokens, customer { registrationPath: "SOCIAL", mobile: null, birthday: null, profileComplete: false } } }

# 2c. SOCIAL profile-completion: mobile binding
curl -X POST http://localhost:3000/api/v1/auth/profile/mobile-request-otp \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{ "mobile": "+201234567891" }'
# → 200, otpId

curl -X POST http://localhost:3000/api/v1/auth/profile/mobile-verify-otp \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{ "otpId": "otp_...", "code": "<from console>" }'
# → 204, customer's mobile + mobileVerifiedAt now set; mobile immutable
```

```bash
# 2c-bis. SOCIAL profile completion (after binding mobile + uploading photo + National ID via presign):
curl -X POST http://localhost:3000/api/v1/auth/profile/complete \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{ "firstName": "سارة", "lastName": "علي", "birthday": "1996-07-02" }'
# → 200, customer { profileComplete: true } (NO password — forbidden for SOCIAL)

# 2d. Apply (gated on profile completeness; binds pre-existing customer National ID docs)
curl -X POST http://localhost:3000/api/v1/applications/apply \
  -H 'Authorization: Bearer <accessToken>' \
  -d '{
        "offerSelection": { "bankProgramId": "bp_...", "currency": "EGP", "tenorMonths": 60 },
        "questionnaire": { ... },
        "documents": { "nationalIdFrontUploadId": "doc_...", "nationalIdBackUploadId": "doc_..." }
      }'
# → 200, application created (PROFILE_INCOMPLETE if the profile was not finalized first)
```

```bash
# 2e. Login (PHONE returning user)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -d '{ "mobile": "+201234567890", "password": "Aa1aa1aa" }'
# → 200, tokens. NO SMS dispatched.

# Watch OTP gateway log: verify `otp.sms_sent` metric NOT emitted with purpose=login.
```

---

## 3. Mobile (Flutter) smoke

```bash
cd mobile
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter run --flavor dev -t lib/main_dev.dart
```

Smoke flow:

1. App opens → landing screen with three CTAs + Log In.
2. Tap "Sign Up with Phone" → mobile screen → enter +201234567890 → tap Send code.
3. Console (in dev) prints the OTP. Enter it → a LITE PHONE customer is created and tokens issued (refresh token persisted in `flutter_secure_storage` under `StorageKeys.customerRefreshToken`). Profile-completion flow opens: capture profile photo + National ID front/back, then fill firstName + lastName + birthday + password + confirm → `profileComplete = true` → home.
4. Kill app, relaunch → silent re-auth → home.
5. Sign out (gear menu → log out). Re-launch → landing.
6. Tap "Continue with Google" → mock provider (or dev test account) → home (lite customer; `requiresProfileCompletion = true`).
7. Browse catalog → answer questionnaire → matched offers → tap Apply → gate returns `PROFILE_INCOMPLETE` → app routes to the profile-completion flow.
8. Profile-completion flow: bind mobile + OTP (saved immediately) → capture profile photo + National ID front/back → fill firstName + lastName + birthday (no password for SOCIAL) → `profileComplete = true`. Tap Apply again → submit → application created (binds the pre-existing National ID docs).
9. Open the app's settings → confirm "Mobile: +20•••••• ••91" displayed.

---

## 4. Admin (Angular) smoke

```bash
cd admin
npm install
npm start   # http://localhost:5173
```

Smoke checks:

1. Log in as super_admin.
2. Customers list → filter "Has applications: yes" → see only the test customer who just applied.
3. Click into the customer → detail page shows `registrationPath: SOCIAL`, `mobileVerifiedAt`, `firstName`/`lastName`, `birthday` (+ derived age), profile-photo presence, `email`, `profileComplete`, `linkedProviders: [GOOGLE]`, `hasPassword: false`, latest OTP challenges list.
4. Documents → click a National ID thumbnail → opens with a fresh 1-hour-TTL presigned read URL.
5. Audit Log → filter `auth.signup.social.completed` + `customer.profile.mobile_bound` + `customer.profile.completed` → see today's events.

---

## 5. CI invariants to add

Before merging this feature's PR, ensure CI runs:

- **PII grep**: `! grep -E 'X-App-Signature.*[0-9]{10}|OTP code [0-9]{6}|raw password' backend/logs/*.log`
- **OTP `purpose=login` canary**: integration test that `POST /auth/otp/request` with `purpose: "login"` returns 400 and emits the alarm metric.
- **Customer invariants check** (Postgres query, run nightly; table `CustomerAccount`, mobile column `phone`): `SELECT count(*) FROM "CustomerAccount" WHERE registrationPath='SOCIAL' AND "passwordHash" IS NOT NULL;` MUST return 0. (PHONE customers may legitimately be LITE/incomplete; completeness is enforced at the apply gate, not as a row invariant.)
- **Submitted-application invariant**: every submitted application must have a profile-complete customer with a verified mobile and a birthday yielding age 18–80: `SELECT count(*) FROM "Application" a JOIN "CustomerAccount" c ON c.id=a."applicantUserId" WHERE c.phone IS NULL OR c."mobileVerifiedAt" IS NULL OR c.birthday IS NULL OR c.birthday > (CURRENT_DATE - INTERVAL '18 years') OR c.birthday < (CURRENT_DATE - INTERVAL '80 years') OR c."firstName" IS NULL OR c."lastName" IS NULL OR c."profilePhotoKey" IS NULL;` MUST return 0.
- **Mobile-uniqueness invariant**: `SELECT phone, count(*) FROM "CustomerAccount" WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1;` MUST return 0 rows.

---

## 6. Common gotchas

- **Apple Sign-In on Android**: button hidden, NOT greyed. Verify the landing screen on Android shows only Phone + Google + Log In.
- **Mobile becomes immutable after first write**: any attempt to change it post-write throws `IMMUTABLE_FIELD_VIOLATION`. The change-mobile flow is OUT OF SCOPE in this feature (Q3).
- **Provider-supplied email**: if Apple/Google released an email at sign-in, the customer's email is already non-null. Email is NOT part of the v4.0.0 profile-completeness contract; confirm completeness by hitting `/auth/me` → `requiresProfileCompletion` reflects firstName/lastName/birthday/profilePhotoKey/verified-mobile/National-ID front+back (PHONE also passwordHash).
- **bcrypt cost difference**: OTP hash uses cost 10, password uses cost 12. Do not collapse them — OTP at cost 12 would slow OTP verify under load.

---

## 7. Where to go next

- `/speckit.tasks` → generates `tasks.md` from this plan.
- After tasks: `/speckit.analyze` for cross-artifact consistency.
- Then `/speckit.implement` to start execution.
