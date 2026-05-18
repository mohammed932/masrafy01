# Feature Specification: Bank Entity CRUD + Logo

**Feature Branch**: `007-bank-entity-crud`
**Created**: 2026-05-18
**Status**: Draft
**Input**: User description: "Bank entity CRUD with logo upload — super_admin manages a real Bank table; BankProgram links to Bank via FK (replaces free-text bankName)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Super_admin creates a new Bank (Priority: P1)

A super_admin opens the admin dashboard, navigates to the Banks section, and creates a new bank by entering an immutable code, Arabic + English names, an optional logo, an optional website URL, an optional notes field, and a display-order rank. They save. The bank is immediately available as a selectable option when creating or editing bank programs.

**Why this priority**: Banks are the parent of every program. Without a real Bank entity, every program carries a free-text bank name with no canonical identity, no logo, and no toggle. This story unlocks the entire feature.

**Independent Test**: Sign in as super_admin. Open Banks → Add bank. Enter `ABK_EGYPT`, Arabic + English names, upload a logo, save. Verify the bank appears in the Banks list with logo thumbnail and "0 programs". Open the bank-program form and confirm the new bank appears in the bank dropdown.

**Acceptance Scenarios**:

1. **Given** super_admin on the Banks list, **When** they click "Add bank" and submit a unique code + both names, **Then** the bank is persisted and appears in the list.
2. **Given** super_admin submits a duplicate `code`, **When** they save, **Then** the form displays a localized `BANK_CODE_DUPLICATE` error and the bank is not created.
3. **Given** super_admin submits a `code` containing lowercase letters or punctuation other than underscore, **When** they save, **Then** the form rejects with `BANK_CODE_INVALID_FORMAT` and highlights the field.
4. **Given** the bank was created, **When** super_admin uploads a logo via the presigned upload flow, **Then** the logo is bound to the bank and renders as a thumbnail on the list and on every program detail surface for programs linked to this bank.

---

### User Story 2 — Internal staff list, search, and view banks (Priority: P1)

Internal staff (any signed-in role) need to list banks, search by name or code, filter by active/inactive, and open any bank's detail page to review its info and the programs linked to it. Viewing is read-only for non-super_admin roles; write actions are hidden.

**Why this priority**: Operational visibility into the bank registry is required from day one — the bank dropdown on the program form depends on this list, and operators need to verify which programs belong to which bank.

**Independent Test**: Seed three banks (two active, one inactive). Sign in as each of admin / sales_manager / sales_agent / analyst and confirm the list is visible, search works, the inactive bank is hidden when "Active only" filter is on, and write actions are NOT accessible. Then sign in as super_admin and verify all write actions appear.

**Acceptance Scenarios**:

1. **Given** any signed-in staff member, **When** they open the Banks list, **Then** the list renders with code, name (in the current locale), logo thumbnail, active toggle (read-only for non-super_admin), and program count.
2. **Given** a viewer with non-super_admin role, **When** they look at any row's actions, **Then** no write actions are accessible from the UI, and direct backend writes are rejected with the platform's localized `FORBIDDEN`.
3. **Given** any staff member types in the search bar, **When** the input debounces, **Then** the list filters case-insensitively across `code`, Arabic name, and English name.
4. **Given** any staff member opens a bank's detail page, **When** the bank has at least one program, **Then** the page lists every program linked to that bank with a click-through to the program detail.

---

### User Story 3 — Super_admin edits a bank (Priority: P2)

A super_admin updates a bank's Arabic / English name, logo, website URL, display order, or notes. They cannot change the `code` (immutable after creation). Edits respect optimistic concurrency: if two super_admins edit the same bank simultaneously, the second save is rejected with `BANK_CONFLICT_STALE_DATA` and the dashboard prompts a reload.

**Why this priority**: Operational maintenance — bank logos, websites, and Arabic name spellings change. Lower priority than create + list because the workaround during an outage is to create a replacement bank.

