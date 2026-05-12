# Phase 0 Research: Admin Authentication & User Management

**Feature**: 001-admin-auth-users
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md)
**Constitution**: [constitution.md](../../.specify/memory/constitution.md) v1.0.0

This document resolves every `NEEDS CLARIFICATION` and records the technology / pattern choices that the implementation plan depends on. Each entry uses the **Decision / Rationale / Alternatives** structure.

---

## R-001 — Angular UI Library

**Decision**: Angular Material 18 (with the Material 3 theming surface and `@angular/cdk` for primitives).

**Rationale**:
- Mature RTL support out of the box (`<html dir="rtl">` + component internals already swap directional padding/margin via logical properties); satisfies Principle IV.
- Native Signals interop in v18 (`MatTableDataSource`, form-control bindings) aligns with Principle XVIII.
- Built on `@angular/cdk` which exposes accessible primitives — focus trap, live announcer, key manager — used directly by our forced-change modal and user-management table (Principle XXIII + FR-036a–d / WCAG 2.2 AA).
- Material 3 tokens map cleanly onto the design-token requirements of Principle XXIV (`--mat-sys-primary` overrides → consume via the same CSS custom properties).
- Angular team maintains it; no risk of abandoned library blocking Angular version upgrades.

**Alternatives considered**:
- **PrimeNG**: rich admin-dashboard widgets (data table, calendar) but RTL coverage is uneven across components, and accessibility is not first-class — several components require manual ARIA. Rejected on Principle IV / FR-036a–d risk.
- **Tailwind + headless (Radix-Angular / HeadlessUI ports / shadcn-equivalent)**: maximum design flexibility, smaller bundle, but every component (date picker, data table, modal, autocomplete) is a build-it-yourself problem; for a multi-screen admin product this is a poor cost/benefit trade. Rejected on velocity grounds.
- **NG-ZORRO**: strong table/form story but its design language is Ant Design — at odds with Masrafy's deep-navy banking brand. Rejected on Principle VIII consistency.

**Locks-in**:
- Theme tokens declared in `admin/src/styles/_tokens.scss` consumed by Material via `mat.define-theme` + custom-property bridge.
- Adds `@angular/material`, `@angular/cdk` to dependencies.

---

## R-002 — Token Transport

**Decision**:
- **Access token**: short-lived JWT (15 min), held in memory in a signal-backed `AuthService` (NOT `localStorage`, NOT `sessionStorage`). Attached to every `/api/admin/*` request by `authInterceptor` as `Authorization: Bearer <accessToken>`.
- **Refresh token**: opaque random string (32 bytes, base64url), stored server-side as a SHA-256 hash on the `RefreshToken` row. Transported in an `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/admin/auth/` cookie with 7-day `Max-Age`. Issued on login, rotated on every successful refresh.

**Rationale**:
- In-memory access token cannot be exfiltrated by XSS to a third-party origin in the same way as `localStorage` (an injected script still has access, but a navigation away wipes it; storage-level tokens persist forever).
- `httpOnly` cookie for the refresh token blocks JS access entirely — XSS cannot steal it.
- `SameSite=Lax` blocks cross-site POST CSRF on the refresh endpoint while still allowing same-origin navigations to re-establish the session.
- `Path=/api/admin/auth/` confines cookie exposure to the auth endpoints; the cookie is never sent to bank-program, application, or matching routes.
- Refresh token rotation defends against replay: each successful refresh issues a new token and revokes the old one. Concurrent refresh from a stolen token will fail (`AUTH_REFRESH_INVALID`) and surface as a security event.
- Storing only `SHA-256(token)` means a DB read leak doesn't yield usable tokens (Principle VI + spec FR-030).

**Alternatives considered**:
- **`localStorage` for both**: simpler, but trivially XSS-stealable. Rejected for an admin product where any breach is platform-critical.
- **Server-side session in Redis only (no JWT)**: also valid, but pushes a Redis dependency onto every protected request. Our matching engine reads do NOT need Redis on the hot path. Rejected to keep the read path Redis-free.
- **JWT for the refresh token too**: increases the leak blast radius (decoded JWT may expose `userId`, role, expiry). Opaque random + DB lookup is strictly tighter.

---

## R-003 — Password Hashing

