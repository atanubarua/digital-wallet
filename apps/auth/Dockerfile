# Multi-stage build for the Auth service. Build context is the REPO ROOT
# (see infra/docker-compose.yml's `context: ..`), not this directory - a
# pnpm workspace needs the root lockfile and every workspace package's
# manifest to resolve dependencies correctly, so Docker needs to see them.
#
# Base image is node:24-slim (Debian/glibc), not node:24-alpine (musl).
# Nothing in THIS commit needs native addons, but Auth's real logic
# (docs/architecture.md 6.3: Argon2-hashed PINs) will need one soon, and
# musl/glibc native-addon mismatches are a classic, easy-to-hit Docker
# footgun. Choosing glibc now avoids rediscovering this the hard way later.
# This trades a bit of image DISK size, not running-process RAM (the 8GB
# Docker budget we're tracking is about the latter).

FROM node:24-slim AS base
RUN corepack enable
WORKDIR /workspace

# --- deps: install every workspace package's dependencies -----------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY apps/auth/package.json apps/auth/package.json
RUN pnpm install --frozen-lockfile

# --- dev: source is bind-mounted by docker-compose, not copied here --------
FROM deps AS dev
ENV NODE_ENV=development
# node:24-slim ships a built-in "node" user at uid 1000, which happens to
# match the typical WSL host user's uid - running as this user (rather than
# the default root) means tsc's compiled output, written into the
# bind-mounted apps/*/dist directories, lands on the HOST owned by the host
# user, not root. Skipping this bit us once already: a prior root-owned
# dev container run left root-owned files in dist/ that the host user then
# couldn't overwrite or delete without a workaround.
USER node
EXPOSE 4001
# service-kit isn't watched for changes in this commit - editing it requires
# a manual `docker compose restart auth` (or rebuilding). Adding a concurrent
# watcher for it is a straightforward follow-up once that friction is
# actually felt, not before.
#
# start:dev runs `tsc --watch` (compiles) + `nodemon` (restarts the process
# on compiled-output changes) via `concurrently` - NOT NestJS CLI's own
# `nest start --watch`, whose built-in restart does not wait for the
# previous process to release its port before starting a new one (a real
# EADDRINUSE crash on every file change, observed and fixed during Phase 0
# verification). nodemon correctly waits for the old process's exit first.
CMD ["sh", "-c", "pnpm --filter @wallet/service-kit build && pnpm --filter @wallet/auth start:dev"]

# --- build: compile TypeScript for both packages ---------------------------
FROM deps AS build
COPY tsconfig.base.json tsconfig.base.json
COPY packages/service-kit packages/service-kit
COPY apps/auth apps/auth
RUN pnpm --filter @wallet/service-kit build && pnpm --filter @wallet/auth build

# --- prod-deps: production-only dependencies (no dev deps, no TS compiler) -
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY apps/auth/package.json apps/auth/package.json
RUN pnpm install --frozen-lockfile --prod

# --- prod: compiled output + prod deps only, non-root, minimal image ------
FROM node:24-slim AS prod
RUN corepack enable \
  && groupadd --gid 1001 nodeapp \
  && useradd --uid 1001 --gid nodeapp --create-home nodeapp
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=prod-deps /workspace/packages/service-kit/node_modules ./packages/service-kit/node_modules
COPY --from=prod-deps /workspace/apps/auth/node_modules ./apps/auth/node_modules
COPY --from=build /workspace/packages/service-kit/dist ./packages/service-kit/dist
COPY --from=build /workspace/packages/service-kit/package.json ./packages/service-kit/package.json
COPY --from=build /workspace/apps/auth/dist ./apps/auth/dist
COPY --from=build /workspace/apps/auth/package.json ./apps/auth/package.json

USER nodeapp
EXPOSE 4001
CMD ["node", "apps/auth/dist/main.js"]