**Independent Test**: Open a bank in edit mode. Change the English name from "ABK Egypt" to "ABK Egypt SAE" and save. Verify the change appears on the detail view and on every program list that displays the bank name. Confirm the `code` field is locked. With two browser tabs open on the same bank, save changes in tab 1, then attempt to save tab 2 — verify `BANK_CONFLICT_STALE_DATA` is returned.

**Acceptance Scenarios**:

1. **Given** super_admin opens a bank in edit, **When** they change any non-code field and save, **Then** the change is persisted and an audit event is recorded.
2. **Given** super_admin attempts to edit `code`, **When** the form renders, **Then** the field is read-only.
3. **Given** two super_admins edit the same bank concurrently, **When** both submit, **Then** the second submitter receives `BANK_CONFLICT_STALE_DATA` and the first submitter's changes are not silently overwritten.

---

### User Story 4 — Super_admin toggles a bank active / inactive (Priority: P2)

A super_admin toggles a bank's `isActive` flag. Inactive banks are hidden from the bank-program form's bank dropdown but their existing programs continue to function (linked via FK; toggling the bank does NOT toggle the programs).

**Why this priority**: Banks come and go; deactivation is the safe alternative to deletion. Independent of edit because toggling is a single-field write with no other side effects.

**Acceptance Scenarios**:

1. **Given** super_admin toggles a bank to inactive, **When** another staff member opens the bank-program create form, **Then** the inactive bank is NOT shown in the bank dropdown.
2. **Given** the bank is inactive, **When** any staff member views a program that links to that bank, **Then** the bank name and logo still render correctly with a small "inactive" badge on the detail view.

---

### User Story 5 — Super_admin deletes a bank (Priority: P3)

A super_admin permanently deletes a bank that has zero linked programs. If the bank has ANY linked program, deletion is refused with a localized `BANK_HAS_PROGRAMS` error including the program count. The operator must reassign or deactivate programs first.

**Why this priority**: Permanent delete is rare and dangerous. Normally banks are deactivated. Lowest priority — operational housekeeping only.

**Acceptance Scenarios**:

1. **Given** super_admin attempts to delete a bank with zero programs, **When** they confirm via a double-confirmation dialog, **Then** the bank is removed and an audit event is recorded.
2. **Given** super_admin attempts to delete a bank that has one or more programs, **When** they confirm, **Then** the request is rejected with `BANK_HAS_PROGRAMS` and the response includes `programCount` so the operator can plan.
3. **Given** an admin (not super_admin) attempts to delete via direct backend call, **When** the request is received, **Then** it is rejected with the platform's localized `FORBIDDEN`.

---

### Edge Cases

- Super_admin uploads a logo larger than the platform's per-file limit → upload is rejected at the presigned-URL request step with the platform's `FILE_TOO_LARGE` response.
- Super_admin uploads a logo of an unsupported MIME type (e.g. `image/gif`) → request rejected before presigning with `FILE_TYPE_NOT_ALLOWED` and the allowed list returned in `meta`.
- Two super_admins concurrently confirm a logo upload after both received presigned URLs → the second confirmation wins on optimistic version compare-and-swap; the first transitions to `BANK_CONFLICT_STALE_DATA`.
- A bank-program create attempt references a `bankId` that points to a deactivated bank → the form's bank dropdown excludes inactive banks, but a direct backend call IS still accepted (FK valid); the bank merely no longer appears in pickers. The platform does NOT auto-flip programs to inactive when their bank deactivates.
- A bank-program references a `bankId` and the bank's English name is later changed → the bank-program detail view renders the CURRENT bank name (live join) because Bank metadata is reference data, not a snapshot. The BankOffer snapshot field `bankName` (per Principle I) is unaffected.
- The S3 endpoint is unreachable when super_admin requests a logo upload → request returns the platform's standard upstream-unavailable response; no Bank row is mutated.
- An auto-derived bank `code` collides during seed backfill (e.g. two source strings normalize to the same code) → seed dedupes by string identity first (per Phase 1 decision on "Sales Floor (2026)" + "Salesfloor Bank"); any remaining collisions are reported and skipped, leaving a manual operator decision.

