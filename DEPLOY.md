# Masrafy — Droplet Deploy (Docker)

Backend (NestJS) + Admin (Angular) on one Ubuntu 24 droplet, each on its **own
subdomain** with **automatic Let's Encrypt SSL** via a shared `nginx-proxy`.
Domains are env vars (`HOST`). Build manually on each push — no manual
stop/remove needed.

```
                       ┌────────────────────────────┐
  api.example.com  ───▶│                            │───▶ masrafy_backend  :3000
admin.example.com  ───▶│  nginx-proxy + acme (SSL)  │───▶ masrafy_admin    :80
  s3.example.com   ───▶│        (network: web)      │───▶ masrafy_minio    :9000 (optional)
                       └────────────────────────────┘
```

Each app is self-contained and plugs into your **existing** nginx-proxy:
- `backend/` → API + Postgres + Redis (+ optional MinIO via `--profile storage`)
- `admin/`   → static Angular served by nginx

---

## 0. One-time setup

**DNS** — point each subdomain's A record at the droplet IP:
`api.example.com`, `admin.example.com` (and `s3.example.com` if using MinIO).

**Proxy network** — the apps join your nginx-proxy's docker network. Find its name:
```bash
docker inspect <your-proxy-container> -f '{{json .NetworkSettings.Networks}}'
# or
docker network ls
```
Set `PROXY_NETWORK=<that name>` in each app's `.env`. Default assumed is `web`.
That's it — nginx-proxy auto-discovers the app containers via `VIRTUAL_HOST`.

---

## 1. Backend

```bash
cd backend
cp .env.prod.example .env         # set HOST=api.example.com, secrets, DB pwd, CORS, S3...
docker compose build
SEED_ON_START=true docker compose up -d   # first deploy only: seeds super_admin
```
After the first boot, set `SEED_ON_START=false` in `.env` (or just run
`docker compose up -d` again — seed is idempotent anyway).

- DB migrations (`prisma migrate deploy`) run automatically on every container start.
- Manual seed instead of `SEED_ON_START`:
  `docker compose exec backend npx prisma db seed`

### Prod env checklist (easy to miss)

| Var | Why it matters |
|---|---|
| `BOOTSTRAP_ADMIN_ENABLED` | Anything but the literal `false` recreates a super_admin on **every boot** — defaults to `admin@masrafy.com` / `123456` unless `BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD` are set. Separate from the seeded `SEED_ADMIN_*` account. |
| `OTP_DEV_FIXED_CODE` | With `SMS_GATEWAY_PROVIDER=mock` no SMS is sent and the logged code is masked, so phone verification is impossible unless this is a 6-digit value. Honoured in production — empty it before public launch. |
| `GOOGLE_OAUTH_CLIENT_IDS` | Define **once**. A duplicate key later in `.env` silently overrides the earlier one. |
| `CORS_ORIGINS` | Must list the admin origin with scheme, no trailing slash; absent → falls back to `http://localhost:5173` and admin login breaks. |
| `COOKIE_DOMAIN` | Root domain with a leading dot (`.example.com`) so the refresh cookie crosses `api.*` ↔ `admin.*`. |
| `HIBP_DISABLED` | Set `true` only if the droplet has no outbound HTTPS; otherwise the admin password policy check stalls. |

Stale keys (`APPLE_BUNDLE_ID`, removed in constitution v11.0.0) are ignored by the
schema — delete them so `.env` keeps matching `.env.prod.example`.

## 2. Admin

```bash
cd admin
cp .env.prod.example .env         # set HOST=admin.example.com, API_BASE_URL=https://api.example.com/api/admin
docker compose build
docker compose up -d
```
> `API_BASE_URL` is baked into the static bundle at **build time** — change it →
> rebuild. The backend `.env` must list `CORS_ORIGINS=https://admin.example.com`
> and `COOKIE_DOMAIN=.example.com` for the cross-subdomain login cookie.

First cert issuance takes ~30–60s. Watch: `docker logs -f nginx-proxy-acme`.

---

## 3. Rebuild on each push (no stop/remove)

From the app dir after `git pull`:
```bash
docker compose build && docker compose up -d
```
`up -d` recreates **only** the container whose image changed and re-points the
proxy automatically. No `down`, no `stop`, no `rmi`. Reclaim old layers anytime:
```bash
docker image prune -f
```

---

## 4. Object storage (DigitalOcean Spaces)

Default is **DigitalOcean Spaces** (S3-compatible). Create a Space + a Spaces key
pair (DO → API → Spaces Keys), then set in `backend/.env`:
```bash
S3_ENDPOINT_URL=https://fra1.digitaloceanspaces.com   # REGION host — no bucket in it
S3_REGION=fra1
S3_ACCESS_KEY_ID=<spaces access key id>
S3_SECRET_ACCESS_KEY=<spaces secret>
S3_BUCKET=masrafy-storage
S3_FORCE_PATH_STYLE=false                              # → masrafy-storage.fra1.digitaloceanspaces.com/<key>
```
CORS: in the Space settings allow the app origins + `PUT`/`GET`/`HEAD` so
presigned upload/download URLs work from the mobile client and admin.

### Self-hosted object storage (MinIO) — alternative

To self-host instead of Spaces:
```bash
# backend/.env:
#   S3_HOST=s3.example.com
#   S3_ENDPOINT_URL=https://s3.example.com
#   S3_FORCE_PATH_STYLE=true
#   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY  = MinIO root creds
docker compose --profile storage up -d
# create the bucket once via the MinIO console at https://s3.example.com (port 9001 internally)
```

---

## 5. Ops cheatsheet

```bash
docker compose ps                 # status (run in app dir)
docker compose logs -f backend    # tail logs
docker compose exec backend sh    # shell in
docker compose down               # stop app (keeps named volumes / data)
```

Health: `https://api.example.com/api/health/ready` · API docs: `https://api.example.com/api/docs`

**Ports** (per app, localhost-only on the droplet for debugging; public traffic is
443 via the proxy): backend `127.0.0.1:3000`, admin `127.0.0.1:8080`.
