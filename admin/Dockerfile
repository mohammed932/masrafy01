# syntax=docker/dockerfile:1.7
# ---- build ----
# Debian slim (not alpine): Angular pulls native deps (lmdb, esbuild) that have
# NO musl build. glibc + a small toolchain handles them.
FROM node:22-slim AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy ONLY package.json (not the lockfile) and let npm resolve fresh for this
# build's OS/arch. npm has a bug (npm/cli#4828) where a lockfile generated on a
# different platform omits optional native binaries (@rollup/rollup-linux-x64-gnu,
# @lmdb/lmdb-linux-x64, @esbuild/linux-x64) — `npm ci`, and even `npm install`
# reusing that lockfile, then fail at build time. Fresh resolution fixes it.
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .

# Bake the backend API base URL into the production bundle at BUILD time.
# Default keeps the same-origin relative path; for separate subdomains pass e.g.
#   --build-arg API_BASE_URL=https://api.example.com/api/admin
# (the compose file wires this from .env automatically).
ARG API_BASE_URL=/api/admin
RUN sed -i "s#apiBaseUrl: '/api/admin'#apiBaseUrl: '${API_BASE_URL}'#g" src/environments/environment.prod.ts
RUN npm run build:prod

# ---- runtime (static nginx) ----
FROM nginx:1.27-alpine AS runtime
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=build /app/dist/admin/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