## Requirements *(mandatory)*

### Functional Requirements

**Data model**

- **FR-001**: System MUST persist each bank with the following fields: an opaque immutable identifier, an immutable `code` (uppercase ASCII letters, digits, underscores; 2–40 chars; format `[A-Z][A-Z0-9_]{1,39}`; globally unique), an Arabic display name, an English display name, an optional logo reference (object-storage key, nullable), an optional website URL, an `isActive` boolean (default true), an integer `displayOrder` (default 0), an optional free-form notes field, an integer `version` for optimistic concurrency, audit timestamps, and references to the staff accounts that created and last updated the row.
- **FR-002**: System MUST establish a foreign-key relationship from the existing BankProgram entity to Bank. Old free-text `bankName` on BankProgram MUST be backfilled into a real Bank row and the new `bankId` column populated for every existing program. The free-text column MAY remain for one release as a deprecation safety net before being dropped.
- **FR-003**: BankOffer's `bankName` snapshot field (Constitution Principle I — immutable post-match) MUST remain as a frozen string and MUST NOT acquire a foreign key to Bank. The matching engine continues snapshotting the bank's English name onto each offer at match time.
- **FR-004**: The relationship between Bank and BankProgram MUST use `ON DELETE RESTRICT`; the database itself MUST refuse to remove a Bank that has any program. The application layer surfaces `BANK_HAS_PROGRAMS` with `programCount` before the database error is reached.

**CRUD**

- **FR-005**: System MUST allow super_admin to create a new bank with `code`, Arabic name, English name (all required) plus optional logo, website, notes, and display-order. `code` MUST be uppercased server-side and validated against the format rule; on duplicate the platform returns `BANK_CODE_DUPLICATE`; on format violation the platform returns `BANK_CODE_INVALID_FORMAT`.
- **FR-006**: System MUST allow super_admin to edit any field of an existing bank EXCEPT `code`. Edits MUST submit with the bank's current `version`; mismatch returns `BANK_CONFLICT_STALE_DATA` and includes the current version.
- **FR-007**: System MUST allow super_admin to toggle a bank's `isActive` flag. Toggling MUST submit with `version` and respect the same compare-and-swap. Toggling a bank inactive MUST NOT mutate any linked BankProgram's `active` flag.
- **FR-008**: System MUST allow super_admin to permanently delete a bank only when no BankProgram references it. When at least one program references the bank, the platform MUST refuse with `BANK_HAS_PROGRAMS` and the response MUST include `programCount`.
- **FR-009**: System MUST allow any signed-in staff to list banks with pagination (page + pageSize), filter by `isActive`, and search free-text against `code`, Arabic name, and English name (case-insensitive). Default ordering: `displayOrder ASC`, then English name ASC.
- **FR-010**: System MUST allow any signed-in staff to retrieve a single bank's full record by its identifier, including its current `programCount`.
- **FR-011**: System MUST allow any signed-in staff to retrieve the list of BankPrograms linked to a given bank (id, programCode, friendlyName, productCategory, active, version), with read-only fields suitable for embedding on the bank detail view.

**Logo upload**

- **FR-012**: System MUST expose a presigned-URL upload flow consistent with the platform's document-upload pattern: super_admin requests an upload URL for a given bank id + MIME type, the platform validates MIME against an allow-list (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`), generates a deterministic object key under `bank-logos/<bank-id>/<uuid>.<ext>`, and returns a short-lived presigned PUT URL plus expiration timestamp.
- **FR-013**: System MUST expose a confirm-upload endpoint that verifies the object exists in storage (HEAD check), then persists `logoS3Key` on the bank row using optimistic concurrency, then emits a `BANK_LOGO_UPLOADED` audit event.
- **FR-014**: System MUST surface the logo on the bank list (thumbnail), the bank detail view (full), and any program list / detail that displays the bank (thumbnail), via the platform's standard presigned-GET helper for object storage. Missing logo MUST render a fallback chip with the bank's two-letter initial.

