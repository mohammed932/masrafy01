# Feature Specification: Admin Authentication & User Management

**Feature Branch**: `001-admin-auth-users`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "Foundational authentication system for the Masrafy admin dashboard. Internal staff (super_admin, sales_manager, sales_agent, analyst) log in via the Angular dashboard, receive a JWT access token, and access protected admin APIs. Includes admin user CRUD restricted to super_admin role. Prerequisite for every other admin-facing feature."

## Clarifications

### Session 2026-05-13 (Role expansion)

- Q: How many distinct internal roles does the dashboard support? → A: **Four** — `super_admin`, `sales_manager`, `sales_agent`, `analyst`. Replaces the original three-role model (super_admin / admin / viewer).
- Q: What does each role do? → A: **super_admin** = full access including user-management. **sales_manager** = manages bank programs + applications and oversees the sales team. **sales_agent** = handles their own applications; read-only on bank programs. **analyst** = read-only across applications, programs, and audit logs. User-management is super_admin-only.
- Q: Migration of any pre-existing staff rows? → A: Map old → new: `SUPER_ADMIN → super_admin`, `ADMIN → sales_manager`, `VIEWER → analyst`. Applied via SQL migration `20260512234911_admin_role_expansion`.
- Q: Can a super_admin be created via the API? → A: No. `super_admin` is bootstrap-only via the seed script. The Create User dialog and PATCH role endpoint only accept `sales_manager`, `sales_agent`, `analyst`.

### Session 2026-05-12

- Q: What password complexity policy applies to admin staff accounts (at creation, self-change, super_admin reset)? → A: NIST-style — min 12 chars, max 128 chars, breach-list check via HaveIBeenPwned k-anonymity API, deny top-N common passwords list, no forced character classes.
- Q: How does an account-lockout window clear? → A: Sliding 15-minute window — lockout auto-clears 15 minutes after the most recent failed sign-in attempt. No manual super_admin unlock UI in this slice.
- Q: Must a user change their password on first login after account creation by a super_admin, and after a super_admin password reset? → A: Yes in BOTH cases. Staff Account carries a `mustChangePassword` flag set true on creation and on super_admin reset; first successful sign-in in that state routes the user to a blocking change-password screen.
- Q: What accessibility conformance level must the admin dashboard meet for this feature? → A: WCAG 2.2 Level AA. Measurable contrast ratios, keyboard navigation, visible focus indicators, programmatic labels, automated axe-core check in CI.
- Q: Can a super_admin demote another super_admin via the dashboard, and what guard applies? → A: Yes — a super_admin MAY demote another super_admin to one of the non-super roles (sales_manager / sales_agent / analyst), subject to FR-023 (the system never falls below one active super_admin). The dashboard blocks any demotion that would violate FR-023 with the "at least one super_admin must remain" message.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Login & Authenticated Session (Priority: P1)

A member of internal staff opens the Masrafy admin dashboard, enters their work email and password, and gains access to the application sections their role permits. Their name and role are visible in the top bar throughout the session. The session is preserved transparently across short token-validity windows so the user does not see flashes of unauthenticated state during normal use, and they can sign out at any time.

**Why this priority**: Without login, no staff member can use the dashboard at all. Every other admin-facing feature is blocked until this exists. This is the only user story that, on its own, delivers a working, deployable product.

**Independent Test**: Seed an initial super_admin account, deploy backend + dashboard, navigate to the login page, sign in with seeded credentials, confirm the top bar displays the name/role, navigate to any protected route and back, then sign out. Result: protected routes are reachable while signed in, blocked after sign-out, and the session survives at least one access-token expiry without user-visible interruption.

**Acceptance Scenarios**:

