# Phase 1 Data Model: Admin Authentication & User Management

**Feature**: 001-admin-auth-users
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

This document defines every persistent entity, its fields, validation, relationships, indexes, and state transitions. Backend authority. The Angular dashboard never sees a raw entity — DTOs derived from these entities live in [contracts/](./contracts/).

---

## Entity Overview

| Entity | Table | Lifetime | Mutability |
|---|---|---|---|
| `StaffAccount` | `staff_account` | Indefinite (never hard-deleted; deactivated via `isActive=false`) | Some columns mutable (`name`, `role`, `isActive`, `passwordHash`, `mustChangePassword`, `lastLoginAt`); `id`, `email` immutable post-create |
| `RefreshToken` | `refresh_token` | 7 days from issue OR until rotated/revoked | Append-only revocation (`revokedAt` set once, never cleared) |
| `SignInAttempt` | `sign_in_attempt` | Retained 90 days for audit, then archived/purged | Append-only |
| `AuditEvent` | `audit_event` | Retained indefinitely (per Principle VI append-only) | Append-only (no UPDATE, no DELETE) |

---

## E1. `StaffAccount`

Represents an internal Masrafy team member with access to the admin dashboard. Maps to spec entity **Staff Account**.

### Columns

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK, `cuid()` default | Prisma `@id @default(cuid())` |
| `email` | `VARCHAR(320)` | NOT NULL, UNIQUE | Canonical form: NFKC + lowercase + trim (see R-010). Indexed unique. |
| `emailDisplay` | `VARCHAR(320)` | NOT NULL | Original casing as typed by the super_admin; for UI display only — never used for lookup. |
| `name` | `VARCHAR(120)` | NOT NULL | 2–120 chars after trim; Unicode allowed (Arabic names). |
| `passwordHash` | `VARCHAR(72)` | NOT NULL, `select: false` in Prisma | bcrypt 12-cost output. NEVER returned by any repository method except `findForLogin`. |
| `role` | `STAFF_ROLE` enum | NOT NULL | One of `SUPER_ADMIN`, `ADMIN`, `VIEWER`. |
| `isActive` | `BOOLEAN` | NOT NULL, default `true` | False = deactivated; can never sign in. |
| `mustChangePassword` | `BOOLEAN` | NOT NULL, default `true` | True on create + on super_admin reset; cleared by user via forced-change flow (FR-026a–d). |
| `createdAt` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `updatedAt` | `TIMESTAMPTZ` | NOT NULL, default `now()`, auto-update | `@updatedAt` in Prisma |
| `lastLoginAt` | `TIMESTAMPTZ` | NULL | Set on every successful sign-in (FR-001). NULL until first login. |

### Indexes

- `UNIQUE INDEX idx_staff_account_email (email)` — uniqueness + lookup on every login.
- `INDEX idx_staff_account_active_role (isActive, role)` — drives the FR-023 floor check (`COUNT(*) WHERE role='SUPER_ADMIN' AND isActive=true`).

### Validation (enforced at DTO + repository boundary)

- `email`: RFC 5322-ish (class-validator `@IsEmail`), length ≤ 320, normalized before insert.
- `emailDisplay`: NOT validated separately — derived from the raw inbound email (trimmed only).
- `name`: trim → length 2–120.
- `passwordHash`: NEVER accepted from the API; always computed server-side.
- `role`: must be one of the enum values; further: a user CANNOT set role = `SUPER_ADMIN` via the create endpoint (initial super_admin is seed-only); ROLE-CHANGE flow (FR-021/023a) is the only path to assign `SUPER_ADMIN` post-seed.

### State Transitions

```
[ created ] --(success login + mustChangePassword=true)--> [ active, mcp ]
[ active, mcp ] --(successful forced-change)--> [ active ]
[ active ] --(super_admin reset)--> [ active, mcp ]
[ active ] --(super_admin deactivate)--> [ inactive ]
[ inactive ] --(super_admin reactivate)--> [ active ]
[ inactive ] (no other transitions; cannot sign in)
```

