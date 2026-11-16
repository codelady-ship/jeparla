# syntax=docker/dockerfile:1
# Jeparla frontend image (Next.js standalone server) for the production VM (deploy/docker-compose.prod.yml).
# Multi-arch; the VM is arm64. NEXT_PUBLIC_* values are compiled into the client code, so they are build
# arguments. A real-API build prerenders the catalog, so the API must answer during the build
# (scripts/check-api.mjs stops early otherwise); deploy/scripts/deploy.sh builds this image after the API
# is healthy.

# ---- Dependencies ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# HUSKY=0: no git hooks inside the image.
RUN --mount=type=cache,target=/root/.npm HUSKY=0 npm ci --no-audit --no-fund

# ---- Build ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_USE_MOCK=false
ARG NEXT_PUBLIC_SUPPORT_EMAIL=
ARG NEXT_PUBLIC_SUPPORT_URL=
ARG NEXT_PUBLIC_SENTRY_DSN=
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=production
ARG NEXT_PUBLIC_SENTRY_RELEASE=
ARG GOOGLE_SITE_VERIFICATION=
ARG BING_SITE_VERIFICATION=
ARG GITHUB_SHA=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK \
    NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL \
    NEXT_PUBLIC_SUPPORT_URL=$NEXT_PUBLIC_SUPPORT_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
    NEXT_PUBLIC_SENTRY_RELEASE=$NEXT_PUBLIC_SENTRY_RELEASE \
    GOOGLE_SITE_VERIFICATION=$GOOGLE_SITE_VERIFICATION \
    BING_SITE_VERIFICATION=$BING_SITE_VERIFICATION \
    GITHUB_SHA=$GITHUB_SHA \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runtime: standalone server only, non-root ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