1. **Given** an active staff account with the correct password, **When** the user submits the login form, **Then** the dashboard navigates to its default landing page and the top bar shows the user's name and role.
2. **Given** an active staff account with a wrong password, **When** the user submits the login form, **Then** the form displays a localized "invalid credentials" message and no session is created.
3. **Given** a deactivated staff account, **When** the user submits correct credentials, **Then** the dashboard displays a localized "account inactive" message and no session is created.
4. **Given** a signed-in user whose short-lived session credential has just expired, **When** they perform any action that calls the backend, **Then** the action completes without the user seeing a sign-in prompt, because the session is silently renewed.
5. **Given** a signed-in user, **When** they click "Log out," **Then** the dashboard returns to the login page and any subsequent attempt to use the previous session is rejected.
6. **Given** an unauthenticated user, **When** they attempt to visit any protected URL directly, **Then** the dashboard redirects them to the login page and, after successful login, sends them to the URL they originally requested.
7. **Given** a user who fails to sign in five times in fifteen minutes, **When** they attempt a sixth sign-in (even with correct credentials), **Then** the system rejects the attempt with a localized "too many attempts" message until the lockout window elapses.

---

### User Story 2 - Role-Based Access Inside the Dashboard (Priority: P1)

The platform supports four internal roles — `super_admin`, `sales_manager`, `sales_agent`, `analyst` — each with a different set of permitted actions. A user only sees the sections and controls their role grants, and the backend independently enforces those same permissions so that a user cannot bypass restrictions by typing URLs or replaying requests.

**Why this priority**: Role separation is what makes the platform safe to operate for a small team. Without it, every signed-in user effectively has total control, which is unacceptable for a financial product. It must ship with login.

**Independent Test**: Seed one user per role. Sign in as each in turn. Confirm: super_admin sees user management; sales_manager / sales_agent / analyst do not; analyst sees no create/edit/delete controls anywhere; sales_agent's program/audit reads are read-only. Then call write endpoints directly as a non-super account — the backend returns "forbidden" with a stable error code.

**Acceptance Scenarios**:

1. **Given** a signed-in super_admin, **When** they open the dashboard, **Then** the navigation includes user management alongside all other sections.
2. **Given** a signed-in sales_manager, **When** they open the dashboard, **Then** the navigation does NOT include user management, and attempting to visit it directly redirects to a "not authorized" state.
3. **Given** a signed-in sales_agent, **When** they open any section, **Then** the navigation does NOT include user management, and bank-program controls render read-only.
4. **Given** a signed-in analyst, **When** they open any section, **Then** create/edit/delete controls are hidden or disabled across the dashboard.
5. **Given** a signed-in analyst (or sales_agent on a program) who attempts a write action via a direct API call, **When** the request reaches the backend, **Then** the backend rejects it with the standard "forbidden" code regardless of what the dashboard shows.

---

### User Story 3 - Super-Admin Manages Other Admin Users (Priority: P2)

A super_admin can create new `sales_manager`, `sales_agent`, or `analyst` accounts, edit names and roles, deactivate accounts without deleting historical data, and reset another user's password. They cannot accidentally lock themselves out by deactivating their own account or changing their own role. The `super_admin` role itself is not creatable through the dashboard — it is bootstrapped via the seed script.

**Why this priority**: After the first super_admin is seeded, the team needs a way to grow without re-running database seeds. This is the second deliverable slice — it makes the platform operable beyond the founding account, but is not strictly required for the first staff member to begin work.

**Independent Test**: Sign in as the seeded super_admin. Create one new sales_manager, one sales_agent, and one analyst through the dashboard. Sign in as each of the newly created accounts to confirm activation. Return as super_admin, deactivate the sales_manager, then verify that the deactivated account can no longer sign in. Reset their password, share the new password, and confirm sign-in works again.

**Acceptance Scenarios**:

1. **Given** a signed-in super_admin, **When** they create a new account with a unique email, **Then** the account appears in the user list and the new user can sign in.
2. **Given** a signed-in super_admin, **When** they attempt to create an account with an email that already exists, **Then** the form displays a localized "duplicate email" error and no account is created.
3. **Given** a signed-in super_admin, **When** they deactivate another user's account, **Then** subsequent sign-in attempts by that user are rejected with the localized "account inactive" message and historical records for that user remain intact.
4. **Given** a signed-in super_admin, **When** they attempt to deactivate their own account or change their own role, **Then** the dashboard blocks the action and shows a localized "cannot self-modify" message.
5. **Given** a signed-in super_admin, **When** they reset another user's password, **Then** the affected user can sign in with the new password and cannot sign in with the old one.
6. **Given** any signed-in user, **When** they change their own password by supplying the current password and a new password, **Then** subsequent sign-ins require the new password.