**Permissions**

- **FR-015**: System MUST enforce role permissions on the backend independently of the dashboard: write actions (create, edit, toggle, delete, logo upload) require super_admin; read actions are permitted to all signed-in staff. The dashboard MUST hide write controls for users whose role does not permit them.

**Validation**

- **FR-016**: `code` MUST be IMMUTABLE after creation. The edit endpoint MUST reject any attempt to change `code` (lenient strip is NOT permitted — the platform returns `VALIDATION_FAILED` if the field is present in an edit payload).
- **FR-017**: The bank dropdown on the BankProgram create / edit form MUST source its options from the active banks list. Selecting an inactive bank from a stale tab MUST be rejected at submit time with the platform's validation envelope.

**Audit + observability**

- **FR-018**: System MUST record an audit event for each of: bank created (`BANK_CREATED`), bank updated (`BANK_UPDATED`, with before/after for the changed fields), bank toggled (`BANK_TOGGLED`, with new state), bank deleted (`BANK_DELETED`, with the deleted code and operator), bank logo uploaded (`BANK_LOGO_UPLOADED`, with the new object-storage key).
- **FR-019**: Audit events MUST NOT contain end-user PII; they contain operator identifiers, bank identifiers, and configuration fields only.
- **FR-020**: System MUST propagate the platform's correlation identifier on every Bank request through all related logs.

**Internationalization, accessibility, branding**

- **FR-021**: All user-visible labels, help text, validation messages, toasts, and tier descriptors MUST be available in Arabic (primary) and English (secondary), routed through the platform's central error-code-to-message helper for codes that originate server-side. The five new error codes (`BANK_NOT_FOUND`, `BANK_CODE_DUPLICATE`, `BANK_CODE_INVALID_FORMAT`, `BANK_HAS_PROGRAMS`, `BANK_CONFLICT_STALE_DATA`) MUST have entries in both locale dictionaries in the same PR.
- **FR-022**: The dashboard MUST present a right-to-left layout when the active locale is Arabic. The bank list, edit modal, and detail view MUST be tested in both directions.
- **FR-023**: All Bank screens MUST visually conform to the Masrafy brand identity, applying the platform's primary brand color to primary calls-to-action and section accents, consistent with the design tokens already established.
- **FR-024**: All Bank screens MUST be operable via keyboard alone with visible focus indicators and minimum tap target size of 24×24 CSS pixels, consistent with WCAG 2.2 AA.

**Design pipeline**

- **FR-025**: Each new screen introduced by this feature (Banks list, Bank detail, Add/Edit Bank modal) MUST be designed via the platform's `ui-ux-pro-max` design skill BEFORE implementation. Following first implementation, each screen MUST receive an `impec` polish pass. Both invocations are part of the feature's definition of done.

**Out of scope for this feature**

