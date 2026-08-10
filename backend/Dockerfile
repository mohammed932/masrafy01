# syntax=docker/dockerfile:1.7
# Debian slim (not alpine): Prisma + OpenSSL 3 "just works" here. Alpine/musl
# makes Prisma mis-detect libssl and load the wrong engine (the
# "Could not parse schema engine response" / libssl error).
# ---- builder ----
FROM node:22-slim AS builder

# bcrypt native build deps + openssl so Prisma picks the right query/schema engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY assets ./assets
RUN npm run build

# Lean runtime deps, but KEEP the prisma CLI + tsx so the container can run
# `prisma migrate deploy` and `prisma db seed` on start. Pinned to the lockfile
# so the schema engine matches the generated client.
RUN npm prune --omit=dev \
 && npm install --no-save --no-audit --no-fund prisma@5.22.0 tsx@4.21.0

# ---- runtime ----
FROM node:22-slim AS runtime

# openssl = required by Prisma engines; tini = PID 1 reaper.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
# The seed scripts import engine/scoring helpers straight from `../src/...` and run
# through tsx, so the TypeScript sources must ship too — without them
# `prisma db seed` (and SEED_ON_START) dies on MODULE_NOT_FOUND.
COPY --chown=node:node --from=builder /app/src ./src
COPY --chown=node:node --from=builder /app/tsconfig.json ./tsconfig.json
COPY --chown=node:node --from=builder /app/assets ./assets
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Non-root user (Constitution Principle technical constraint).
USER node

EXPOSE 3000

# node's global fetch (slim has no wget/curl).
HEALTHCHECK --interval=20s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