---

### Edge Cases

- A user submits the login form while already signed in (e.g., revisits the login page in a new tab): the dashboard recognises the existing session and routes them to the default landing page instead of issuing a duplicate session.
- A user's session renewal credential is revoked server-side (e.g., they signed out from another device, or an administrator deactivated them mid-session): the next backend call fails the silent renewal, client state is cleared, and the user is redirected to the login page with a localized "session ended" message.
- A user signs in successfully on Device A, then signs out from Device B: Device A's next backend call triggers silent renewal, which fails (the renewal credential was rotated/revoked), and Device A is also returned to the login page.
- Network failure during login submission: the form remains populated (email retained, password cleared), and a localized "network error" message is shown — no partial session is created.
- A super_admin tries to deactivate the only super_admin account, or the last active super_admin: the action is blocked with a localized "at least one super_admin must remain" message.
- A user attempts to sign in to an account that has been deactivated for an extended period: the system returns "account inactive" without revealing whether the password was correct, to avoid leaking active-account status.
- An attacker enumerates emails by attempting logins and observing different errors for "wrong password" vs "no such user": the system returns the SAME "invalid credentials" response for both cases.
- A super_admin attempts to create a user with an email that differs only by Unicode normalization, leading/trailing whitespace, or letter casing: the system treats these as duplicates of an existing email.
- A user's session is renewed at the exact moment they sign out: the sign-out completes cleanly and the renewed session is also invalidated.
- A user opens the dashboard with the browser language set to English: all login, role, and user-management UI text appears in English; switching to Arabic flips to RTL layout and Arabic copy.
- A user attempts to sign in while their account is in the rate-limit lockout window with the correct password: the system still rejects the attempt and reports "too many attempts."
- A user attempts to set a new password while the external breach-check service is unreachable: the system fails closed and rejects the change with a localized "password check unavailable, try again" message rather than silently allowing the password.
- A user attempts to set a password that exceeds 128 characters (e.g., paste accident from a long string): the system rejects with a localized "password too long" message and the password is never hashed or persisted.
- A locked-out user waits more than fifteen minutes since their last failed sign-in attempt and then submits correct credentials: the lockout has auto-cleared, the sign-in succeeds, and the failure counter resets to zero on success.
- A locked-out user keeps submitting credentials during the lockout window: each attempt receives the "too many attempts" response, the failure counter is NOT extended further into the future, and the auto-clear time remains anchored to the most recent PRE-lockout failed attempt.
- A newly created user signs in for the first time and immediately tries to navigate to a section other than the change-password screen: the dashboard intercepts navigation and keeps the user on the blocking change-password screen until they complete the change.
- A user in the forced-change flow attempts to set their new password equal to the password the super_admin just gave them: the system rejects with a localized "new password must differ from current password" message.
- A user is in the forced-change state and the super_admin deactivates them mid-flow: the user's next attempt to submit the new password is rejected with the localized "account inactive" message and the session is terminated.
- Two super_admins, each editing the only other super_admin concurrently, both attempt to demote in the same instant: the backend's atomic FR-023 check ensures at most one of the two requests succeeds; the second receives the localized "at least one super_admin must remain" response.
- A super_admin demotes another super_admin to analyst (or any non-super role): the demoted user's next backend call after the role change observes the lower role; if they were viewing user-management at the moment, the dashboard renders an "unauthorized" state and routes them away. Their existing session remains valid (no forced sign-out) but is now scoped to the new role's permissions.

## Requirements *(mandatory)*

### Functional Requirements

**Login & Session**