Invariants:
- `isActive=false` MUST NEVER coexist with a usable refresh token (revoke all on deactivate).
- The set of `(role=SUPER_ADMIN, isActive=true)` rows MUST have cardinality ≥ 1 at all times (FR-023). Enforced via SERIALIZABLE transaction in role/active mutations (R-007).

### Constraints in code (NOT in DB)

- A user CANNOT modify their OWN `role` or `isActive` (FR-022) — enforced in the service layer before the repository write.
- Role transitions FROM `SUPER_ADMIN` require the post-mutation floor check (R-007).

---

## E2. `RefreshToken`

Represents a long-lived, server-revocable credential bound to one StaffAccount used to obtain new access tokens. Maps to spec entity **Session Renewal Credential**.

### Columns

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK, `cuid()` default | |
| `userId` | `VARCHAR(30)` | NOT NULL, FK → `staff_account.id`, ON DELETE CASCADE | FK index (Principle XI). |
| `tokenHash` | `CHAR(64)` | NOT NULL, UNIQUE | SHA-256 hex of the raw 32-byte token (R-005). |
| `issuedAt` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `expiresAt` | `TIMESTAMPTZ` | NOT NULL | issuedAt + 7 days. |
| `revokedAt` | `TIMESTAMPTZ` | NULL | Non-null = token cannot be exchanged. Set on logout, rotation, deactivation, password change. |
| `rotatedFromId` | `VARCHAR(30)` | NULL, FK → `refresh_token.id`, ON DELETE SET NULL | Audit trail of rotation chains. |
| `userAgent` | `VARCHAR(500)` | NULL | Truncated UA at issue time, for support diagnostics. NOT used for auth. |
| `sourceIp` | `INET` | NULL | Issue-time IP. Diagnostic only. |

### Indexes

- `UNIQUE INDEX idx_refresh_token_hash (tokenHash)` — lookup on every refresh.
- `INDEX idx_refresh_token_user_active (userId, revokedAt, expiresAt)` — revoke-all-for-user query.

### Validation

- `tokenHash`: 64 hex chars (SHA-256).
- `expiresAt`: must be > `issuedAt`.

### State Transitions

```
[ issued ] --(presented in /refresh AND still valid)--> [ rotated ]  -- old.revokedAt = now(); new row issued
[ issued ] --(logout)--> [ revoked ]
[ issued ] --(user deactivated)--> [ revoked (all rows for user) ]
[ issued ] --(password change OR reset)--> [ revoked (all rows for user) ]
[ issued ] --(7 days elapsed)--> [ expired ]  -- no row mutation; lazily ignored on next presentation
```

Invariants:
- A presented `tokenHash` must satisfy `revokedAt IS NULL AND expiresAt > NOW()` to be acceptable for rotation.
- On rotation: new row inserted FIRST (transaction), THEN old row's `revokedAt` is set. The new row's `rotatedFromId` references the old row.
- Concurrent refresh with the same token MUST fail one of the two requests (UNIQUE constraint on the rotation chain enforces ordering). Surface as `AUTH_REFRESH_INVALID` to whichever request loses the race.

---

## E3. `SignInAttempt`

Records every sign-in attempt for lockout enforcement (FR-031) and post-hoc review. Maps to spec entity **Sign-In Attempt Record**.

### Columns

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK, `cuid()` default | |
| `userId` | `VARCHAR(30)` | NULL, FK → `staff_account.id`, ON DELETE SET NULL | NULL when the submitted email does not match any account (still recorded for IP-based throttling). |
| `emailAttempted` | `VARCHAR(320)` | NOT NULL | Canonical form. Stored so that "no such email" attempts still surface in audit by-attempted-email. |
| `attemptedAt` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `outcome` | `ATTEMPT_OUTCOME` enum | NOT NULL | One of `SUCCESS`, `WRONG_CREDENTIALS`, `ACCOUNT_INACTIVE`, `LOCKED_OUT`. |
| `sourceIp` | `INET` | NOT NULL | For IP-throttle (FR-032). |
| `userAgent` | `VARCHAR(500)` | NULL | Truncated. |
| `correlationId` | `VARCHAR(36)` | NOT NULL | UUID v4 from the request. |