- Tests (unit, integration, e2e) are explicitly NOT in scope.
- Commission-rate fields, SWIFT codes, contact-person fields, branch lists, country codes, and any other field beyond the eleven listed in FR-001 are NOT in scope. Adding them later is a separate feature.
- Bulk import / export of banks is NOT in scope.
- A mobile read-only API surface for banks is NOT in scope (the existing mobile bank-programs surface already exposes the bank's English name via the program snapshot).
- Approval workflow on bank changes is NOT in scope; super_admin can edit directly.

### Key Entities

- **Bank**: The top-level issuer entity. Carries an immutable identifier, an immutable globally-unique `code`, Arabic + English display names, an optional logo object-storage key, an optional website URL, `isActive`, `displayOrder`, optional notes, a `version` integer for optimistic concurrency, audit timestamps, and references to the staff accounts that created and last updated it. One-to-many relationship with BankProgram.
- **BankProgram** (existing, modified): Gains a new required-on-write foreign key `bankId` referencing Bank. Retains a transitional `bankName` string column for one release as a deprecation safety net; the platform writes both during the transition, reads from the FK join.
- **BankProgram → Bank** (relation): `ON DELETE RESTRICT`. Banks cannot be deleted while programs reference them.
- **Bank Audit Event**: An append-only record of an operationally-relevant change to a bank. Captures actor identifier, bank identifier, event type (created / updated / toggled / deleted / logo_uploaded), timestamp, source network address, correlation identifier, and a structured payload describing the change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A super_admin can create a brand-new bank from a clean slate to "available in the program-form dropdown" in under 60 seconds, including logo upload.
- **SC-002**: 100% of write actions against banks (create / edit / toggle / delete / logo upload) are rejected when attempted by a non-super_admin role, verified across the dashboard surface AND direct backend calls.
- **SC-003**: 100% of attempted bank deletions on banks that have at least one referencing program are blocked with the standard "has programs" response, verified across automated checks.
- **SC-004**: 100% of concurrent edits to the same bank by two super_admins result in the second submitter receiving `BANK_CONFLICT_STALE_DATA` and zero silent overwrites.
- **SC-005**: 100% of bank audit events (created / updated / toggled / deleted / logo_uploaded) produce a corresponding event record including actor, action, timestamp, bank identifier, and correlation identifier.
- **SC-006**: A locale switch between Arabic (primary) and English (secondary) updates 100% of user-visible labels, validation messages, and toasts on every Bank screen and flips layout direction.
- **SC-007**: A keyboard-only user can complete the full create-bank flow (entering every required field, uploading a logo, submitting, navigating from the success toast back to the list, opening the new bank in detail view) without using a pointing device.
- **SC-008**: After deployment, 100% of existing BankProgram rows are linked to a Bank row via `bankId`; the backfill leaves zero programs with a NULL `bankId`.
- **SC-009**: The bank-program form's bank dropdown is populated entirely by the live Banks list with zero free-text typing accepted; 100% of program creates and edits store `bankId` against a valid Bank row.
- **SC-010**: The bank list renders a logo thumbnail within 1 second of opening the page for banks that have a logo; banks without a logo render a fallback chip in the same render frame.
- **SC-011**: When the underlying object-storage endpoint is unavailable, all bank reads continue to succeed (logos render as fallback chips); only the logo-upload flow surfaces an error.
- **SC-012**: Across 100 sampled bank create attempts spanning the full unique-code namespace, every duplicate attempt produces `BANK_CODE_DUPLICATE` with the offending code in `meta`; zero accidental overwrites of existing rows.

## Assumptions

- The platform already exposes a presigned-URL object-storage helper (per feature 005 — documents). This feature reuses that helper without modification.
- The platform already exposes a central audit-event mechanism and an admin role-based-access guard (per feature 001). This feature reuses both without modification.
- The Arabic-first localization pipeline and the `ErrorCodeService` helper used by the dashboard (per feature 002) are present and accept new error-code entries via a same-PR rule (backend constants + Arabic dictionary + English dictionary).
- The existing free-text `bankName` column on BankProgram is the source of truth at migration time; the backfill derives one `Bank` per distinct trimmed value with deterministic `code` normalization.
- The two competitor-catalog strings "Sales Floor (2026)" and "Salesfloor Bank" are the same competitor (per Phase 1 decision); the migration consolidates them into one Bank row before the backfill derives codes.
- The Egyptian Arabic display rules and brand-color tokens established by prior features apply unchanged.
- Tests are explicitly out of scope for this feature; quality verification occurs through manual smoke-testing of the listed user scenarios.