- **FR-001**: System MUST allow internal staff to sign in to the admin dashboard by submitting an email and password.
- **FR-002**: System MUST treat email addresses as case-insensitive and whitespace-trimmed for both account lookup and uniqueness checks.
- **FR-003**: System MUST return an identical, localized "invalid credentials" response when either the email is unknown or the password is wrong, without revealing which.
- **FR-004**: System MUST return a localized "account inactive" response when a user with valid credentials is deactivated, distinct from the invalid-credentials response.
- **FR-005**: System MUST establish a signed-in session on successful login such that the user can use the dashboard without re-entering credentials for the remainder of the session.
- **FR-006**: System MUST renew the session silently in the background before the user notices any interruption, for as long as the user's long-lived session credential remains valid.
- **FR-007**: System MUST end the session on user sign-out, invalidating both the active short-lived credential and the long-lived renewal credential server-side, so that no replay can re-authenticate the user.
- **FR-008**: System MUST allow a user to sign out from any screen of the dashboard.
- **FR-009**: System MUST preserve the user's originally requested URL when redirecting an unauthenticated visit to the login page, and navigate to that URL after successful login.
- **FR-010**: System MUST show the signed-in user's name and role somewhere visible (e.g., top bar) throughout the dashboard.

**Roles & Authorization**

- **FR-011**: System MUST support four roles for internal staff: `super_admin`, `sales_manager`, `sales_agent`, `analyst`. Default permission matrix:
  - **super_admin** — full access including user-management.
  - **sales_manager** — manages bank programs + applications; oversees the sales team; no user-management.
  - **sales_agent** — handles their own applications; read-only on bank programs; no user-management.
  - **analyst** — read-only across applications, bank programs, and audit logs.
- **FR-012**: System MUST restrict user-management functionality (creating, editing, deactivating, resetting passwords of other staff) to `super_admin` role only.
- **FR-013**: System MUST hide or disable create/edit/delete controls in the dashboard for users whose role does not permit those actions.
- **FR-014**: System MUST enforce role permissions on the backend independently of the dashboard, rejecting unauthorized write actions with a stable, localized "forbidden" response even if the client sends the request directly.
- **FR-015**: System MUST reject every request to protected backend endpoints that does not carry a valid active session credential, with stable, distinct codes for missing, malformed, expired, and revoked credentials.

**User Management**

- **FR-016**: Super_admins MUST be able to create a new staff account by supplying name, email, role (one of `sales_manager`, `sales_agent`, `analyst` — `super_admin` is NOT creatable through the API; bootstrap-only via seed), and initial password.
- **FR-017**: System MUST reject account creation when the supplied email matches any existing account (including matches that differ only by casing or whitespace), with a localized "duplicate email" response.
- **FR-018**: Super_admins MUST be able to list staff accounts in the dashboard, including name, email, role, active/inactive status, and last sign-in time.
- **FR-019**: System MUST support pagination of the staff-account list to handle teams growing beyond a single page of results.
- **FR-020**: Super_admins MUST be able to view a single staff account's details.
- **FR-021**: Super_admins MUST be able to edit a staff account's name, role, and active/inactive status.
- **FR-022**: System MUST prevent a super_admin from changing their OWN role or deactivating their OWN account, blocking the action with a localized "cannot self-modify" response.
- **FR-023**: System MUST prevent any action that would leave the platform with zero active super_admins. This guard MUST be evaluated atomically on the backend at the time of the mutating request (not pre-validated client-side only), to avoid race conditions where two concurrent operations could each pass an independent check yet jointly violate the invariant.
- **FR-023a**: A super_admin MAY demote another super_admin to one of the non-super roles (`sales_manager`, `sales_agent`, `analyst`) via the edit-user flow, provided FR-023 still holds AFTER the demotion (i.e., at least one active super_admin remains). Backend MUST reject any demotion request that would violate FR-023 with the localized "at least one super_admin must remain" response.
- **FR-023b**: System MUST emit a distinct audit event `admin.user.role_changed` (carrying actor, target, from_role, to_role) whenever a super_admin changes another staff account's role. Role transitions to and from super_admin MUST be captured in the audit stream and are independently noteworthy in any future audit-log viewer.
- **FR-024**: Super_admins MUST be able to reset another staff account's password by supplying a new password.
- **FR-025**: Any signed-in user MUST be able to change their own password by supplying their current password plus a new password.
- **FR-026**: System MUST reject a self-password change when the supplied current password is wrong, with a localized "invalid current password" response.
- **FR-026a**: System MUST set a `mustChangePassword` flag to true on a Staff Account whenever (a) the account is created by a super_admin with an initial password, OR (b) a super_admin resets the account's password. The flag MUST be cleared to false only when the user successfully completes a self-initiated password change via the forced-change flow described in FR-026c.
- **FR-026b**: System MUST detect the `mustChangePassword` state on every successful sign-in. When the flag is true, the dashboard MUST navigate the user to a blocking "change password" screen that prevents access to any other section of the application until the change is completed.
- **FR-026c**: During the forced change flow, the user MUST supply a new password meeting the full password policy (FR-030a, FR-030b, FR-030c). The current password is NOT required to be re-supplied (the user has already authenticated in this session). On success, the `mustChangePassword` flag is cleared, the user's session continues, and the user is navigated to the default landing page. The new password MUST NOT match the password that was just set by the super_admin.
- **FR-026d**: System MUST emit an audit event `auth.password.forced_change_completed` (in addition to the standard `auth.password.changed` event) on each successful forced change so that the operational handoff from super_admin to user is traceable.
- **FR-027**: System MUST preserve historical records (applications reviewed, audit events, etc.) associated with deactivated accounts; deactivation MUST NOT delete the underlying account record.