**Decision**: `bcrypt` with cost factor **12**.

**Rationale**:
- Constitution XIII fixes the floor at `cost ≥ 12`.
- 12 yields ~150–250ms per hash on the deploy hardware (n2-standard-2 class), keeping login p95 well under 500ms.
- bcrypt has the longest production track record of the available scheme families; bugs are well-known and well-mitigated.

**Alternatives considered**:
- **argon2id**: cryptographically stronger and the modern recommendation, but: (1) the `argon2` Node binding is a native dep that complicates Docker multi-arch builds; (2) `bcrypt` is a known quantity for our threat model; (3) constitution explicitly names bcrypt. Revisit when constitution v2.x amends the requirement.
- **scrypt**: weaker tooling story in Node.js (no `@nestjs`-friendly wrapper); rejected on integration cost.

**Implementation note**: Wrap `bcrypt.hash` / `bcrypt.compare` in a small `PasswordHasher` service so a future migration to argon2id is one file.

---

## R-004 — Sliding-Window Lockout Implementation

**Decision**: Redis sorted set per normalized email, keyed `signin:fail:<email>`, score = `Date.now()` (milliseconds), member = unique nonce per attempt. On each failure:

1. `ZADD signin:fail:<email> <now> <nonce>`
2. `ZREMRANGEBYSCORE signin:fail:<email> -inf (now-900000)` (remove entries older than 15 min)
3. `ZCARD signin:fail:<email>` → if ≥ 5, account is locked.
4. `EXPIRE signin:fail:<email> 1800` (auto-evict abandoned sets after 30 min, ≥ 2× window for safety).

On successful sign-in (FR-031a): `DEL signin:fail:<email>`.

**Rationale**:
- Sorted set is the canonical Redis primitive for "count events in a sliding time window."
- Single round-trip per check using a MULTI/EXEC pipeline or `EVAL` script keeps the hot path under 5 ms in p99.
- No background sweeper job needed — `ZREMRANGEBYSCORE` evicts on each write.
- `EXPIRE` floor prevents key buildup from accounts that fail once and never come back.
- Spec FR-031b (lockout window does NOT extend on attempts during active lockout) is satisfied by checking lockout state BEFORE adding the new attempt to the sorted set during active lockout.

**Alternatives considered**:
- **In-process Map**: dies on restart, doesn't survive horizontal scaling; rejected on Principle XV (Redis-backed throttler).
- **Postgres table**: works but adds a write to every failed login, and Postgres locking under burst is heavier than Redis. Rejected on latency.

---

## R-005 — Refresh Token Storage Form

**Decision**: Store **`SHA-256(token)`** as `tokenHash` on the `RefreshToken` row. The raw 32-byte random token is only ever held by the client (in the `httpOnly` cookie). The server hashes the inbound cookie value on every refresh, looks up by `tokenHash`, and rejects on miss.

**Rationale**:
- Refresh tokens are high-entropy random strings (256 bits via `crypto.randomBytes(32)`). They are NOT passwords — they have no need for a slow hash. SHA-256 is the right primitive: fast (no login-flow latency added), and a stolen `tokenHash` cannot be reversed to a usable token without brute-forcing 2^256 (computationally infeasible).
- Satisfies spec FR-030: "stored in a form that, if the database were compromised, would not allow an attacker to use them directly."
- Indexable: `tokenHash` has a unique index → O(1) lookup per refresh.

**Alternatives considered**:
- **bcrypt the refresh token**: adds ~200ms to every refresh — multiplied by silent renewals across the user base — for no security benefit (the input is already 256 bits of entropy). Rejected on perf.
- **Encrypt rather than hash**: introduces a key-management problem for no benefit; reversibility is undesirable. Rejected.

---

## R-006 — JWT Algorithm

**Decision**: **HS256** with a single secret loaded from `JWT_ACCESS_SECRET` env var (≥ 32 bytes, Zod-validated at boot). Refresh tokens are NOT JWTs.

**Rationale**:
- One service (NestJS) issues and verifies tokens — no need for asymmetric verification. HS256 is the simplest, fastest, well-supported choice.
- Secret rotation is operationally feasible (deploy with `JWT_ACCESS_SECRET_PREVIOUS` for a grace period).
- Constitution does not mandate RS256.

