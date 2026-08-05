# Feature Specification: Mobile Authentication & Two-Path Lite Registration + Profile Completion

**Feature Branch**: `008-mobile-auth-apply`
**Created**: 2026-05-26
**Status**: Draft
**Input**: User description: "Mobile Authentication & Two-Path Registration: no guest mode. Path A (phone signup) collects mobile + OTP + full name + email + password + age upfront — customer is fully populated, loan-request flow is just National ID. Path B (Google/Apple) creates a lite account at sign-in with only the provider's name (and possibly email); at loan-request time a MANDATORY profile-completion popup asks for mobile + OTP + email + age before the user can proceed to National ID + submission. Returning users: phone-signup customers log in with mobile + password (no SMS); social customers re-sign-in via Google/Apple. Forgot-password OTP reset (phone-signup customers only)."

> **Superseded in part — constitution v11.0.0 (2026-08-04):** Apple sign-in is
> removed platform-wide. Google is the only social provider. Every mention of
> Apple below (the "Continue with Apple" CTA, `/auth/social/apple`,
> `/auth/apple/login`, the Apple ID-token verifier, `APPLE_BUNDLE_ID`,
> `sign_in_with_apple`, and the `APPLE` enum value) is historical and no longer
> exists in the code. Applicant `age` is likewise no longer sent by any client —
> it is derived from `birthday` server-side (A31, extended v11.0.0).

## Clarifications

> **v4.0.0 model (supersedes the 2026-05-26 clarifications below where they conflict)**: BOTH registration paths (PHONE and SOCIAL) create a LITE customer row at OTP/provider time, then a MANDATORY profile-completion step finalizes the account. There is NO "fully upfront" PHONE registration and NO loan-request "popup". Profile completion uploads the profile photo + National ID front/back FIRST (customer-scoped presign endpoints), then `POST /v1/auth/profile/complete` writes `firstName`, `lastName`, `birthday` (age ALWAYS derived from `birthday`, never stored), and — PHONE only — `password`. National ID is collected at PROFILE COMPLETION (two customer-linked `Document` rows), not at apply. Apply and select-offer are GATED on profile completeness (`PROFILE_INCOMPLETE`). No guest mode; `Application.isGuest`, `mobileClientId`, and the claim flow are REMOVED from code. Where older text below says `fullName`, stored `age`, "upfront", "popup", or "National ID at apply", read it through this v4.0.0 model.

### Session 2026-05-26

