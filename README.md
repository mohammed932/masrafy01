# Masrafy

Egyptian fintech loan-comparison marketplace. Three platforms governed by ONE constitution.

| Package | Stack | Status |
|---|---|---|
| [`backend/`](backend/) | NestJS 10 + Prisma 5 + PostgreSQL 16 + Redis 7 | 🟢 Active |
| [`admin/`](admin/) | Angular 18 + Material 18 + Vitest + Playwright | 🟢 Active |
| `mobile/` | Flutter + Clean Architecture | 🟡 Deferred — awaiting Figma |

## Documents

- Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md) v1.0.0
- Active feature: [specs/001-admin-auth-users/](specs/001-admin-auth-users/) — Admin Authentication & User Management
  - [Spec](specs/001-admin-auth-users/spec.md) — what we are building
  - [Plan](specs/001-admin-auth-users/plan.md) — how we are building it
  - [Tasks](specs/001-admin-auth-users/tasks.md) — execution order
  - [Quickstart](specs/001-admin-auth-users/quickstart.md) — operator bring-up
  - [API contract](specs/001-admin-auth-users/contracts/admin-api.openapi.yaml) + [Error codes](specs/001-admin-auth-users/contracts/error-codes.md)
- Agent context: [CLAUDE.md](CLAUDE.md) — daily rules + 28 principles indexed

## Prerequisites

- Node.js 22 LTS (via `.nvmrc`; run `nvm use`)
- Docker + Docker Compose v2
- Git

## Quick start

```bash
nvm use
(cd backend && npm install)
(cd admin && npm install)

docker compose -f docker/compose.dev.yml up -d postgres redis

cd backend
cp .env.example .env   # set JWT_ACCESS_SECRET (≥32 random bytes), SEED_ADMIN_PASSWORD
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev      # → http://localhost:3000  | docs at /api/docs

cd ../admin
npm run gen:api        # regenerate auth.types.ts from OpenAPI
npm start              # → http://localhost:4200
```

Sign in with the seeded super_admin. Forced-change flow runs on first login.

Full walkthrough: [specs/001-admin-auth-users/quickstart.md](specs/001-admin-auth-users/quickstart.md).

## Documented technical choices

- **Admin UI library**: **Angular Material 18** (Principle XXIV — one UI library project-wide).
- **Testing**: no constitutional testing gates (Principles XVI + XXVII reduced to placeholders in constitution v1.2.0). Features choose their own strategy.
- **JWT algorithm**: HS256 (single-service, single-secret; revisit when separate verifier service is introduced).
- **Refresh token storage**: SHA-256 hex of 32-byte random; rotated on every refresh; httpOnly Secure SameSite=Lax cookie scoped to `/api/admin/auth/`.
- **Password storage**: bcrypt cost 12 with `select: false`.
- **Password policy**: NIST-style — length 12–128, breach check via HIBP k-anonymity (fail-closed), common-list deny (top-10k).
- **Sliding-window lockout**: Redis sorted set per canonical email, 5 fails / 15 min, auto-clear (no manual unlock UI).
- **Super_admin floor**: SERIALIZABLE transaction with single retry on Postgres 40001 (Prisma P2034). FR-023 enforced atomically.
- **Brand**: deep navy `#06152D` everywhere via `admin/src/styles/_tokens.scss` CSS custom properties.

## Repository layout

```
masrafy01/
├── .specify/           # Constitution, scripts, templates
├── specs/              # Per-feature spec/plan/tasks
├── backend/            # NestJS service
├── admin/              # Angular dashboard
├── docker/             # compose.dev.yml, compose.test.yml
└── CLAUDE.md           # Agent guidelines
```

## Workflow

1. New feature → `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
2. PR: lint + tsc + build + error-codes parity. (No constitutional test gates post-v1.2.0.)
3. Reviewers cite principle numbers (I–XXVIII) to block PRs.

## Anti-patterns (binding — see constitution Appendix A)

A1–A24 in [.specify/memory/constitution.md](.specify/memory/constitution.md). Reviewers cite by number.

## License

Internal. All rights reserved.