**Alternatives considered**:
- **RS256**: warranted if/when a separate verifier service appears (e.g., an Envoy gateway pre-validating tokens). Until then, the key-pair management overhead is unjustified.
- **EdDSA (Ed25519)**: smaller signatures, faster — but Node ecosystem support is rougher and the @nestjs/jwt default still leans RSA/HMAC.

**Token claims (access token)**: `sub` (StaffAccount.id), `role`, `mcp` (must-change-password flag), `iat`, `exp`, `iss` (`masrafy-admin-api`), `aud` (`masrafy-admin-dashboard`). NO PII (name, email) inside JWT — those are fetched via `/me`.

---

## R-007 — Atomic Super_Admin Floor Guard

**Decision**: Wrap any mutation that could change the active super_admin count (`role` update, `isActive` update) in a **PostgreSQL serializable transaction** with this body:

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;
UPDATE staff_account SET role = $1, is_active = $2, updated_at = NOW() WHERE id = $3;
-- FR-023 floor check:
SELECT COUNT(*) FROM staff_account WHERE role = 'SUPER_ADMIN' AND is_active = TRUE;
-- if count < 1: ROLLBACK and return SUPER_ADMIN_FLOOR_VIOLATED;
COMMIT;
```

Repository method catches Postgres serialization-failure errors (`40001`) and retries once with backoff. After two failures, surfaces a `CONFLICT` to the caller.

**Rationale**:
- SERIALIZABLE prevents the concurrent-demotion race that spec edge case #15 describes — two demotions racing each see "1 super_admin remains after my change" via snapshot isolation, both commit, leave 0. SERIALIZABLE serialization-failure on the second commit forces a retry that observes the updated state.
- Retry-once handles legitimate transient conflicts without exposing internal errors to the user.
- Postgres-native — no application-level locks (which are not multi-process safe in a horizontally scaled deployment).

**Alternatives considered**:
- **Advisory lock (`pg_advisory_xact_lock`)**: works, but couples application logic to a specific lock key namespace; SERIALIZABLE is more declarative.
- **Application-level mutex (Redis lock)**: brittle (lock leases, fencing tokens) and overkill for the once-per-day frequency of role changes.

---

## R-008 — HIBP Pwned Passwords Integration (k-anonymity)

**Decision**: HTTPS `GET https://api.pwnedpasswords.com/range/<first5HashHexChars>` with the SHA-1 hash of the candidate password. Header `Add-Padding: true` to defeat traffic analysis. Timeout **1500 ms**; on timeout/network failure, **fail closed** and return `PASSWORD_BREACH_CHECK_UNAVAILABLE` (FR-030b).

**Rationale**:
- k-anonymity sends only 5 hex chars (20 bits of the hash); HIBP returns ~500–800 suffix lines per prefix. The full password and the full hash never leave the backend. Compliant with FR-030b's "never sends the full password or hash."
- HIBP free public API, no auth required, generous rate limits at our scale.
- Fail-closed enforces the spec's threat model: an attacker cannot bypass the breach check by DoS'ing HIBP.

**Alternatives considered**:
- **Self-hosted Pwned Passwords download**: 36 GB; daily refresh job; works offline. Rejected for v1 — operational cost not justified at our scale. Revisit if HIBP rate-limiting becomes painful or sovereignty requires it.
- **No breach check, blocklist only**: weaker — common-list catches ~10k passwords; HIBP catches > 800M unique breached hashes.

---

## R-009 — Common-Password Deny List

**Decision**: Embed top-10,000 password list (from SecLists `10-million-password-list-top-10000.txt`, MIT-equivalent license) into the backend Docker image. Load once at boot into an in-memory `Set<string>` keyed by lowercase, whitespace-trimmed password. O(1) lookup per password submission.

**Rationale**:
- 10,000 entries = ~100 KB in memory. Negligible.
- Faster than HIBP for the common cases (catches "Password123!" before the outbound round-trip).
- License compatible (SecLists is CC-BY-SA / public-domain mix; the top-10k subset is widely redistributed under permissive terms).

**Alternatives considered**:
- **Top 100k or 1M**: marginal additional protection vs. memory + boot cost; rejected.
- **Database table**: needs a query per password set; rejected on latency.

---

## R-010 — Email Normalization

