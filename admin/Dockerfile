# syntax=docker/dockerfile:1.7
# ---- build ----
# Debian slim (not alpine): Angular's build cache uses `lmdb`, which ships
# glibc prebuilt binaries but NO musl build — on alpine npm tries to compile it
# and fails (no Python). glibc base loads the prebuild, no compile needed.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
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