### Indexes

- `INDEX idx_sign_in_attempt_email_time (emailAttempted, attemptedAt DESC)` — fallback lockout-window query if Redis is unavailable.
- `INDEX idx_sign_in_attempt_ip_time (sourceIp, attemptedAt DESC)` — IP-bucket throttle queries.
- `INDEX idx_sign_in_attempt_user_time (userId, attemptedAt DESC)` — audit-by-user.

### Validation

- `outcome`: discrete enum; widening requires a migration (intended review surface).

### Retention

- 90 days at default. Older rows archived/purged by a future cron job (not in scope for this feature).

### Relation to Redis lockout

- Postgres is the **durable** record of attempts.
- Redis sorted set is the **operational** lockout counter (R-004).
- The two MUST agree: every write to Redis is preceded by a write to Postgres in the same service method, and Redis is recomputed from Postgres on a cold start (boot-time `redis-flushdb` is forbidden in production).

---

## E4. `AuditEvent`

Append-only record of every security-relevant action. Maps to spec entity **Audit Event**.

### Columns

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `VARCHAR(30)` | PK, `cuid()` default | |
| `occurredAt` | `TIMESTAMPTZ` | NOT NULL, default `now()` | |
| `actorId` | `VARCHAR(30)` | NULL, FK → `staff_account.id`, ON DELETE SET NULL | NULL for system events (e.g., seed). |
| `targetId` | `VARCHAR(30)` | NULL, FK → `staff_account.id`, ON DELETE SET NULL | NULL when the event is about the actor themselves (login, logout, self-password-change). |
| `eventType` | `AUDIT_EVENT_TYPE` enum | NOT NULL | See enum below. |
| `sourceIp` | `INET` | NULL | |
| `correlationId` | `VARCHAR(36)` | NOT NULL | |
| `payload` | `JSONB` | NOT NULL, default `'{}'` | Event-specific structured data; MUST NOT contain passwords, hashes, or token material. |

### `AUDIT_EVENT_TYPE` enum

| Value | When emitted | Payload |
|---|---|---|
| `AUTH_LOGIN_SUCCESS` | Successful sign-in | `{ }` |
| `AUTH_LOGIN_FAILURE` | Failed sign-in (any outcome other than success) | `{ outcome: "WRONG_CREDENTIALS" \| "ACCOUNT_INACTIVE" \| "LOCKED_OUT" }` |
| `AUTH_LOGOUT` | User-initiated sign-out | `{ }` |
| `AUTH_TOKEN_REFRESHED` | Successful refresh-token rotation | `{ rotatedFromId: "..." }` |
| `AUTH_PASSWORD_CHANGED` | Self-initiated password change | `{ forcedChange: false }` |
| `AUTH_PASSWORD_FORCED_CHANGE_COMPLETED` | First successful set after `mustChangePassword=true` | `{ forcedChange: true }` |
| `ADMIN_USER_CREATED` | Super_admin creates a staff account | `{ targetEmail: "...", targetRole: "..." }` |
| `ADMIN_USER_UPDATED` | Super_admin edits name, role, or active status | `{ changedFields: ["name","role","isActive"] }` |
| `ADMIN_USER_DEACTIVATED` | Super_admin sets `isActive=false` | `{ }` |
| `ADMIN_USER_ROLE_CHANGED` | Super_admin changes another user's role | `{ fromRole: "...", toRole: "..." }` |
| `ADMIN_USER_PASSWORD_RESET` | Super_admin resets another user's password | `{ }` |

`payload` field-level redaction is enforced by an `AuditEventWriter` service that filters known sensitive keys (`password`, `currentPassword`, `newPassword`, `passwordHash`, `tokenHash`, `accessToken`, `refreshToken`) before INSERT.

### Indexes