**Decision**: Canonicalize emails before lookup/uniqueness/storage by: **(1)** Unicode NFKC normalization, **(2)** lowercase via `String.prototype.toLowerCase()` (Unicode-aware), **(3)** trim leading/trailing whitespace. Store the canonical form in `email`; preserve the original casing in `email_display` so the UI can show what the super_admin typed.

**Rationale**:
- Satisfies spec FR-002 ("case-insensitive and whitespace-trimmed") + FR-017 + the edge case for Unicode-different emails.
- NFKC handles fullwidth `Ａｄｍｉｎ@example.com` → `admin@example.com`.
- Separate `email_display` preserves human-friendly rendering while uniqueness uses the canonical form.

**Alternatives considered**:
- **Lowercase the local part of every email**: violates the technical email spec (local part is case-sensitive per RFC 5321), but in practice every major MTA treats it case-insensitively. Acceptable for an internal-staff product; revisit if we ever onboard external users via this code path.
- **Plus-addressing collapse (`user+tag@x` → `user@x`)**: not done. Staff might legitimately want distinct `+tag` aliases; the spec gives no guidance, and collapsing them is irreversible loss of information.

---

## R-011 — Forced-Change Endpoint Shape

**Decision**: Single endpoint `PATCH /api/admin/auth/password` accepts two shapes:
- **Standard self-change**: `{ currentPassword: string, newPassword: string }`. Backend verifies `currentPassword` against the stored hash.
- **Forced-change** (when JWT carries `mcp: true`): `{ newPassword: string }`. Backend SKIPS `currentPassword` check (user is already authenticated this session, and the super_admin-set password is by definition known to a second party).

The forced-change variant is gated server-side by the `mcp` claim — the client cannot opt out of verifying its current password.

**Rationale**:
- One endpoint, one DTO union (class-validator `@ValidateIf`) — fewer surfaces, less duplication.
- Server-driven branching (read `mcp` from JWT, not from request body) prevents a client from skipping `currentPassword` when not in forced state.
- After success, the response clears the `mcp` flag in the DB and issues a fresh access token without the `mcp` claim.

**Alternatives considered**:
- **Two endpoints** (`PATCH /password` and `PATCH /password/forced`): clearer at first glance, but doubles the route surface and the test matrix for marginal benefit.

---

## R-012 / R-013 — Testing Approach

**Decision**: No constitutional testing required (Principles XVI + XXVII placeholder post-v1.2.0). Manual quickstart walkthrough is the verification path. Features MAY add tests at their own discretion.

---

## R-014 — Audit Event Storage

**Decision**: Single Postgres table `audit_event` with columns `(id cuid, occurred_at TIMESTAMPTZ, actor_id ID, target_id ID NULL, event_type ENUM, source_ip INET, correlation_id TEXT, payload JSONB)`. Append-only (no UPDATE, no DELETE in code). Index on `(actor_id, occurred_at DESC)` and `(event_type, occurred_at DESC)`.

**Rationale**:
- JSONB payload absorbs event-specific fields (e.g., `from_role`/`to_role` for role-change; `attempt_outcome` for sign-in failures) without per-event-type tables.
- `event_type` ENUM keeps the discrete set declared at the schema level — adding a type requires a migration, which IS the intended review surface.
- Constitution Principle VI: audit events MUST NEVER contain PII or credentials. We enforce this at write-time: a small `AuditEventWriter` service is the only entry point, and it strips known sensitive keys from `payload` before insert.

**Alternatives considered**:
- **Per-event-type tables** (e.g., `auth_login_event`, `user_role_change_event`): rigid; every new event needs a migration AND a new repository.
- **Off-load to a SaaS audit log (e.g., Workos AuditLog, Sumo)**: deferred — premature dependency for v1 internal-only.

---

## R-015 — Bootstrap Seed Idempotency

**Decision**: `prisma/seed.ts` reads `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` from env. Checks for an existing StaffAccount with the canonical email. If present: no-op (logs "seed admin already present, skipping"). If absent: insert with role `SUPER_ADMIN`, `isActive = true`, `mustChangePassword = true` (so the seeded operator changes the bootstrap password on first login).

