# Quickstart: Admin Authentication & User Management

**Feature**: 001-admin-auth-users
**Audience**: An operator bringing up a fresh environment OR a developer running the stack locally.

Goal: from a clean checkout, you can sign in to the admin dashboard as the seeded super_admin, change the bootstrap password, and create a second staff account — in under 10 minutes (SC-012).

---

## Prerequisites

- Docker + Docker Compose v2
- Node.js 22 LTS (via `nvm use` from the repo's `.nvmrc`)
- Git

## Repository Layout (post-implementation)

```
masrafy01/
├── backend/                 # NestJS app
│   ├── src/
│   │   ├── auth/            # login, JWT, refresh, logout, me, password
│   │   ├── users/           # admin-users CRUD
│   │   ├── audit/           # AuditEvent writer + queries
│   │   ├── common/          # filters, guards, decorators, error codes, redaction
│   │   ├── infra/           # PrismaService, RedisService, HibpClient
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── (no test/ dir — constitution v1.2.0 removed all testing gates)
├── admin/                    # Angular 18 dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # AuthService, ErrorCodeService, interceptors, guards
│   │   │   ├── features/
│   │   │   │   ├── auth/     # login page, forced-change page, self-change page
│   │   │   │   ├── users/    # list page, create/edit modal
│   │   │   │   └── shell/    # top bar, sidebar
│   │   │   └── app.routes.ts
│   │   ├── i18n/
│   │   │   ├── messages.ar-EG.xlf
│   │   │   ├── messages.en-US.xlf
│   │   │   ├── error-codes.ar-EG.json
│   │   │   └── error-codes.en-US.json
│   │   ├── styles/_tokens.scss
│   │   └── main.ts
│   └── (no tests/ dir — constitution v1.2.0)
├── specs/001-admin-auth-users/
├── docker/
│   ├── compose.dev.yml       # postgres + redis + backend + admin
│   └── compose.test.yml
└── .specify/
```

---

## 1. Clone & install

```bash
git clone <repo>
cd masrafy01
nvm use
(cd backend && npm install)
(cd admin && npm install)
```

## 2. Configure environment

Copy `.env.example` to `.env` in both packages. Minimum required for backend:

```dotenv
# backend/.env
DATABASE_URL=postgresql://masrafy:masrafy@localhost:5432/masrafy_dev
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=<32+ random bytes, base64 encoded>
JWT_ACCESS_TTL_SECONDS=900            # 15 min
REFRESH_TTL_SECONDS=604800            # 7 days

BCRYPT_COST=12

HIBP_TIMEOUT_MS=1500
HIBP_BASE_URL=https://api.pwnedpasswords.com

# Seed (bootstrap super_admin)
SEED_ADMIN_EMAIL=ops@masrafy.local
SEED_ADMIN_NAME=Operations
SEED_ADMIN_PASSWORD=<≥12 chars, NOT on common list, NOT breached>

# Cookies
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false                    # true in prod (set via deployment env)

LOG_LEVEL=debug
NODE_ENV=development
```

Zod validates this at boot. Any missing or malformed var aborts startup with a precise error (Principle's "fail-fast at boot").

Frontend `.env`:

```dotenv
# admin/.env
NG_API_BASE_URL=http://localhost:3000/api/admin
NG_DEFAULT_LOCALE=ar-EG
```

## 3. Start infrastructure

```bash
docker compose -f docker/compose.dev.yml up -d postgres redis
```

Wait for healthchecks (Postgres `pg_isready`, Redis `PING`).

## 4. Migrate + seed

```bash
cd backend
npx prisma migrate dev --name 0001_admin_auth_users_init
npx prisma db seed
```

Seed log:
```
[seed] checking for existing super_admin (ops@masrafy.local)…
[seed] not found — creating super_admin with mustChangePassword=true.
[seed] done.
```

Re-running `prisma db seed` is idempotent (FR-040):
```
[seed] checking for existing super_admin (ops@masrafy.local)…
[seed] already present — no action.
```

## 5. Start backend + admin

```bash
# terminal 1
cd backend && npm run start:dev

# terminal 2
cd admin && npm start
```

- Backend on `http://localhost:3000`
- OpenAPI docs at `http://localhost:3000/api/docs`
- Admin dashboard on `http://localhost:4200`

## 6. First sign-in — bootstrap path

Visit `http://localhost:4200/login` (RTL Arabic by default).

1. Email: `ops@masrafy.local`
2. Password: (whatever you set in `SEED_ADMIN_PASSWORD`)
3. Submit.

Expected: dashboard recognises `mustChangePassword=true` from the JWT `mcp` claim → routes to `/auth/change-password` (forced-change screen, blocks all other nav).

4. Set a new password (≥12 chars, not on common-password list, not breached). Submit.

Expected:
- `passwordHash` rewritten, `mustChangePassword=false`, all refresh tokens revoked, new access token (no `mcp` claim) issued, new refresh-token cookie set.
- Dashboard navigates to the default landing page; top bar shows `Operations` (super_admin).
- Audit events recorded: `AUTH_LOGIN_SUCCESS`, `AUTH_PASSWORD_FORCED_CHANGE_COMPLETED`.

## 7. Create a second staff account

1. Navigate to user management.
2. Click "Create user".
3. Name: `Mariam` · Email: `mariam@masrafy.local` · Role: `ADMIN` · Initial password: (≥12 chars, policy-compliant).
4. Submit.

Expected: row appears in the list with `Status: Active`. Audit event: `ADMIN_USER_CREATED`.

Sign out (top bar → logout). Sign in as `mariam@masrafy.local`. The forced-change screen blocks until the password is changed. After change, `Mariam` lands on the dashboard — but the user-management section is absent from her sidebar (role: ADMIN, not SUPER_ADMIN — FR-012/013).

## 8. Verify role enforcement at API boundary

As `Mariam`, attempt the user-management endpoint directly:
```bash
curl -i -H "Authorization: Bearer <mariam access token>" \
     http://localhost:3000/api/admin/users
```
Expected:
```
HTTP/1.1 403 Forbidden
{"success":false,"code":"FORBIDDEN"}
```

## 9. Verify silent token refresh

In the dashboard's network inspector, throttle the access-token TTL to ~30s via a dev-only env var (`JWT_ACCESS_TTL_SECONDS=30`). Wait 35s, perform any action.
Expected: a single `POST /auth/refresh` round-trip, then the original request succeeds. No login-page flash. (SC-006.)

## 10. Verify lockout

Five wrong-password attempts within 15 min on the same email. The sixth attempt — even with the correct password — returns `RATE_LIMITED`. Wait 15 min from the most recent failed attempt; correct password succeeds and the failure counter resets (SC-009, FR-031).

## 11. Verify super_admin floor

Promote `Mariam` to `SUPER_ADMIN`. Try to demote `ops@masrafy.local` to `ADMIN` from Mariam's session, then try to demote Mariam back from `ops`'s session — concurrently from two browsers. Exactly one demotion succeeds; the other returns `SUPER_ADMIN_FLOOR_VIOLATED` (SC-020).

---

## Test commands

## Test commands

No tests in this codebase. Constitution v1.2.0 dropped all testing
requirements (Principles XVI + XXVII reduced to placeholders). Features
choose their own testing strategy.

## Definition of done (this slice)

- All FR-001 through FR-040 satisfied (incl. FR-023a/b, FR-026a–d, FR-030a–e, FR-031a/b).
- All SC-001 through SC-020 verifiable by manual walkthrough of §1–§11 above.
- Constitution Principles I, III, IV, VI, VII, VIII, IX–XV, XVII–XXVI all PASS at PR time. (XVI + XXVII are placeholders.)

---

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Login form returns `AUTH_INVALID_CREDENTIALS` for the seeded user | Wrong `SEED_ADMIN_PASSWORD` in env | Re-set, re-seed (idempotent) |
| `PASSWORD_BREACH_CHECK_UNAVAILABLE` blocking seed | HIBP unreachable | Whitelist `api.pwnedpasswords.com` egress, or temporarily set `HIBP_DISABLED=true` (DEV ONLY — never in prod) |
| Forced-change loop (after submit, returns to forced-change) | New password matched the just-set bootstrap password | Choose a different value (FR-026c) |
| `Set-Cookie` not received in browser | `COOKIE_SECURE=true` with `http://` origin | Set `COOKIE_SECURE=false` for local HTTP dev |
| Multiple browsers all logged out after one logout | Expected: only the device whose refresh token was used is logged out; if other devices are out too, you probably triggered a password change (which revokes ALL refresh tokens) |
