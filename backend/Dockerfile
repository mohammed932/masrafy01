# syntax=docker/dockerfile:1.7
# ---- builder ----
FROM node:22-alpine AS builder

# bcrypt native build deps.
RUN apk add --no-cache python3 make g++

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

# Strip dev deps for runtime.
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:22-alpine AS runtime

RUN apk add --no-cache tini

ENV NODE_ENV=production
WORKDIR /app

# Non-root user (Constitution Principle technical constraint).
USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/assets ./assets
COPY --chown=node:node --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health/ready || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