**Password & Credential Storage**

- **FR-028**: System MUST store user passwords only in a salted, slow-hash form suitable for password storage — never in plaintext or in any reversible form.
- **FR-029**: System MUST never include passwords or password hashes in any API response or log line, under any condition.
- **FR-030**: System MUST store long-lived session renewal credentials in a form that, if the database were compromised, would not allow an attacker to use them directly.
- **FR-030a**: System MUST enforce a password policy of minimum 12 characters and maximum 128 characters on every flow that sets or changes a password (account creation by super_admin, super_admin password reset, self password change). No forced character-class composition rules (upper/lower/digit/symbol) are imposed.
- **FR-030b**: System MUST reject any password that appears in a known-breached-credentials corpus via a k-anonymity-style check (sends only a hash prefix; never sends the full password or hash to the external check). If the external breach check is unavailable, system MUST fail closed — reject the password change with a localized "password check unavailable, try again" response rather than silently allowing a possibly-breached password.
- **FR-030c**: System MUST maintain a server-side deny list of common passwords (top-N most common) and reject any submitted password that matches an entry (case-insensitive, after whitespace trim).
- **FR-030d**: System MUST surface password-policy failures to the user with a distinct localized response per failure reason (too short, too long, breached, on common-password list) so the user can correct the input without retrying blindly.
- **FR-030e**: Password-policy validation MUST run on the server in every flow that sets or changes a password; client-side validation is for UX feedback only and MUST NOT be relied on for enforcement.

**Rate Limiting & Abuse Protection**

- **FR-031**: System MUST track failed sign-in attempts per account using a sliding fifteen-minute window. When five or more failures occur within that rolling window, the account is in a lockout state. The lockout auto-clears once fifteen minutes have elapsed since the most recent failed attempt — no manual unlock action is required and no super_admin unlock UI is provided in this feature.
- **FR-031a**: System MUST reset the failure count for an account upon a SUCCESSFUL sign-in (assuming the account is not currently locked out).
- **FR-031b**: System MUST NOT extend the lockout window on attempts that occur DURING an active lockout — i.e., attempting during lockout returns the "too many attempts" response but does not push the auto-clear time further into the future.
- **FR-032**: System MUST rate-limit sign-in attempts per source network address to prevent enumeration regardless of the account targeted.
- **FR-033**: System MUST return a localized "too many attempts" response during a lockout, even when the supplied credentials are correct, and MUST NOT reveal the remaining time on the lockout window to the client (no countdown leak).

**Internationalization & Branding**

- **FR-034**: All user-visible text in the login flow, top bar, navigation, user-management screens, error toasts, and validation messages MUST be available in Arabic (primary) and English (secondary).
- **FR-035**: The dashboard MUST present a right-to-left layout when the active locale is Arabic and a left-to-right layout when the active locale is English, including direction-aware navigation, alignment, and iconography.
- **FR-036**: The login page MUST visually conform to the Masrafy brand identity, applying the deep-navy primary brand color to the primary call-to-action and brand mark.

**Accessibility**

