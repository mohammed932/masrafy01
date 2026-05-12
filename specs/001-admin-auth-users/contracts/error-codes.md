# Error Codes Contract

Codes used by `001-admin-auth-users`. Authority: backend `backend/src/common/errors/error-codes.ts`. The dashboard MUST map each code to a localized message via `ErrorCodeService.toLocalizedMessage(code, meta)`. NEVER show the code or any backend-supplied English string to the user.

Adding a new code is a same-PR operation across three files:
1. `backend/src/common/errors/error-codes.ts`
2. `admin/src/i18n/error-codes.ar-EG.json`
3. `admin/src/i18n/error-codes.en-US.json`

## Reference

| Code | HTTP | `meta` shape | When emitted | UI message (intent) |
|---|---|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | — | Login: unknown email OR wrong password (indistinguishable). | "Wrong email or password." |
| `AUTH_ACCOUNT_INACTIVE` | 403 | — | Login: account exists, credentials match, `isActive=false`. | "This account is deactivated. Contact a super-admin." |
| `AUTH_TOKEN_MISSING` | 401 | — | Protected endpoint hit with no `Authorization` header. | "You need to sign in." (silent redirect) |
| `AUTH_TOKEN_EXPIRED` | 401 | — | JWT decoded, `exp` past. | (silent refresh attempt) |
| `AUTH_TOKEN_INVALID` | 401 | — | JWT malformed, signature mismatch, or claims tampered. | "Your session is invalid. Please sign in again." |
| `AUTH_REFRESH_INVALID` | 401 | — | `/auth/refresh`: cookie missing/expired/revoked, or token-hash not found. | (cookie cleared, redirect to login) |
| `FORBIDDEN` | 403 | — | Valid session, insufficient role for the action. | "You don't have permission to do that." |
| `MUST_CHANGE_PASSWORD` | 403 | — | Any protected endpoint other than `PATCH /auth/password` while JWT has `mcp=true`. | (silent: route to forced-change screen) |
| `INVALID_CURRENT_PASSWORD` | 401 | — | Self-change with wrong `currentPassword` (not in forced-change state). | "Your current password is wrong." |
| `PASSWORD_TOO_SHORT` | 422 | `{ min: 12 }` | New password < 12 chars. | "Password must be at least 12 characters." |
| `PASSWORD_TOO_LONG` | 422 | `{ max: 128 }` | New password > 128 chars. | "Password must be at most 128 characters." |
| `PASSWORD_BREACHED` | 422 | — | HIBP k-anonymity check returned a match. | "This password has appeared in a public breach. Choose another." |
| `PASSWORD_ON_COMMON_LIST` | 422 | — | Password matched a deny-list entry. | "This password is too common. Choose another." |
| `PASSWORD_BREACH_CHECK_UNAVAILABLE` | 503 | — | HIBP unreachable; failing closed. | "Couldn't verify password safety right now. Please try again." |
| `PASSWORD_REUSES_RESET_VALUE` | 422 | — | Forced-change submitted the same password the super_admin just set. | "Your new password must differ from the password you were given." |
| `DUPLICATE_ENTRY` | 409 | `{ field: "email" }` | `POST /users` with an email that canonically matches an existing one. | "An account with this email already exists." |
| `NOT_FOUND` | 404 | — | `GET/PATCH /users/:id` for a non-existent id. | "That user could not be found." |
| `VALIDATION_FAILED` | 422 | `{ fields: { <field>: [<rule>] } }` | DTO validation failed on shape/type/format. | "Some fields are invalid. Fix them and try again." |
| `CANNOT_SELF_MODIFY` | 403 | — | Super_admin tries to change own `role` or `isActive`, or reset own password via `/users/:id/password`. | "You cannot do that to your own account." |
| `SUPER_ADMIN_FLOOR_VIOLATED` | 403 | — | Role or active-status change would drop active super_admin count below 1. | "At least one super-admin must remain active." |
| `RATE_LIMITED` | 429 | — | Account lockout (≥5 fails in 15 min) OR per-IP throttle exceeded. | "Too many attempts. Please wait a few minutes and try again." |
| `INTERNAL_ERROR` | 500 | — | Unexpected server error. | "Something went wrong on our side. Please try again." |

## Conventions

- HTTP status indicates the **family** of failure; code identifies the **specific** failure.
- `meta` is OPTIONAL and only present when the client needs structured data to render the message (e.g., `{ field: "email" }` for duplicate, `{ min: 12 }` for too-short).
- The server NEVER includes English `message` fields. Any backend-developer hint goes to logs, never to the response.
- Codes are STABLE: renaming is a breaking change requiring a new API version path (Principle XIV).

## Failure-Mode Routing (Angular)

`errorInterceptor` selects behavior by code:

| Code | Action |
|---|---|
| `AUTH_TOKEN_EXPIRED` | Silent `POST /auth/refresh` → retry original request once. On refresh failure → clear state, route to `/login`. |
| `AUTH_REFRESH_INVALID`, `AUTH_TOKEN_INVALID`, `AUTH_TOKEN_MISSING` | Clear state, route to `/login` (preserve intended URL). |
| `MUST_CHANGE_PASSWORD` | Route to `/auth/change-password` (forced-change screen). Block other navigation. |
| `FORBIDDEN`, `CANNOT_SELF_MODIFY`, `SUPER_ADMIN_FLOOR_VIOLATED` | Toast localized message; stay on screen. |
| `RATE_LIMITED` | Toast localized message; on login form, disable submit for 60s. |
| `PASSWORD_*` (policy family) | Surface as form-field error; do NOT toast. |
| `DUPLICATE_ENTRY` | Surface on the `email` field of the create-user form via `meta.field`. |
| `VALIDATION_FAILED` | Surface per-field errors via `meta.fields`. |
| `NOT_FOUND` | Toast localized message; route to user-list. |
| `PASSWORD_BREACH_CHECK_UNAVAILABLE` | Toast; keep form populated. |
| `INTERNAL_ERROR` | Toast localized message; log correlation ID for support. |