**Rationale**:
- Idempotent per spec FR-040.
- Setting `mustChangePassword = true` means the bootstrap password (which is in env vars, possibly in plain text in a secret manager) is replaced before the operator can do anything else.
- Logs are PII-free (no email surfaced).

**Alternatives considered**:
- **Always-upsert with password reset**: would silently rewrite a working operator password on every redeploy; rejected.
- **Refuse to start without a seeded admin**: forces a chicken-and-egg in fresh-cluster bring-up; the idempotent seed step is cleaner.

---

## R-016 — Frontend Test Stack

**Decision**: None. Constitution v1.2.0 reduced Principle XXVII to a placeholder. No frontend testing required.

---

## R-017 — Logging & Correlation IDs

**Decision**:
- **Backend**: `pino` via `nestjs-pino`. Each request gets `X-Correlation-Id` (incoming or freshly generated UUID v4) bound to `req.log` via a middleware. All log lines for the request inherit it. Outgoing responses echo the header.
- **Frontend**: `correlationInterceptor` generates a UUID v4 per outgoing request and attaches `X-Correlation-Id`. The same ID is logged via console.debug only in dev builds (production drops console.debug calls per Angular build optimizer).

**Rationale**:
- pino is the fastest production-grade JSON logger in Node; Principle VII names it.
- Correlation IDs glue backend and frontend errors together in observability tooling later.

**Alternatives considered**:
- **W3C `traceparent`**: full OpenTelemetry; great but premature without a tracing collector deployed.

---

## R-018 — i18n Strategy

**Decision**:
- **Angular**: `@angular/localize` with `i18n` attributes in templates, `xliff` translation files for `ar-EG` (primary) and `en-US`. Build-time extraction; runtime locale selection via `LOCALE_ID` provider injected based on user preference (stored in localStorage; default `ar-EG`).
- **Error-code messages**: shared `error-codes.<locale>.json` files keyed by `code`. `ErrorCodeService.toLocalizedMessage(code, meta)` looks up the message, interpolates `{field}`, `{retryIn}`, etc. Same JSON shape as the backend's `errorCodes.ts` constants so adding a code is symmetric (one PR touches three files: `errorCodes.ts`, `error-codes.ar-EG.json`, `error-codes.en-US.json`).

**Rationale**:
- Principle III, IV. Build-time extraction means the dashboard ships with both locale bundles pre-rendered → no runtime fetch latency.
- Co-locating error-code translations in JSON (not in component templates) makes the single-helper rule from Principle III tractable.

**Alternatives considered**:
- **ngx-translate**: runtime-loaded JSON, more flexible at runtime but slower to first paint and worse for a primarily-static admin product. Rejected.

---

## R-019 — Outstanding Items (Deferred from Clarify)

| Item | Status | Resolution |
|---|---|---|
| Uptime SLO | Deferred to ops planning | Recorded as a known omission; non-blocking for v1 implementation |
| Pagination defaults | Resolved here | Default page size **20**, max **100**; **offset-based** for admin lists (per Principle XIV's "offset for admin lists"); response carries `pagination: { page, pageSize, total }` |
| Concurrent-session cap | Resolved here | No cap. Each successful login issues a new refresh-token row; multiple devices coexist. Sign-out revokes only the device's own refresh token. (Spec edge case "Device A / Device B sign-out" already implies this.) |

---

## Cross-Cutting Constraints Honoured

- **Principle III** — every spec-named error code maps to a constant in `backend/src/common/errors/error-codes.ts` and a key in `admin/src/i18n/error-codes.{ar-EG,en-US}.json`. Same-PR rule applies.
- **Principle VI** — no PII (passwords, hashes, raw refresh tokens, full emails) crosses any log boundary. Pino redact paths configured: `req.body.password`, `req.body.newPassword`, `req.body.currentPassword`, `res.headers["set-cookie"]`, `req.headers.authorization`, `req.headers.cookie`.
- **Principle VIII** — login + top-bar styling consumes `--color-brand-primary: #06152D` via the design-token file, never hex-literal in components.
- **Principle XXIII** — UI UX Pro Max skill MUST be invoked at the start of every UI task in this feature (login page, forced-change modal, top bar, user list, user edit modal).

---

## Open Questions (none blocking)

None. All `NEEDS CLARIFICATION` markers resolved. Plan may proceed to Phase 1.