- `INDEX idx_audit_event_actor_time (actorId, occurredAt DESC)`
- `INDEX idx_audit_event_target_time (targetId, occurredAt DESC)`
- `INDEX idx_audit_event_type_time (eventType, occurredAt DESC)`

### Validation

- `eventType`: discrete enum; widening requires a migration.
- `payload`: free-form JSONB but validated at write-time to reject any key in the sensitive-key blocklist.

### Retention

- Indefinite. No `DELETE` permission on this table in the application's DB role (separation of duty).

---

## Enum Reference (Prisma schema)

```prisma
enum StaffRole {
  SUPER_ADMIN
  ADMIN
  VIEWER
}

enum AttemptOutcome {
  SUCCESS
  WRONG_CREDENTIALS
  ACCOUNT_INACTIVE
  LOCKED_OUT
}

enum AuditEventType {
  AUTH_LOGIN_SUCCESS
  AUTH_LOGIN_FAILURE
  AUTH_LOGOUT
  AUTH_TOKEN_REFRESHED
  AUTH_PASSWORD_CHANGED
  AUTH_PASSWORD_FORCED_CHANGE_COMPLETED
  ADMIN_USER_CREATED
  ADMIN_USER_UPDATED
  ADMIN_USER_DEACTIVATED
  ADMIN_USER_ROLE_CHANGED
  ADMIN_USER_PASSWORD_RESET
}
```

---

## Relationships

```
StaffAccount 1 ──< many RefreshToken         (userId, ON DELETE CASCADE)
StaffAccount 1 ──< many SignInAttempt        (userId, ON DELETE SET NULL)
StaffAccount 1 ──< many AuditEvent as actor  (actorId, ON DELETE SET NULL)
StaffAccount 1 ──< many AuditEvent as target (targetId, ON DELETE SET NULL)
RefreshToken    1 ── 0..1 RefreshToken       (rotatedFromId, self-referential, ON DELETE SET NULL)
```

`StaffAccount` is never hard-deleted in the application; CASCADE on `RefreshToken` is a safety net for one-off cleanup scripts only.

---

## Cross-Entity Invariants (enforced in services, not DB)

1. **Floor invariant**: `COUNT(staff_account WHERE role='SUPER_ADMIN' AND isActive=true) ≥ 1` (FR-023). Enforced via SERIALIZABLE transaction in the role/active mutation path.
2. **Deactivation cascade**: Setting `isActive=false` MUST be accompanied by `UPDATE refresh_token SET revokedAt=NOW() WHERE userId=? AND revokedAt IS NULL` in the same transaction (FR-007 / "Device A signed-out from Device B" edge case).
3. **Password change cascade**: Any change to `passwordHash` (self-change OR super_admin reset) MUST revoke all of the affected user's refresh tokens in the same transaction. This is what makes "sign me out everywhere" implicit in a password reset.
4. **MCP precedence**: A user with `mustChangePassword=true` MAY sign in (gets an access token) but the access token carries `mcp=true` and every endpoint OTHER than `PATCH /api/admin/auth/password` MUST reject with `MUST_CHANGE_PASSWORD` (HTTP 403, distinct code so the client can route to the forced-change screen).
5. **Audit completeness**: Every mutation in services (login attempt outcomes, refresh, logout, password change, user CRUD, role change, password reset, deactivation) emits the corresponding `AuditEvent` IN THE SAME TRANSACTION as the mutation; if the audit write fails, the mutation rolls back.

---

## Migration Plan (single Prisma migration, descriptive name)

Migration name: `0001_admin_auth_users_init`

Order:
1. Create enums (`StaffRole`, `AttemptOutcome`, `AuditEventType`).
2. Create `staff_account` table + unique index on `email` + composite index on `(isActive, role)`.
3. Create `refresh_token` table + unique index on `tokenHash` + composite index on `(userId, revokedAt, expiresAt)`.
4. Create `sign_in_attempt` table + three indexes.
5. Create `audit_event` table + three indexes.

All foreign keys named explicitly. All `TIMESTAMPTZ`. All primary keys `cuid`. All columns NOT NULL unless explicitly allowed NULL above.