- **FR-036a**: All screens introduced by this feature (login, forced-change password, top bar / role indicator, user list, user create/edit modal, self password change) MUST conform to WCAG 2.2 Level AA. This includes: text contrast ratio ≥ 4.5:1, large-text and UI-component contrast ≥ 3:1, every interactive element reachable and operable via keyboard alone, visible focus indicator on every focusable element, programmatic name + role + value on every form field and button, error messages programmatically associated with their input field, and target size of ≥ 24×24 CSS pixels for interactive controls.
- **FR-036b**: System MUST run an automated accessibility check (axe-core or equivalent) against every screen in this feature on every PR in CI, and fail the build on any WCAG 2.2 AA violation introduced by the diff.
- **FR-036c**: System MUST preserve accessibility properties under BOTH locales — Arabic (RTL) and English (LTR) — verified on every PR with UI changes.
- **FR-036d**: System MUST announce login/forced-change/user-management form submission outcomes (success, validation error, server error, lockout) to assistive technologies via an ARIA live region or equivalent, so screen-reader users hear the result without relying on visual cues.

**Observability & Audit**

- **FR-037**: System MUST record discrete audit events for: successful sign-in, failed sign-in, sign-out, session renewal, password change (self), password reset (by super_admin), account creation, account deactivation.
- **FR-038**: Audit events MUST be sufficient to reconstruct who did what and when, without including any password, hash, or session credential in the event payload.
- **FR-039**: System MUST emit a correlation identifier on every request and propagate it through all logs related to that request.

**Bootstrapping**

- **FR-040**: System MUST provide a way to create the initial super_admin account in a fresh environment without requiring an existing signed-in user, and this bootstrap operation MUST be safe to re-run (idempotent) without creating duplicate accounts or weakening security.

### Key Entities *(include if feature involves data)*