- Q: On password change and on forgot-password reset, what happens to existing refresh tokens? → A: Revoke all other refresh tokens; the device that performed the change/reset stays signed in with freshly issued tokens.
- Q: How long should an admin-facing presigned read URL for a National ID image stay valid? → A: 1 hour per generated URL, re-issued on demand for longer review sessions.
- Q: Is the "change my mobile number" user flow in scope for this feature? → A: Out of scope. The `mobile_change` OTP purpose is reserved in the API so a future iteration can add the UI without a breaking change, but no user story, no UI, and no admin tooling for it ship in this feature.
- Q: When is registration collected — at "Apply" time (after guest exploration) or upfront before any in-app feature is usable? → A: Upfront — every customer must complete registration immediately. Catalog browsing, questionnaire, matched offers, and loan requests all require an authenticated session. There is no guest exploration mode in this product. (This decision overrides the source brief's "top-of-funnel guest exploration" premise.)
- Q: Which fields are collected at registration vs. at profile completion? → A (v4.0.0): Both paths create a LITE row, then a mandatory profile-completion step finalizes it.
  - **Phone-signup path**: mobile + OTP creates a LITE PHONE customer (tokens issued). The mandatory profile-completion step then uploads profile photo + National ID front/back and writes `firstName`, `lastName`, `birthday`, and `password`. Age is derived from `birthday` and validated 18–80.
  - **Social-signin path** (Google / Apple): first sign-in creates a LITE customer from the provider payload (name, email if released), tokens issued, no mobile / birthday / photo / National ID yet. The mandatory profile-completion step binds mobile (OTP), uploads profile photo + National ID front/back, and writes `firstName`, `lastName`, `birthday` (no password — forbidden for SOCIAL). There is NO loan-request popup; completeness is enforced by the apply/select-offer gate (`PROFILE_INCOMPLETE`).
- Q: Are both registration paths available, or only one? → A: Both. The first screen offers "Sign Up with Phone" (Path A), "Continue with Google", and "Continue with Apple" (Path B), plus a "Log In" link for returning customers. There is no guest mode — no in-app feature is reachable without one of these paths completing.
- Q: How do social-signin customers handle login / password? → A: Social customers have no password. They re-sign-in via Google or Apple every time. `forgot-password` and `change-password` flows apply only to phone-signup customers. If a social customer later wants a password, that is a future "link password" feature out of this spec's scope.
- Q: When are profile-completion fields persisted? → A (v4.0.0): Incrementally, BEFORE apply — not at loan submission. Mobile + `mobileVerifiedAt` (SOCIAL) are persisted IMMEDIATELY on OTP success (immutable thereafter, satisfies the OTP-cost rule). Profile photo and the two National ID images are uploaded as customer-scoped Documents during profile completion. `firstName`, `lastName`, `birthday` (and PHONE `password`) are written by `POST /v1/auth/profile/complete`. `birthday` is immutable after first write; age is derived from it. The apply transaction does NOT mutate customer profile fields — it only binds the pre-existing National ID Documents to the application.
- Q: Are concurrent sessions on multiple devices allowed for the same customer? → A: Yes — each device gets its own refresh token and they coexist freely. Password change and forgot-password reset still revoke all OTHER sessions (per the earlier clarification); routine login on a new device does NOT bump existing sessions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phone-signup user creates a lite account, completes their profile, then browses, matches, and requests a loan (Priority: P1)

A first-time user opens the Masrafy mobile app and taps "Sign Up with Phone". They enter their mobile number, receive an SMS OTP, and enter the code — a LITE PHONE customer is created and the user is authenticated (access + refresh tokens issued). Before applying, they complete the mandatory profile-completion step: capture a profile photo and upload National ID front + back, then enter first name, last name, birthday (age derived, 18–80), and password. The profile is now COMPLETE. They can browse the catalog, answer the questionnaire, see matched offers, and pick one. When they tap Apply, the apply gate passes (profile complete); the submission binds their pre-existing National ID documents to the new application.

**Why this priority**: This is the primary direct customer journey — the cleanest path to a submitted loan application. Without P1 the product has no acquisition channel that doesn't depend on third-party providers.

**Independent Test**: Install fresh app. Tap "Sign Up with Phone". Complete mobile → OTP. Confirm a LITE customer exists (mobile only) and tokens are issued. Run profile completion: upload profile photo + National ID front/back, then submit first name, last name, birthday, password. Confirm the profile is complete. Browse catalog. Answer questionnaire. View matched offers. Tap Apply on one. Submit. Confirm the application is created against the existing customer and binds the pre-existing National ID documents.

**Acceptance Scenarios**:

1. **Given** the user opens the app for the first time, **When** the landing screen completes, **Then** they see three CTAs ("Sign Up with Phone", "Continue with Google", "Continue with Apple") and a "Log In" link — there is no guest path to the catalog/questionnaire/matched-offers.
2. **Given** the user taps "Sign Up with Phone", **When** the registration screen opens, **Then** the mobile-entry step is shown.
3. **Given** the user enters a valid Egyptian mobile and taps "Send code", **When** the SMS gateway accepts the request, **Then** the OTP screen opens and the user receives a 6-digit code within the agreed SLA.
4. **Given** the user enters a valid OTP within 5 minutes, **When** they submit it, **Then** a LITE PHONE customer is created (mobile + mobileVerifiedAt only) and tokens are issued — firstName/lastName/birthday/password are NOT yet set.
5. **Given** the user is in profile completion, **When** they upload profile photo + National ID front/back and submit firstName + lastName + birthday (derived age 18–80) + password, **Then** the profile becomes COMPLETE.
6. **Given** the user submits a birthday whose derived age is outside 18–80, **When** they confirm profile completion, **Then** it is rejected (`AGE_INVALID`) with a clear Arabic error and the profile stays incomplete.
7. **Given** the newly-registered phone-signup user lands on the authenticated home, **When** they navigate the loan questionnaire, **Then** their answers are persisted server-side against their customer record.
8. **Given** a PHONE user whose profile is complete has selected an offer, **When** they tap Apply, **Then** the apply gate passes and the flow goes straight to questionnaire/offer submission — NO profile-completion gate is triggered (`PROFILE_INCOMPLETE` not returned).
9. **Given** the user confirms submission, **When** they tap "Submit Application", **Then** the application, the binding of the pre-existing National ID documents, and the questionnaire are persisted atomically against the existing customer; if any step fails it is rolled back but the customer record and its profile docs stay intact and the user can retry.

---

### User Story 2 - Returning user signs back in (phone + password, OR re-tap social button) (Priority: P1)

A user who has already signed up opens the app on a different device (or after their refresh token expired). They reach the landing screen:
- If they originally signed up via **Phone**, they tap "Log In" and enter mobile + password — signed in immediately with no SMS.
- If they originally signed up via **Google / Apple**, they tap "Continue with Google" / "Continue with Apple" again — the provider returns the same identity, the existing customer is resolved, signed in with no SMS.

**Why this priority**: Same priority as P1 because the product is unusable for repeat users without it. Every successful first-time user eventually needs this on day 2.

**Independent Test**: After completing P1 (or User Story 4) once on Device A, install the app on Device B (or clear app storage on Device A). Sign back in using whichever original path was used (phone+password or the same social provider). Verify successful login without any SMS being sent.

**Acceptance Scenarios**:

1. **Given** a phone-signup customer on the login screen, **When** they enter correct mobile + password, **Then** they are signed in and no SMS is dispatched.
2. **Given** a returning user, **When** they enter the wrong password, **Then** the same generic "credentials invalid" message is shown (no enumeration leak about whether the mobile exists).
3. **Given** a user has failed login 10 times within 15 minutes, **When** they try an 11th time, **Then** the account is temporarily locked for 30 minutes and a clear lockout message is shown in Arabic.
4. **Given** a social-signin customer (no password) attempts the phone+password login screen with their registered mobile, **When** they submit, **Then** the same generic "credentials invalid" message is shown (no enumeration). The user resolves this by tapping the original social provider button instead.
5. **Given** a returning social customer taps "Continue with Google" / "Continue with Apple", **When** the provider returns the same identity token, **Then** the existing customer is matched and tokens are issued without any SMS being sent.

---

### User Story 3 - User reopens the app while still authenticated (Priority: P2)

A user who registered earlier reopens the app within 30 days. They land directly on the authenticated home screen without seeing the login screen.

**Why this priority**: Quality-of-life that drives retention; not strictly required for the MVP loop to work, but the app feels broken without it.

**Independent Test**: After completing P1, force-quit the app and reopen it. Verify silent re-auth occurs and the home screen renders without showing the login or apply screens.

**Acceptance Scenarios**:

1. **Given** a valid refresh token exists in secure device storage, **When** the user opens the app, **Then** the session is silently restored and the home screen renders.
2. **Given** no refresh token exists, **When** the user opens the app, **Then** they are routed to the registration screen (new install) or to the login screen (after logout) — never to a guest catalog (there is none).
3. **Given** the refresh token is expired or rejected, **When** the app boots, **Then** the user is routed to the login screen.

---

### User Story 4 - Social sign-in user (Google / Apple) — lite account, mandatory profile completion before loan request (Priority: P1)

A first-time user opens the Masrafy mobile app and taps "Continue with Google" (or "Continue with Apple"). The provider returns the user's identity (name; email if the provider releases it). A LITE customer record is created immediately — the social provider link, the provider name (split into firstName/lastName), and (when available) the provider email — with no mobile, no password, no birthday, no photo, no National ID. The user is signed in (access + refresh tokens issued) and lands on the authenticated home. When they tap Apply, the apply gate returns `PROFILE_INCOMPLETE` and the app routes them to the mandatory profile-completion flow: bind mobile (OTP), upload profile photo + National ID front/back, then submit firstName, lastName, birthday (age derived, 18–80). No password (forbidden for SOCIAL). Once the profile is COMPLETE, Apply proceeds and the submission binds the pre-existing National ID documents.

**Why this priority**: Same priority as P1 (phone signup). Social sign-in is the second of two registration paths; without it the social-button CTAs on the landing screen are non-functional.

**Independent Test**: Install fresh app. Tap "Continue with Google". Complete the provider sheet. Verify a LITE customer exists with name + (email or null) + null mobile + null birthday + null photo, and tokens are issued. Tap Apply → verify `PROFILE_INCOMPLETE` and routing to profile completion. Bind mobile (OTP), upload profile photo + National ID front/back, submit firstName + lastName + birthday. Then tap Apply again and submit. Verify the customer now has mobile (OTP-verified), birthday (set, immutable), firstName/lastName, photo, and two National ID documents, and the loan application is created.

**Acceptance Scenarios**:

1. **Given** the user taps a social button on the landing screen, **When** the provider returns a valid identity token, **Then** a LITE customer record is created immediately with the provider's name (firstName/lastName) (and email if released), null mobile, null birthday, no password, a `CustomerProvider` link row, and access + refresh tokens are issued.
2. **Given** a lite social customer is signed in, **When** they navigate the app, **Then** catalog / questionnaire / matched offers are all reachable; apply/select-offer are gated until the profile is complete.
3. **Given** the lite social customer taps Apply, **When** the apply gate runs, **Then** it returns `PROFILE_INCOMPLETE` and the app routes the user to the mandatory profile-completion flow.
4. **Given** the user is in the profile-completion flow, **When** they proceed, **Then** they bind mobile (OTP, if mobile null) and upload profile photo + National ID front/back, then submit firstName, lastName, birthday. No password step (forbidden for SOCIAL).
5. **Given** the user is at the mobile-binding OTP step, **When** the OTP is verified successfully, **Then** the customer's `mobile` and `mobileVerifiedAt` are persisted IMMEDIATELY (mobile becomes immutable).
6. **Given** the user backs out of profile completion before finishing, **When** they leave, **Then** already-persisted fields (mobile, uploaded docs) stay intact, no application is created, and the apply gate still returns `PROFILE_INCOMPLETE` next time.
7. **Given** the user abandons profile completion AFTER mobile OTP verification but before finishing, **When** they resume later, **Then** the mobile-binding step is SKIPPED (mobile already set + verified → NO new SMS is sent) and the flow resumes at the first still-missing step.
8. **Given** a returning social user whose profile is COMPLETE, **When** they tap the same social button at app open, **Then** they are signed in directly with no SMS sent and Apply proceeds with no gate.
9. **Given** the user has a COMPLETE profile, **When** they tap "Submit Application", **Then** the application, the binding of the pre-existing National ID documents, and the questionnaire are persisted ATOMICALLY in one transaction. A failure rolls these back together; the customer's profile fields (committed earlier at profile completion) are NOT touched.
10. **Given** the user signed in with Apple and chose to hide their email on the first attempt, **When** they sign in with Apple again, **Then** the system resolves them to the same customer using the persisted Apple user identifier and reuses any data captured before.
11. **Given** the profile-completion mobile-binding step attempts a mobile number that already belongs to another customer (collision), **When** the user submits the OTP, **Then** the unique-constraint write fails, the system returns "mobile already registered" inline, the SOCIAL customer's mobile remains null (no partial write), and the user is offered to log in to that existing account via phone+password instead.

---

### User Story 5 - User forgets their password (Priority: P2)

A returning user taps "Forgot password?" on the login screen, enters their mobile, receives an OTP, enters the code, sets a new password, and is signed in — all in one continuous flow.

**Why this priority**: Without it, password failures lock users out permanently. Required for sustained use, but not for first-week launch viability.

**Independent Test**: From the login screen, tap "Forgot password?", enter a registered mobile, receive and enter the OTP, set a new password, confirm the new password, and verify the user is signed in on the home screen.

**Acceptance Scenarios**:

1. **Given** the user is on the login screen, **When** they tap "Forgot password?" and enter a registered mobile, **Then** an OTP is sent and the OTP entry screen opens.
2. **Given** the user enters a valid OTP within the time window, **When** they set a new password that meets the strength rules and confirm it, **Then** they are signed in immediately and their old password no longer works.
3. **Given** the user enters an unregistered mobile, **When** the system processes it, **Then** the generic flow continues without revealing whether the mobile is registered (to prevent enumeration).

---

### User Story 6 - Authenticated user changes their password (Priority: P3)

A signed-in user navigates to a password-change form, enters their current password and a new password (confirmed twice), and the change takes effect immediately.

**Why this priority**: Standard hygiene; can ship after launch.

**Independent Test**: Sign in, open the password-change form, enter the current password and a valid new password, confirm. Sign out, then sign back in using the new password.

**Acceptance Scenarios**:

1. **Given** a signed-in user submits the correct current password and a valid new password, **When** they confirm, **Then** the password is updated, all other refresh tokens for that customer are revoked, and the current device is reissued fresh tokens.
2. **Given** the new password is the same as the current one, **When** the user submits, **Then** an explicit error indicates the new password must differ.

---

### Edge Cases

- **App closed mid-registration (before profile saved)**: No customer record exists yet; on reopen the user is routed back to the registration mobile step and must redo OTP. Any partially typed profile fields are discarded.
- **App closed after registration but before loan submission**: The customer record exists and the user is authenticated on reopen (silent refresh). Any in-progress questionnaire answers are persisted server-side against the customer; the user resumes at the questionnaire/offers/National ID step they last reached.
- **Mobile number race during registration**: Another user registers the same mobile between the first user's OTP verification and their profile-save submission → the registration step returns a clear "mobile already registered" error and the user is routed to login.
- **Document upload reused**: A document upload ID generated for one customer is referenced in another customer's loan submission → submission is rejected.
- **Bank program changes**: The selected offer no longer matches the user's profile by the time they submit → the application is rejected with a clear "offer no longer available" message and the user is returned to matched offers.
- **OTP storms**: A user requests too many OTPs in a short window → further requests are blocked for a cooldown period with the wait time shown in the UI.
- **SMS gateway failure on registration**: OTP send appears to succeed but no SMS arrives within the SLA → the user sees an inline error with three options: resend (after 60-second lock), change mobile number, or switch to Google/Apple registration. The current registration session is preserved.
- **App uninstall before registration completes**: No customer record was ever created; the next install starts fresh from the registration screen.
- **Incomplete customer taps Apply**: A customer (PHONE or SOCIAL) whose profile is incomplete taps Apply. The apply gate returns `PROFILE_INCOMPLETE`; no application is created; the app routes the user to the profile-completion flow. They keep full read access to catalog/questionnaire/offers.
- **Customer abandons profile completion after mobile OTP**: SOCIAL customer binds mobile + OTP, then backs out before uploading docs / submitting name + birthday. The customer's mobile + `mobileVerifiedAt` ARE persisted (per FR-009d). On resume, the mobile-binding step is SKIPPED (no fresh SMS sent) and the flow resumes at the first still-missing step. This satisfies the OTP-cost rule.
- **Reopen app while profile incomplete**: Refresh token is valid, user is silently re-authenticated, lands on home. Apply still returns `PROFILE_INCOMPLETE` until the profile is complete.
- **Mobile collision during profile completion**: SOCIAL customer enters a mobile already registered to another customer. System returns "mobile already registered" inline; the SOCIAL customer's record is NOT modified; the UI prompts them to log in to the existing account via phone+password (or the matching social provider) instead.
- **Apple email withheld**: First-time Apple sign-in provides email; subsequent sign-ins do not — the system still resolves the same customer because it persisted the email on first contact.
- **Locale switch mid-flow**: User toggles Arabic/English between screens → all messages, including server-returned error codes, render in the chosen locale.

## Requirements *(mandatory)*

### Functional Requirements

**Account invariants**

- **FR-001**: System MUST treat customer records as having one of two registration paths, recorded on the record as `registrationPath ∈ {PHONE, SOCIAL}`. Both paths create a LITE row first, then a mandatory profile-completion step finalizes it. A COMPLETE profile (both paths) MUST carry: OTP-verified mobile, `firstName`, `lastName`, `birthday` (age derived, 18–80), `profilePhotoKey`, and two National ID `Document` rows (front + back). PHONE profiles additionally carry a `password`; SOCIAL profiles never have a password and MUST carry at least one `CustomerProvider` link.
- **FR-002**: System MUST refuse `POST /v1/applications/apply` and `/select-offer` for any customer whose profile is incomplete (any of: `firstName`, `lastName`, `birthday`, `profilePhotoKey`, verified mobile, National ID front+back missing; PHONE also `password`), returning error code `PROFILE_INCOMPLETE`. The customer record stays intact on rejection. Because the questionnaire is submitted inside the apply body, it is gated too. Age is validated 18–80 against the derived age at profile completion (`AGE_INVALID`).
- **FR-002a**: The mandatory profile-completion step (`POST /v1/auth/profile/complete`, both paths) finalizes the LITE row. National ID front/back + profile photo are uploaded FIRST via customer-scoped presign endpoints (else `PROFILE_ID_DOCS_MISSING`); the complete call then writes `firstName`, `lastName`, `birthday`. `password` is REQUIRED for PHONE (`PASSWORD_REQUIRED_FOR_PHONE_PROFILE`) and FORBIDDEN for SOCIAL (`PASSWORD_FORBIDDEN_FOR_SOCIAL_PROFILE`). Once `mobile` and `birthday` are set they MUST be immutable.
- **FR-003**: System MUST treat the mobile number as the customer's primary unique identifier across BOTH paths — no two customer records may share the same mobile. A mobile collision detected during a SOCIAL customer's mobile-binding step MUST surface a "mobile already registered" error and the existing account MUST NOT be silently merged.

**Authentication gate (no guest mode)**

- **FR-004**: System MUST require every user to authenticate via one of three paths before any of the following features are reachable: catalog browsing, loan questionnaire, matched offers, loan request, account/profile screens. The three paths are: (a) phone-signup (NEW PHONE customer), (b) social sign-in (Google / Apple — NEW or RETURNING SOCIAL customer), (c) phone+password login (RETURNING PHONE customer). There is NO guest mode. Guest plumbing is REMOVED from code: `Application.isGuest`, `mobileClientId` (everywhere, incl. refresh tokens + support), and the claim flow no longer exist. `Application` always has a required `applicantUserId` (the customer).
- **FR-005**: The PHONE signup flow MUST: (1) collect mobile → OTP, creating a LITE PHONE customer (tokens issued) via `POST /v1/auth/signup/phone/verify`; (2) run the mandatory profile-completion step — upload profile photo + National ID front/back, then `POST /v1/auth/profile/complete` writing `firstName`, `lastName`, `birthday`, `password`. The customer is COMPLETE only after step 2 succeeds.
- **FR-005a**: The SOCIAL sign-in flow MUST create the LITE SOCIAL customer immediately upon successful provider-token verification, populated from the provider payload (name → `firstName`/`lastName`; email if released) and with a `CustomerProvider` link. No SMS is sent on social sign-in. The mandatory profile-completion step then binds mobile (OTP), uploads profile photo + National ID front/back, and writes `firstName`, `lastName`, `birthday` (no password).
- **FR-005b**: A profile photo (`profilePhotoKey`) MUST be captured/uploaded during profile completion (both paths) via a customer-scoped presign endpoint; it is part of the completeness contract.
- **FR-006**: Backend endpoints serving catalog, questionnaire, matching, and loan-request features MUST reject unauthenticated requests; the mobile app MUST gate all corresponding UI behind a valid session.
- **FR-007**: Once the customer record exists, the user's questionnaire answers MUST be persisted server-side against that customer, not in local-only device storage; the user MUST be able to start the questionnaire on one device, log in on another, and resume their answers.

**Profile-completion step (v4.0.0, runs before any loan request)**

- **FR-008**: The loan-request entry (`POST /v1/applications/apply` / `/select-offer`) is GATED on profile completeness. There is NO in-app "Complete Profile" popup at apply time; an incomplete profile is rejected with `PROFILE_INCOMPLETE` and the mobile app routes the user to the mandatory profile-completion flow.
- **FR-009**: The profile-completion flow (both paths) MUST collect, in order: profile photo + National ID front/back uploads (customer-scoped presign) → `firstName` → `lastName` → `birthday` (age derived, 18–80) → (PHONE only) `password`. SOCIAL customers additionally bind mobile (OTP) before completion. After completion the apply flow proceeds straight to offer/questionnaire submission (which binds the pre-existing National ID Documents). PHONE and SOCIAL share the same completion flow except for mobile-binding (SOCIAL) and password (PHONE).
- **FR-009a**: The profile-completion flow MUST NOT be skippable while incomplete. Cancelling/backing out MUST leave already-persisted fields intact (mobile + `mobileVerifiedAt`, uploaded Documents, and any committed `firstName`/`lastName`/`birthday`) and create no application.
- **FR-009b**: While a customer's profile is incomplete, EVERY loan-request attempt MUST be rejected with `PROFILE_INCOMPLETE` and route to profile completion. Once the profile is COMPLETE, apply proceeds with no further gate.
- **FR-009c**: `POST /v1/auth/profile/complete` MUST validate before persisting: National ID front+back + profile photo already uploaded (`PROFILE_ID_DOCS_MISSING` otherwise), `firstName`/`lastName` non-empty, derived age 18–80 (`AGE_INVALID`), and the path-specific password rule (PHONE required / SOCIAL forbidden).
- **FR-009d**: Persistence is incremental and BEFORE apply: mobile + `mobileVerifiedAt` (SOCIAL) are written IMMEDIATELY on OTP success (immutable thereafter, satisfies the OTP-cost rule); profile photo + National ID images are uploaded as customer-scoped Documents; `firstName`, `lastName`, `birthday` (and PHONE `password`) are written by `POST /v1/auth/profile/complete`. `birthday` is immutable after first write. The apply transaction does NOT mutate customer profile fields.
- **FR-010**: Password fields (at profile completion for PHONE, password reset, password change) MUST enforce minimum 8 characters, at least one letter and one digit, with a show/hide toggle and matching confirm-password.
- **FR-011**: The National ID step (at profile completion) MUST require BOTH front and back uploads before allowing the profile-complete call to succeed.
- **FR-012**: Image uploads MUST display a shape-matched shimmer skeleton while in flight and per-side progress indicators.
- **FR-013**: Final loan submission MUST be a single atomic action that — succeed or fail — leaves NO partial application, document-binding, or questionnaire record in the system. The submission MUST NOT mutate customer profile fields (firstName/lastName/birthday/email/profilePhotoKey were all committed earlier at profile completion); it binds the pre-existing National ID Documents to the new application. A failure rolls back the application + document-binding + questionnaire together.
- **FR-014**: On successful submission, any client-side draft state for the selected offer MUST be cleared and the user MUST be routed to the application-status screen.
- **FR-015**: On failed submission, no draft state is lost on the client; the user can retry without re-uploading documents that were already accepted.

**OTP cost control**

- **FR-016**: System MUST send an SMS OTP ONLY for: PHONE-signup registration, SOCIAL customer's mobile-binding step during profile completion, forgot password (PHONE customers only), and mobile-number change. The `mobile_change` purpose is reserved in the API for a later iteration; this feature ships no user-facing or admin-facing flow that exercises it.
- **FR-017**: System MUST reject any request to send an OTP for the purpose of "login" and MUST emit an alert if such a request ever reaches the SMS gateway.
- **FR-018**: OTP codes MUST be 6 digits and expire within 5 minutes. Per-mobile limits: max 3 active (non-consumed, non-expired) codes within a 15-minute window; max 5 OTP requests per hour; max 20 OTP requests per day.
- **FR-019**: System MUST enforce a 60-second cooldown before allowing OTP resend on the same mobile.
- **FR-020**: OTP codes MUST be stored hashed at rest and MUST NOT appear in any log line.

**Returning user login**

- **FR-021**: Returning PHONE customers MUST be able to sign in with mobile + password without an SMS being dispatched. Returning SOCIAL customers MUST be able to sign in by re-tapping their original provider button (Google or Apple); the provider's identity verification replaces the password check. No SMS is sent on either return path.
- **FR-022**: System MUST lock an account for 30 minutes after 10 failed phone+password attempts within a 15-minute window. Social provider re-sign-in is not subject to this lockout (the provider enforces its own rate limiting).
- **FR-023**: System MUST return the same generic error for wrong password, unknown mobile, AND SOCIAL-customer-using-phone+password during login (no enumeration leak).

**Forgot / change password**

- **FR-024**: Forgot-password is supported ONLY for PHONE customers (those who have a password). It MUST use an OTP-verified short-lived reset token, single-use, with a TTL no longer than 15 minutes. Forgot-password requests for a mobile that maps to a SOCIAL customer MUST return the same generic outcome (no enumeration) without dispatching an OTP.
- **FR-025**: Successful password reset MUST sign the user in directly without an extra login step.
- **FR-026**: Authenticated password change MUST require the current password, and is available ONLY to PHONE customers. SOCIAL customers do not have a password and cannot reach the change-password screen.
- **FR-026a**: On every successful password change AND on every successful forgot-password reset (PHONE customers only), the system MUST revoke all of the customer's other active refresh tokens, while the device that performed the action MUST receive freshly issued tokens (stays signed in).

**Social sign-in**

- **FR-027**: First-time social sign-in MUST create a LITE SOCIAL customer immediately upon provider-token verification, with no OTP and no mobile required at that moment. Mobile-verification is deferred to the mandatory profile-completion step (per FR-009 / FR-009a).
- **FR-028**: Returning social customers MUST be identified by `(provider, providerUserId)` and signed in directly with no OTP, regardless of whether their profile is still incomplete.
- **FR-029**: Apple-specific: when the user hides their email on first sign-in, the system MUST persist the captured (or absent) email keyed to the Apple user identifier so subsequent sign-ins resolve to the same customer.
- **FR-030**: Provider-supplied name MUST be written to the customer record at sign-in (split into `firstName`/`lastName`). If the provider also supplies email, it MUST be written too. Mobile bound during profile completion is immutable once OTP-verified.

**Session management**

- **FR-031**: System MUST issue an access token (short-lived) and a refresh token (long-lived) on every successful registration, login, password reset, and social login.
- **FR-032**: Refresh tokens MUST be stored hashed server-side, rotated on every use, and individually revocable.
- **FR-033**: Mobile app MUST keep the refresh token in secure device storage and the access token in memory only.
- **FR-034**: On app start with a valid refresh token, the user MUST be silently signed in.
- **FR-034a**: System MUST allow a customer to hold multiple concurrent sessions, one per device. A successful login on a new device MUST NOT revoke any existing refresh token. Password change and forgot-password reset are the only routine actions that revoke other sessions (per FR-026a); explicit per-session revocation by the customer (sign out / "sign out all other devices") is supported on top of that.

**Documents (loan-request time)**

- **FR-035**: System MUST issue presigned upload URLs only to authenticated customers (Customer JWT). Upload URLs MUST be scoped to the authenticated customer and tagged with the in-progress application identifier.
- **FR-036**: Document upload URLs MUST be short-lived (≤ 10 minutes) and bound to a specific document type (National ID front/back or profile photo). National ID + profile-photo uploads are customer-scoped and happen at profile completion (pre-application).
- **FR-037**: A given upload ID MUST be associable with at most one customer + application pair; reuse across customers MUST be rejected.
- **FR-038**: Stored document files MUST be server-side encrypted at rest and accessible only via short-lived presigned read URLs to authorized staff. Each admin-facing read URL MUST expire 1 hour after issuance; reviewers re-request a fresh URL for longer review sessions.

**Personal data & logging**

- **FR-039**: System MUST log mobile numbers in masked form only (e.g., `+20••••••7890`); never log raw OTP codes, raw passwords, or full mobile numbers.
- **FR-040**: System MUST record an audit event for every: OTP send, OTP verification, social link, password set/change, application submission, and login attempt — each carrying a correlation identifier.

**Localization & error presentation**

- **FR-041**: System MUST surface every user-visible error in Arabic (primary) and English (secondary) — never raw codes or English fallback text on screens.
- **FR-042**: System MUST keep client-side error copy and server-side error codes synchronized in the same change set; partial updates (server adds a code with no client copy) MUST NOT ship.

**Administrative visibility**

- **FR-043**: Admin dashboard MUST display, per customer: `registrationPath` (PHONE / SOCIAL), mobile-verified timestamp (or "not yet verified"), firstName/lastName (or "not yet collected"), birthday with derived age (or "not yet collected"), profile-photo presence, email (or "not yet collected"), `profileComplete` status, linked social providers, whether a password is set, and the latest OTP challenge statuses.
- **FR-044**: Admin customer list MUST allow filtering by "has applications".
- **FR-045**: Admin audit log MUST filter by auth event types (OTP, social link, password change, apply submission).

### Key Entities *(include if feature involves data)*

- **Customer**: A registered user. Carries a `registrationPath` tag of `PHONE` or `SOCIAL`. A COMPLETE profile carries firstName + lastName.
  - **PHONE** customers: LITE row created at signup-verify (mobile only); profile completion sets `firstName`, `lastName`, `birthday` (age derived, 18–80), `profilePhotoKey`, `password`, and two National ID Documents. `mobile`/`birthday` immutable thereafter.
  - **SOCIAL** customers: LITE row created at provider verify (name → `firstName`/`lastName`, email if released), no password. Profile completion binds mobile (OTP), and sets `birthday`, `profilePhotoKey`, and two National ID Documents. `mobile`/`birthday` immutable once set.
  Stored as the `CustomerAccount` table (mobile column `phone`); `nameSplitNeedsReview` flags backfilled name splits. Linked to zero or more applications, documents, optional social providers, questionnaire answers, and (for PHONE customers) password-reset history.
- **Social Provider Link**: A record connecting a customer to an external identity provider (Google or Apple) by provider-issued user identifier. One customer may link multiple providers; a given provider+identifier pair may map to exactly one customer.
- **OTP Challenge**: A short-lived, hashed one-time code issued for a specific mobile and a specific purpose (signup, social-link, forgot-password, or mobile-change), with attempt counter and expiry. Never reused.
- **Verified-Mobile Token**: A short-lived, single-use proof that a given mobile has been OTP-verified recently. Consumed by `POST /v1/auth/signup/phone/verify` (where the LITE PHONE customer is created). Held only in client memory (never on disk).
- **Social Session**: A short-lived, single-use record of a verified social identity (Google or Apple) waiting to be linked to a customer (either an existing one — returning user — or a LITE row created at first sign-in).
- **Password Reset Token**: A short-lived, single-use token issued after a successful forgot-password OTP, consumed by the password reset endpoint.
- **Questionnaire Answers**: Server-side persisted answers (employment, income, amount needed, priority factor, etc.) attached to the authenticated customer; survive across devices and sessions; updatable until linked to a submitted application.
- **Application**: A loan application created atomically against a pre-existing, profile-complete customer (required `applicantUserId`) at loan-submit time. Carries the chosen bank program selection, a snapshot of the questionnaire answers at submit time, and binds the customer's pre-existing National ID Documents. (No `isGuest`.)
- **Document**: An image uploaded via presigned URL by an authenticated customer. National ID (front/back) and the profile photo are CUSTOMER-scoped (`customerId` set, `applicationId` null) and uploaded at profile completion; apply later binds the National ID docs to the application. Exactly one of `customerId` / `applicationId` is set. Encrypted at rest.
- **Audit Event**: An append-only record describing an auth-related action, its actor (customer or admin), the masked mobile if any, the correlation identifier, and the outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time PHONE-signup user can move from app open to an authenticated LITE customer (mobile → OTP) in 90 seconds or less on a representative Egyptian 4G connection. A first-time SOCIAL sign-in user lands on the authenticated home in 15 seconds or less from tapping the provider button. (Profile completion — photo + National ID + name + birthday — is a separate, gated step.)
- **SC-002**: An authenticated user can move from the authenticated home screen to "application submitted" success screen — including questionnaire, offer selection, and National ID upload — in 4 minutes or less.
- **SC-003**: Returning users complete login (mobile + password) in 15 seconds or less from tap to home screen.
- **SC-004**: 100% of customer records in production carry a `registrationPath` of `PHONE` or `SOCIAL`. 100% of COMPLETE profiles carry `firstName`, `lastName`, `birthday` (derived age 18–80), `profilePhotoKey`, verified mobile, and two National ID Documents; PHONE also a password, SOCIAL no password + ≥1 `CustomerProvider` link. Measured continuously by a data-integrity check; any breach is a blocker incident. Separately, 100% of SUBMITTED loan applications are associated with a profile-complete customer (mobile OTP-verified, derived age 18–80) at the moment of submission.
- **SC-005**: 0 SMS messages are dispatched with a "login" purpose; measured by gateway-side tagging and a canary alarm.
- **SC-006**: Average OTP sends per successful registered customer ≤ 1.05 — confirms users complete registration on the first OTP attempt most of the time.
- **SC-007**: 95% of loan-application submissions complete (success or clean rollback) within 3 seconds of the user tapping Submit.
- **SC-008**: 0 partially-created application records exist after any failed loan submission, verified by daily reconciliation of customers ↔ applications ↔ documents; the customer record always remains intact.
- **SC-009**: Returning social users sign in (Google or Apple, mobile already verified) without an SMS being dispatched — verified by gateway logs against the social-login event count.
- **SC-010**: 95% of returning sessions land on the authenticated home screen within 1.5 seconds of app open when a valid refresh token is present.
- **SC-011**: 100% of user-facing error messages in the registration / loan-request / login / forgot-password flows render in Arabic by default; an automated scan of UI strings detects 0 unlocalized server-error pass-throughs.
- **SC-012**: 0 raw mobile numbers, OTP codes, or passwords appear in production log files, verified by continuous automated log scanning of recent samples.

## Assumptions

- **No guest mode (acknowledged)**: This feature deliberately gates all in-app features behind authentication via one of three paths (phone signup, Google sign-in, Apple sign-in, plus phone+password login for returning PHONE customers). The source brief's "maximise top-of-funnel exploration" hypothesis is rejected; web-based unauthenticated catalog browsing (if it exists outside this app) is a separate concern.
- **Two-path registration trade-off (acknowledged)**: Both paths create a LITE row then require a mandatory profile-completion step (photo + National ID + name + birthday; PHONE also password, SOCIAL also mobile OTP). PHONE is heavier at sign-in (mobile + OTP); SOCIAL is one tap. The choice is the user's; conversion through each path is measured separately.
- **Social customers and password recovery**: SOCIAL customers do not have a password; account recovery for them is via their provider (Google/Apple), not via the forgot-password OTP flow. If a user loses access to their provider account, recovering their Masrafy data is out of scope for this spec.
- **SMS gateway**: An Egyptian SMS gateway is available and provisioned by operations before launch; per-message cost falls within the 0.10–0.30 EGP range that informed the OTP-cost rule.
- **SMS cost model**: Expected SMS spend is ~1 OTP per registered customer (first registration) plus occasional forgot-password resets. Total SMS spend scales with registered-user count, not session count, because login does not send SMS.
- **Apple Sign-In platform scope**: Apple Sign-In ships on iOS only for v1. Android support (via the web flow) is deferred to a later iteration.
- **National ID processing**: Documents are reviewed manually by admin staff for v1; no OCR or automated extraction is in scope. Phase 2 OCR is a separate spec.
- **Existing infrastructure**: The customer JWT framework, refresh-token store, audit event store, and S3-compatible document bucket from Phase 1 are available and reused; this feature does not redesign them.
- **Matching engine call site**: The existing matching engine is reused, but its mobile-app caller is now authenticated (Customer JWT) rather than anonymous; no behavior change to the engine itself.
- **Mobile-number format**: Egypt-only at launch; international format `+20…`. Other country codes are out of scope.
- **Mobile-number change**: Out of scope for this feature. The OTP purpose is reserved for a later iteration so the API contract stays stable; no UI, FR, or admin tooling for changing a customer's mobile ship here.
- **Locale defaults**: Arabic is the default UI locale; English is the secondary locale. RTL is the baseline layout direction.
- **Refresh-token lifetime**: 30 days for the customer-facing app, consistent with the customer JWT direction set at Phase 1.
- **OTP retention**: OTP challenge records are retained 30 days for audit, then purged.
- **Audit retention**: Auth audit events follow the existing platform retention policy from Phase 1 (no new policy in this feature).
- **Constitution alignment**: If the constitution still implies guest exploration anywhere, it is overridden by this feature's clarification (Q4 of Session 2026-05-26). A constitution amendment to remove guest-mode wording can be scheduled as a follow-up.
