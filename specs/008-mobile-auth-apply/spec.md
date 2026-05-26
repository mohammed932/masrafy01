# Feature Specification: Mobile Authentication & Upfront Registration

**Feature Branch**: `008-mobile-auth-apply`
**Created**: 2026-05-26
**Status**: Draft
**Input**: User description: "Mobile Authentication & Two-Path Registration: no guest mode. Path A (phone signup) collects mobile + OTP + full name + email + password + age upfront — customer is fully populated, loan-request flow is just National ID. Path B (Google/Apple) creates a lite account at sign-in with only the provider's name (and possibly email); at loan-request time a MANDATORY profile-completion popup asks for mobile + OTP + email + age before the user can proceed to National ID + submission. Returning users: phone-signup customers log in with mobile + password (no SMS); social customers re-sign-in via Google/Apple. Forgot-password OTP reset (phone-signup customers only)."

## Clarifications

### Session 2026-05-26

- Q: On password change and on forgot-password reset, what happens to existing refresh tokens? → A: Revoke all other refresh tokens; the device that performed the change/reset stays signed in with freshly issued tokens.
- Q: How long should an admin-facing presigned read URL for a National ID image stay valid? → A: 1 hour per generated URL, re-issued on demand for longer review sessions.
- Q: Is the "change my mobile number" user flow in scope for this feature? → A: Out of scope. The `mobile_change` OTP purpose is reserved in the API so a future iteration can add the UI without a breaking change, but no user story, no UI, and no admin tooling for it ship in this feature.
- Q: When is registration collected — at "Apply" time (after guest exploration) or upfront before any in-app feature is usable? → A: Upfront — every customer must complete registration immediately. Catalog browsing, questionnaire, matched offers, and loan requests all require an authenticated session. There is no guest exploration mode in this product. (This decision overrides the source brief's "top-of-funnel guest exploration" premise.)
- Q: Which fields are collected at upfront registration vs. at loan request? → A: Two paths.
  - **Phone-signup path** collects mobile + OTP + full name + email + password (with confirm) + age UPFRONT. Customer record is created fully populated. Loan-request flow is just National ID front + back + summary.
  - **Social-signin path** (Google / Apple): on first sign-in the user authenticates with the provider only; a Customer record is created with provider-supplied full name (and email if provided), but `mobile`, `email` (if provider withheld it), and `age` may be null and no password is set. At loan-request time, a **MANDATORY gate popup** appears explaining that the profile must be completed before applying, with a single CTA "Complete Profile" (no skip / no dismiss). Tapping the CTA navigates to a full-screen **Complete-Profile** flow that collects mobile + OTP + email (if missing) + age (18–80) step-by-step. Only after the Complete-Profile flow finishes does the user proceed to National ID front + back + summary. The popup-collected fields are persisted to the customer (mobile + age immutable thereafter) atomically with the loan-application submission.
- Q: Are both registration paths available, or only one? → A: Both. The first screen offers "Sign Up with Phone" (Path A), "Continue with Google", and "Continue with Apple" (Path B), plus a "Log In" link for returning customers. There is no guest mode — no in-app feature is reachable without one of these paths completing.
- Q: How do social-signin customers handle login / password? → A: Social customers have no password. They re-sign-in via Google or Apple every time. `forgot-password` and `change-password` flows apply only to phone-signup customers. If a social customer later wants a password, that is a future "link password" feature out of this spec's scope.
- Q: When are popup-collected fields (mobile / email / age) persisted to the social customer's record — atomically with the loan submission, or incrementally as the user advances through the Complete-Profile screen? → A: Hybrid. Mobile + `mobileVerifiedAt` are persisted IMMEDIATELY on OTP success (so the user is NEVER asked to redo OTP after an abandon — directly satisfies the OTP-cost rule); mobile is immutable from that moment. Email and age are held client-side throughout the Complete-Profile flow and are written to the customer record ATOMICALLY with the loan-application submission. A submission failure rolls back the email + age writes alongside the application + documents.
- Q: Are concurrent sessions on multiple devices allowed for the same customer? → A: Yes — each device gets its own refresh token and they coexist freely. Password change and forgot-password reset still revoke all OTHER sessions (per the earlier clarification); routine login on a new device does NOT bump existing sessions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Phone-signup user registers fully upfront, then browses, matches, and requests a loan (Priority: P1)

A first-time user opens the Masrafy mobile app and taps "Sign Up with Phone". They enter their mobile number, receive an SMS OTP, enter the code, then enter their full name, email, password (with confirm), and age. The Customer record is created at this point — fully populated — and the user is authenticated (access + refresh tokens issued). They can browse the loan offers catalog, answer the loan questionnaire, see matched offers, and pick one. When they tap Apply on a matched offer, the loan-request flow asks them ONLY to upload National ID (front + back) and confirm. On submit, the loan application is created against the existing customer.

**Why this priority**: This is the primary direct customer journey — the cleanest path to a submitted loan application. Without P1 the product has no acquisition channel that doesn't depend on third-party providers.

**Independent Test**: Install fresh app. Tap "Sign Up with Phone". Complete the registration screens (mobile → OTP → name → email → password → age). Confirm the customer record exists, fully populated, and tokens are issued. Browse catalog. Answer questionnaire. View matched offers. Tap Apply on one. Upload both National ID sides. Submit. Confirm the application is created against the existing customer.

**Acceptance Scenarios**:

1. **Given** the user opens the app for the first time, **When** the landing screen completes, **Then** they see three CTAs ("Sign Up with Phone", "Continue with Google", "Continue with Apple") and a "Log In" link — there is no guest path to the catalog/questionnaire/matched-offers.
2. **Given** the user taps "Sign Up with Phone", **When** the registration screen opens, **Then** the mobile-entry step is shown.
3. **Given** the user enters a valid Egyptian mobile and taps "Send code", **When** the SMS gateway accepts the request, **Then** the OTP screen opens and the user receives a 6-digit code within the agreed SLA.
4. **Given** the user enters a valid OTP within 5 minutes, **When** they submit it, **Then** they advance to the profile screen (full name, email, password, confirm password, age) — the customer record is NOT yet created.
5. **Given** the user fills full name + email + password + confirm-password + age (18–80) correctly, **When** they confirm, **Then** the customer record is created FULLY populated (no null fields) and the user is authenticated.
6. **Given** the user submits an age outside 18–80 at registration, **When** they confirm, **Then** the submission is rejected with a clear Arabic error and no customer record is created.
7. **Given** the newly-registered phone-signup user lands on the authenticated home, **When** they navigate the loan questionnaire, **Then** their answers are persisted server-side against their customer record.
8. **Given** the phone-signup user has answered the questionnaire and selected an offer, **When** they tap Apply, **Then** the loan-request flow asks ONLY for National ID front + back photos and a final summary confirmation — NO profile-completion popup is shown (their profile is already complete).
9. **Given** the user uploads both National ID sides and confirms, **When** they tap "Submit Application", **Then** the application, both documents, and the questionnaire-application link are persisted atomically against the existing customer; if any step fails the application + documents are rolled back but the customer record stays intact and the user can retry.

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

### User Story 4 - Social sign-in user (Google / Apple) — lite account, mandatory profile popup at loan request (Priority: P1)

A first-time user opens the Masrafy mobile app and taps "Continue with Google" (or "Continue with Apple"). The provider returns the user's identity (full name; email if the provider releases it). A LITE customer record is created immediately — only the social provider link, the provider name, and (when available) the provider email — with no mobile, no password, and no age. The user is signed in (access + refresh tokens issued) and lands on the authenticated home. They can browse catalog, answer questionnaire, see matched offers. When they tap Apply on a matched offer, a MANDATORY gate popup appears explaining that they must complete their profile to apply, with a single "Complete Profile" CTA. Tapping the CTA navigates them to a full-screen Complete-Profile flow that walks them through mobile + OTP + email (if not already set) + age (18–80). Once that flow finishes, they upload National ID front + back, confirm, and submit the loan application against the same customer record. The customer's mobile/email/age fields are persisted atomically with the application submission.

**Why this priority**: Same priority as P1 (phone signup). Social sign-in is the second of two registration paths; without it the social-button CTAs on the landing screen are non-functional.

**Independent Test**: Install fresh app. Tap "Continue with Google" on the landing screen. Complete the provider sheet. Verify the customer record exists with name + (email or null) + null mobile + null age, and tokens are issued. Browse catalog. Answer questionnaire. View matched offers. Tap Apply. Verify the gate popup appears with a "Complete Profile" CTA and no dismiss / skip / outside-tap-to-close behaviour. Tap CTA → land on the Complete-Profile screen. Walk through mobile → OTP → email (if missing) → age. Then upload both National ID sides. Submit. Verify the customer now has mobile (OTP-verified), age (set, immutable), and email (set), and the loan application is created.

**Acceptance Scenarios**:

1. **Given** the user taps a social button on the landing screen, **When** the provider returns a valid identity token, **Then** a LITE customer record is created immediately with the provider's name (and email if provider released it), null mobile, null age, no password, a `CustomerProvider` link row, and access + refresh tokens are issued.
2. **Given** a lite social customer is signed in, **When** they navigate the app, **Then** catalog / questionnaire / matched offers are all reachable.
3. **Given** the lite social customer taps Apply on a matched offer, **When** the loan-request flow opens, **Then** a MANDATORY gate popup appears with text explaining the user must complete their profile to apply, and a single primary CTA labelled "Complete Profile" (the popup MUST NOT expose a skip / dismiss / cancel action and MUST ignore outside-tap-to-close). A secondary "Back" affordance is allowed only as a route back to the matched-offers screen (no partial state preserved).
4. **Given** the gate popup is showing, **When** the user taps "Complete Profile", **Then** the app navigates to a full-screen Complete-Profile flow that asks for the missing fields step-by-step in order: mobile + OTP (if mobile null) → email (if email null) → age. Already-set fields are skipped.
5. **Given** the user is in the Complete-Profile flow at the OTP step, **When** the OTP is verified successfully, **Then** the customer's `mobile` and `mobileVerifiedAt` are persisted IMMEDIATELY (mobile becomes immutable). Email and age are NOT yet written — they are held client-side as the user advances through the remaining steps.
6. **Given** the user is on the gate popup, **When** they back out of the loan-request flow without tapping "Complete Profile", **Then** the customer record is UNTOUCHED, no application is created, no SMS was dispatched, and the user returns to matched offers.
7. **Given** the user is inside the Complete-Profile flow and abandons AFTER OTP verification (mobile saved) but BEFORE submitting the loan, **When** they later tap Apply again, **Then** the gate popup re-appears (because email or age is still null); on tapping "Complete Profile", the OTP step MUST be skipped (mobile already set + verified → NO new SMS is sent) and the flow resumes at the first still-null field (email or age). Any client-side email/age the user had typed in the abandoned attempt is NOT retained — they must re-enter it.
8. **Given** a returning social user whose customer record is complete (mobile + email + age all set from a prior successful loan submission), **When** they tap the same social button at app open, **Then** they are signed in directly with no SMS sent and the gate popup does NOT appear on subsequent loan requests.
9. **Given** the user has finished the Complete-Profile flow and uploaded both National ID sides, **When** they tap "Submit Application", **Then** the email + age writes to the customer record, the application, both documents, and the questionnaire-application link are ALL persisted ATOMICALLY in one transaction. A failure rolls back the email + age writes alongside the application + documents + link; the previously-persisted mobile + `mobileVerifiedAt` are NOT touched on rollback (those were committed earlier).
10. **Given** the user signed in with Apple and chose to hide their email on the first attempt, **When** they sign in with Apple again, **Then** the system resolves them to the same customer using the persisted Apple user identifier and reuses any data captured before.
11. **Given** the Complete-Profile flow attempts to register a mobile number that already belongs to another customer (collision), **When** the user submits the OTP, **Then** the unique-constraint write fails, the system returns "mobile already registered" inline within the Complete-Profile screen, the SOCIAL customer's mobile remains null (no partial write), and the user is offered to log in to that existing account via phone+password instead.

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
- **Social customer cancels at the gate popup**: User is a SOCIAL customer with null mobile/age. They tap Apply, the gate popup appears, they back out of the entire apply flow without tapping "Complete Profile". The customer record stays untouched (mobile/age still null), no application is created, the user returns to matched offers and keeps full app access. On the next Apply tap, the same gate popup appears.
- **Social customer abandons inside Complete-Profile screen after OTP**: User taps "Complete Profile", lands on the full-screen flow, fills mobile + OTP, then backs out before completing email/age (or before final submission). The customer's mobile + `mobileVerifiedAt` ARE persisted (per FR-009d); email + age are NOT (they were held client-side and discarded on abandon). On next Apply tap, the gate popup re-appears (email and/or age still null); on tapping "Complete Profile", the OTP step is SKIPPED (no fresh SMS sent), and the flow resumes at the email step. This is intentional to satisfy the OTP-cost rule while keeping email + age scope-bound to a single committed apply transaction.
- **Reopen app after cancelling at any social-completion step**: Refresh token is valid, user is silently re-authenticated, lands on home. On their next Apply tap the gate popup re-appears.
- **Social customer mobile collision in Complete-Profile**: SOCIAL customer enters a mobile in the Complete-Profile screen that is already registered to a PHONE customer (or another SOCIAL customer). System returns "mobile already registered" inline within that screen; the SOCIAL customer's record is NOT modified; the UI prompts them to log in to the existing account via phone+password (or via the matching social provider if applicable) instead.
- **Apple email withheld**: First-time Apple sign-in provides email; subsequent sign-ins do not — the system still resolves the same customer because it persisted the email on first contact.
- **Locale switch mid-flow**: User toggles Arabic/English between screens → all messages, including server-returned error codes, render in the chosen locale.

## Requirements *(mandatory)*

### Functional Requirements

**Account invariants**

- **FR-001**: System MUST treat customer records as having one of two registration paths, recorded on the record as `registrationPath ∈ {PHONE, SOCIAL}`:
  - **PHONE customers** MUST carry: OTP-verified mobile, full name, email, password, age (18–80) — ALL required at the moment of creation. None of these fields may be null on a PHONE customer.
  - **SOCIAL customers** MUST carry: at least one `CustomerProvider` link (GOOGLE or APPLE) and a full name from the provider, at the moment of creation. Mobile, email, age may be null, and password is always null (social customers do not use a password).
- **FR-002**: System MUST refuse to submit a loan application whose customer has `mobile = null`, `email = null`, `age = null`, or `age` outside 18–80 (regardless of registration path). The customer record stays intact on rejection.
- **FR-002a**: For a SOCIAL customer, the loan-request profile-completion popup MUST collect any of the above missing fields (mobile + OTP if mobile is null; email if email is null; age in all cases when null); the popup MUST persist them to the customer atomically with the loan-application submission. Once mobile and age are set on the customer, they MUST be immutable.
- **FR-003**: System MUST treat the mobile number as the customer's primary unique identifier across BOTH paths — no two customer records may share the same mobile. A mobile collision detected during a SOCIAL customer's loan-request popup MUST surface a "mobile already registered" error and the existing account MUST NOT be silently merged.

**Authentication gate (no guest mode)**

- **FR-004**: System MUST require every user to authenticate via one of three paths before any of the following features are reachable: catalog browsing, loan questionnaire, matched offers, loan request, account/profile screens. The three paths are: (a) phone-signup (NEW PHONE customer), (b) social sign-in (Google / Apple — NEW or RETURNING SOCIAL customer), (c) phone+password login (RETURNING PHONE customer). There is NO guest mode.
- **FR-005**: The PHONE signup flow MUST collect fields in this order: mobile number → OTP code → full name → email → password (with confirm) → age. The PHONE customer record MUST be created exactly when all of these are saved successfully — never before, never later, and fully populated.
- **FR-005a**: The SOCIAL sign-in flow MUST create the SOCIAL customer record immediately upon successful provider-token verification, populated from the provider payload (full name; email if released) and with a `CustomerProvider` link. No SMS is sent on social sign-in; mobile, age, and (sometimes) email remain null until the first loan-request popup completes.
- **FR-006**: Backend endpoints serving catalog, questionnaire, matching, and loan-request features MUST reject unauthenticated requests; the mobile app MUST gate all corresponding UI behind a valid session.
- **FR-007**: Once the customer record exists, the user's questionnaire answers MUST be persisted server-side against that customer, not in local-only device storage; the user MUST be able to start the questionnaire on one device, log in on another, and resume their answers.

**Loan-request flow (post-registration)**

- **FR-008**: Tapping "Apply" on a matched offer MUST open a modal flow that cannot be left except via explicit cancel.
- **FR-009**: The loan-request flow MUST branch by which of the customer's required fields are missing:
  - **PHONE customers** (always complete): straight to National ID front photo → National ID back photo → summary confirmation. NO gate popup, NO Complete-Profile screen.
  - **SOCIAL customers** missing any of {mobile, email, age}: a MANDATORY gate popup MUST appear first containing explanatory text and a single primary CTA "Complete Profile". Tapping the CTA MUST navigate to a full-screen Complete-Profile flow that asks for only the missing subset, in this order: mobile + OTP (if mobile null) → email (if email null) → age. After the Complete-Profile flow finishes, the loan-request flow advances to National ID front → back → summary.
- **FR-009a**: The gate popup MUST NOT expose a "skip" / "dismiss" / "later" affordance, MUST ignore outside-tap-to-close, and MUST NOT auto-dismiss on a timeout. The Complete-Profile screen and the gate popup share one cancel path: backing out of the entire loan-request flow (returning to matched offers); cancelling MUST leave the customer record UNTOUCHED (mobile/email/age stay null) and create no application or pending state.
- **FR-009b**: While a SOCIAL customer has any required field still null, EVERY subsequent loan-request attempt MUST re-show the gate popup. Once all required fields are set (via a successful loan submission), the gate popup MUST never appear again for that customer.
- **FR-009c**: A loan application MUST NOT be created (and the Complete-Profile flow MUST NOT advance to National ID) until the popup-collected data passes validation: mobile OTP-verified, email well-formed, age 18–80.
- **FR-009d**: Persistence of popup-collected fields is hybrid:
  - **Mobile + `mobileVerifiedAt`**: written to the customer record IMMEDIATELY on successful OTP verification, in its own transaction. Mobile becomes immutable from that moment. This guarantees that abandoning the flow after OTP verification does NOT cause a fresh OTP to be sent on the next attempt — directly satisfying the OTP-cost rule.
  - **Email and age**: held client-side as the user advances through the Complete-Profile flow; written to the customer record ATOMICALLY with the loan-application submission (FR-013). On submission failure, these writes roll back alongside the application + documents.
  The Complete-Profile flow MUST skip the mobile + OTP step if the customer's mobile is already set + verified. Email and age steps are always shown (until age is finally persisted via a successful submission); their previously-typed values are NOT retained across abandoned attempts.
- **FR-010**: Password fields (at registration, password reset, password change) MUST enforce minimum 8 characters, at least one letter and one digit, with a show/hide toggle and matching confirm-password.
- **FR-011**: The National ID step MUST require BOTH front and back uploads before allowing progression to the summary step.
- **FR-012**: Image uploads MUST display a shape-matched shimmer skeleton while in flight and per-side progress indicators.
- **FR-013**: Final submission MUST be a single atomic action that — succeed or fail — leaves NO partial application, document, or questionnaire-link record in the system. For PHONE customers the submission MUST NOT mutate the customer record. For SOCIAL customers the submission MUST atomically write `email` (if it was null) and `age` (always) alongside the application + documents + questionnaire-link; a failure rolls back ALL of these together (the customer's email + age stay null). Mobile + `mobileVerifiedAt` were already committed earlier (per FR-009d) and are NOT part of this transaction's rollback scope.
- **FR-014**: On successful submission, any client-side draft state for the selected offer MUST be cleared and the user MUST be routed to the application-status screen.
- **FR-015**: On failed submission, no draft state is lost on the client; the user can retry without re-uploading documents that were already accepted.

**OTP cost control**

- **FR-016**: System MUST send an SMS OTP ONLY for: PHONE-signup registration, SOCIAL customer's first loan-request profile-completion popup (mobile binding), forgot password (PHONE customers only), and mobile-number change. The `mobile_change` purpose is reserved in the API for a later iteration; this feature ships no user-facing or admin-facing flow that exercises it.
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

- **FR-027**: First-time social sign-in MUST create a LITE SOCIAL customer immediately upon provider-token verification, with no OTP and no mobile required at that moment. Mobile-verification is deferred to the first loan-request popup (per FR-009 / FR-009a).
- **FR-028**: Returning social customers MUST be identified by `(provider, providerUserId)` and signed in directly with no OTP, regardless of whether their mobile/age fields are still null.
- **FR-029**: Apple-specific: when the user hides their email on first sign-in, the system MUST persist the captured (or absent) email keyed to the Apple user identifier so subsequent sign-ins resolve to the same customer. If email is absent at sign-in, the loan-request popup will collect it (per FR-009).
- **FR-030**: Provider-supplied name MUST be written to the customer record at sign-in. If the provider also supplies email, it MUST be written too; otherwise the loan-request popup collects email. The customer MAY edit email in the loan-request popup (if it was provider-supplied, the popup pre-fills it as editable); mobile collected in the popup is immutable once OTP-verified.

**Session management**

- **FR-031**: System MUST issue an access token (short-lived) and a refresh token (long-lived) on every successful registration, login, password reset, and social login.
- **FR-032**: Refresh tokens MUST be stored hashed server-side, rotated on every use, and individually revocable.
- **FR-033**: Mobile app MUST keep the refresh token in secure device storage and the access token in memory only.
- **FR-034**: On app start with a valid refresh token, the user MUST be silently signed in.
- **FR-034a**: System MUST allow a customer to hold multiple concurrent sessions, one per device. A successful login on a new device MUST NOT revoke any existing refresh token. Password change and forgot-password reset are the only routine actions that revoke other sessions (per FR-026a); explicit per-session revocation by the customer (sign out / "sign out all other devices") is supported on top of that.

**Documents (loan-request time)**

- **FR-035**: System MUST issue presigned upload URLs only to authenticated customers (Customer JWT). Upload URLs MUST be scoped to the authenticated customer and tagged with the in-progress application identifier.
- **FR-036**: Document upload URLs MUST be short-lived (≤ 10 minutes) and bound to a specific document type (National ID front or back).
- **FR-037**: A given upload ID MUST be associable with at most one customer + application pair; reuse across customers MUST be rejected.
- **FR-038**: Stored document files MUST be server-side encrypted at rest and accessible only via short-lived presigned read URLs to authorized staff. Each admin-facing read URL MUST expire 1 hour after issuance; reviewers re-request a fresh URL for longer review sessions.

**Personal data & logging**

- **FR-039**: System MUST log mobile numbers in masked form only (e.g., `+20••••••7890`); never log raw OTP codes, raw passwords, or full mobile numbers.
- **FR-040**: System MUST record an audit event for every: OTP send, OTP verification, social link, password set/change, application submission, and login attempt — each carrying a correlation identifier.

**Localization & error presentation**

- **FR-041**: System MUST surface every user-visible error in Arabic (primary) and English (secondary) — never raw codes or English fallback text on screens.
- **FR-042**: System MUST keep client-side error copy and server-side error codes synchronized in the same change set; partial updates (server adds a code with no client copy) MUST NOT ship.

**Administrative visibility**

- **FR-043**: Admin dashboard MUST display, per customer: `registrationPath` (PHONE / SOCIAL), mobile-verified timestamp (or "not yet verified" for incomplete SOCIAL customers), age (or "not yet collected"), email (or "not yet collected"), linked social providers, whether a password is set, and the latest OTP challenge statuses.
- **FR-044**: Admin customer list MUST allow filtering by "has applications".
- **FR-045**: Admin audit log MUST filter by auth event types (OTP, social link, password change, apply submission).

### Key Entities *(include if feature involves data)*

- **Customer**: A registered user. Carries a `registrationPath` tag of `PHONE` or `SOCIAL`. Always carries a full name.
  - **PHONE** customers have: OTP-verified mobile, email, password, age (18–80), all set at signup and (mobile/age) immutable thereafter.
  - **SOCIAL** customers have: at least one `CustomerProvider` link, no password. Mobile / email / age may be null at creation; they are populated (and made immutable) atomically with the first successful loan submission via the loan-request profile-completion popup.
  Linked to zero or more applications, documents, optional social providers, questionnaire answers, and (for PHONE customers) password-reset history.
- **Social Provider Link**: A record connecting a customer to an external identity provider (Google or Apple) by provider-issued user identifier. One customer may link multiple providers; a given provider+identifier pair may map to exactly one customer.
- **OTP Challenge**: A short-lived, hashed one-time code issued for a specific mobile and a specific purpose (signup, social-link, forgot-password, or mobile-change), with attempt counter and expiry. Never reused.
- **Verified-Mobile Token**: A short-lived, single-use proof that a given mobile has been OTP-verified recently. Consumed by the registration profile-save step (where the customer record is created). Held only in client memory (never on disk).
- **Social Session**: A short-lived, single-use record of a verified social identity (Google or Apple) waiting to be linked to a customer (either an existing one — returning user — or one about to be created via OTP at upfront registration).
- **Password Reset Token**: A short-lived, single-use token issued after a successful forgot-password OTP, consumed by the password reset endpoint.
- **Questionnaire Answers**: Server-side persisted answers (employment, income, amount needed, priority factor, etc.) attached to the authenticated customer; survive across devices and sessions; updatable until linked to a submitted application.
- **Application**: A loan application created atomically against a pre-existing customer at loan-submit time. Carries the chosen bank program selection, a snapshot of the questionnaire answers at submit time, and links to the customer's National ID documents.
- **Document**: A National ID image (front or back) uploaded via presigned URL by an authenticated customer for a specific in-progress application. Encrypted at rest.
- **Audit Event**: An append-only record describing an auth-related action, its actor (customer or admin), the masked mobile if any, the correlation identifier, and the outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time PHONE-signup user can move from app open to a created, fully-populated, authenticated customer record (mobile → OTP → name → email → password → age) in 90 seconds or less on a representative Egyptian 4G connection. A first-time SOCIAL sign-in user lands on the authenticated home in 15 seconds or less from tapping the provider button.
- **SC-002**: An authenticated user can move from the authenticated home screen to "application submitted" success screen — including questionnaire, offer selection, and National ID upload — in 4 minutes or less.
- **SC-003**: Returning users complete login (mobile + password) in 15 seconds or less from tap to home screen.
- **SC-004**: 100% of customer records in production carry a full name and a `registrationPath` of `PHONE` or `SOCIAL`. 100% of PHONE customers carry verified mobile + email + password + age (18–80). 100% of SOCIAL customers carry at least one `CustomerProvider` link and no password. Measured continuously by a data-integrity check; any breach is treated as a blocker incident. Separately, 100% of SUBMITTED loan applications are associated with a customer whose mobile is OTP-verified and whose age is 18–80 at the moment of submission, regardless of registration path.
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
- **Two-path registration trade-off (acknowledged)**: PHONE signup is heavy upfront (six fields + OTP) but yields a complete customer + low loan-request friction. SOCIAL sign-in is light upfront (one tap) but defers a mandatory profile-completion popup to the first loan request. The choice is the user's; conversion through each path is measured separately.
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