- **Staff Account**: Represents an internal Masrafy team member with access to the admin dashboard. Holds the user's display name, login email (unique, normalized), securely stored password, role (one of `super_admin` / `sales_manager` / `sales_agent` / `analyst`), active/inactive status, must-change-password flag (true after creation or super_admin reset, false after the user completes a forced change), creation timestamp, last update timestamp, and last successful sign-in timestamp. Historical records (applications reviewed, audit entries, etc.) reference the account by stable identifier so that deactivation does not orphan history.
- **Session Renewal Credential**: Represents the long-lived right to silently renew a user's signed-in session. Belongs to one Staff Account, has an expiry, may be revoked (server-side invalidation), and is stored in a non-reversible form. Each successful renewal issues a new credential and invalidates the prior one so a leaked credential has a single use window.
- **Sign-In Attempt Record**: Represents an audit-grade record of each sign-in attempt. Captures account targeted (by identifier when known), source network address, outcome (success / wrong-credentials / inactive / locked-out), timestamp, and correlation identifier. Used both for lockout enforcement and for after-the-fact review.
- **Audit Event**: Represents a discrete, append-only record of a security-relevant action (login success/failure, logout, renewal, password change, password reset, account create, account deactivate). Captures actor identifier, target identifier (when distinct), action type, timestamp, source network address, and correlation identifier. Never contains passwords, hashes, or session credentials.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new internal team member can complete first sign-in (from arriving at the login URL to landing on the dashboard) in under 30 seconds when their credentials are valid.
- **SC-002**: 100% of protected admin areas are unreachable to unauthenticated visitors — every direct-URL attempt redirects to the login page with the intended destination preserved.
- **SC-003**: 100% of write actions attempted by `analyst`-role users (and `sales_agent` write attempts on bank programs) — whether via the dashboard or via direct backend calls — are rejected with the platform's standard "forbidden" response.
- **SC-004**: 100% of write actions attempted by admin-role users against user-management functionality are rejected.
- **SC-005**: Across an end-to-end sign-in test, 0% of password values, password hashes, or session credentials appear anywhere in server logs, client-side logs, audit events, or API responses.
- **SC-006**: After a user's short-lived session credential expires mid-task, at least 99% of subsequent in-flight user actions complete successfully without the user seeing a sign-in prompt, provided their long-lived renewal credential remains valid.
- **SC-007**: A user who has been signed out (either by themselves or by a super_admin deactivating their account) cannot reach any protected area within 60 seconds of the sign-out / deactivation taking effect.
- **SC-008**: A super_admin can create a new staff account, share the credentials, and have that new user complete their first sign-in within 5 minutes of the account being created.
- **SC-009**: After five failed sign-in attempts within 15 minutes against any single account, the sixth attempt is rejected with the lockout response — measured at 100% reliability across automated tests.
- **SC-010**: A locale switch between Arabic (primary) and English (secondary) updates 100% of user-visible login, top-bar, navigation, user-management, and error text, and flips layout direction across 100% of those screens.
- **SC-011**: An attacker cannot distinguish "wrong password" from "no such account" by observing responses — both return identical content, identical status, and timing within normal jitter, across at least 1,000 sampled probes.
- **SC-012**: A fresh deployment of the platform can produce a working initial super_admin account from environment configuration alone, with zero manual database edits, in under 10 minutes of operator time.
- **SC-013**: 100% of security-relevant actions defined in FR-037 produce a corresponding audit event that includes actor, action, timestamp, and correlation identifier.
- **SC-014**: Adding a new error code surfaced by this feature to the dashboard's Arabic and English copy requires no code changes outside the single shared error-code-to-message helper and its translation files.
- **SC-015**: It is impossible — through any combination of dashboard actions — to deactivate the last remaining active super_admin or otherwise leave the platform with zero super_admins.
- **SC-016**: 100% of password-set and password-change flows (super_admin creating a staff account, super_admin resetting another user's password, user changing their own password) reject submissions that fail any rule of the password policy (length, breach-list, common-password deny list) across automated tests, with a distinct localized message per failure reason.
- **SC-017**: 100% of newly created accounts and 100% of accounts after a super_admin password reset are routed to the blocking forced-change screen on next successful sign-in and cannot reach any other dashboard section until they complete the change — measured across automated tests covering both creation and reset paths.
- **SC-018**: Automated accessibility scans (axe-core or equivalent) report 0 WCAG 2.2 Level AA violations on every screen introduced by this feature, in both Arabic (RTL) and English (LTR), on every PR — enforced as a CI gate.
- **SC-019**: A keyboard-only user can complete sign-in, forced password change, self password change, sign-out, and (as super_admin) the full create / edit / deactivate / reset-password flow without using a pointing device, verified by end-to-end test.
- **SC-020**: Under concurrent demotion attempts targeting the only "other" super_admin (i.e., the demotion that would drop the platform to one or zero super_admins), the backend's atomic FR-023 / FR-023a check guarantees the active-super_admin count never drops below 1 — verified by automated concurrency test running ≥100 racing pairs with zero failures.

## Assumptions

- The Masrafy admin dashboard runs in modern desktop browsers used by internal staff; mobile browser support for the admin dashboard is not a requirement of this feature (the mobile audience is end users via the Flutter app, which is out of scope for this spec).
- Staff are issued initial credentials out-of-band by an authorized super_admin or the bootstrap process; this feature does NOT cover self-service signup, email verification, or self-service password reset via email.
- This feature does NOT include multi-factor authentication, single sign-on, or social login. Those are explicitly out of scope and tracked as future work.
- This feature does NOT include a UI for viewing audit events. Audit events are captured and persisted (per FR-037/038) so a future Audit Log Viewer feature can present them, but no viewer ships in this slice.
- This feature does NOT include a UI for managing concurrent sessions (e.g., "log me out everywhere"). Session invalidation happens via deactivation, sign-out, or natural expiry only.
- Authentication for the Egyptian end-user mobile API uses a different mechanism (request signing) and is covered by a separate specification.
- The initial seed super_admin's credentials are delivered to a trusted operator via a secure out-of-band channel (e.g., infrastructure secret store); this spec does not prescribe the channel.
- "Localized" means Arabic and English at launch; additional languages may be added later without changing the architecture (FR-034).
- The platform expects internal staff teams in the small-to-medium range (tens, not thousands), so pagination defaults are tuned for that scale; very-large-team performance tuning is out of scope.
- The lockout window of fifteen minutes and the threshold of five failures are the values codified in the spec; any future change requires a spec amendment.
- Deactivation, not deletion, is the canonical way to revoke access. Hard delete of staff accounts is out of scope; historical referential integrity (e.g., "which super_admin approved this loan") must remain intact.
