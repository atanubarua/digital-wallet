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

# Installed directly via npm rather than `corepack enable` - corepack lazily
# fetches+caches the pinned pnpm release into WHICHEVER user's HOME first
# invokes it, per-user, which added an unnecessary first-time network fetch
# at container startup. A directly-installed, globally available pnpm
# binary needs no per-user runtime fetch.
FROM node:24-slim AS base
RUN npm install -g pnpm@11.15.0
WORKDIR /workspace

# --- deps: install every workspace package's dependencies -----------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/auth/package.json apps/auth/package.json
RUN pnpm install --frozen-lockfile

# --- dev: source is bind-mounted by docker-compose, not copied here --------
FROM deps AS dev
ENV NODE_ENV=development
ENV HOME=/home/node
# node:24-slim ships a built-in "node" user at uid 1000, which happens to
# match the typical WSL host user's uid - running as this user (rather than
# the default root) means tsc's compiled output, written into the
# bind-mounted apps/*/dist directories, lands on the HOST owned by the host
# user, not root. Skipping this bit us once already: a prior root-owned
# dev container run left root-owned files in dist/ that the host user then
# couldn't overwrite or delete without a workaround.
USER node
EXPOSE 4001
# service-kit and contracts aren't watched for changes in this commit -
# editing either requires a manual `docker compose restart auth` (or
# rebuilding). Adding a concurrent watcher for them is a straightforward
# follow-up once that friction is actually felt, not before.
#
# Deliberately invokes each package's own node_modules/.bin/* directly
# (tsc, concurrently, nodemon) rather than `pnpm --filter ... build`/
# `pnpm run`. Every container start otherwise re-runs pnpm's own
# workspace-aware "is node_modules in sync with the lockfile" check, which
# self-heals via an internal `pnpm install` whenever the bind-mounted
# /workspace/pnpm-lock.yaml differs at all from what was baked into the
# image (near-guaranteed here, since the host's lockfile keeps evolving as
# this repo is iterated on). That internal install's own workspace-status
# SQLite index resolves to a path under the bind-mounted repo regardless of
# store-dir configuration, and SQLite's file locking doesn't work reliably
# there under Docker Desktop's WSL2 bind-mount implementation - a
# reproducible "attempt to write a readonly database" crash on every start.
# Calling the already-installed binaries directly never invokes the pnpm
# CLI at runtime at all, sidestepping that check entirely. (Build-time
# `pnpm --filter` calls in the deps/build stages above are unaffected - they
# run against COPIED files, never the runtime bind mount, and have never
# shown this failure.)
#
# tsc --watch + nodemon (not NestJS CLI's own `nest start --watch`, whose
# built-in restart does not wait for the previous process to release its
# port before starting a new one - a real EADDRINUSE crash on every file
# change, observed and fixed during Phase 0 verification). nodemon
# correctly waits for the old process's exit first.
CMD ["sh", "-c", "\
  /workspace/packages/contracts/node_modules/.bin/tsc -p /workspace/packages/contracts/tsconfig.json && \
  /workspace/packages/service-kit/node_modules/.bin/tsc -p /workspace/packages/service-kit/tsconfig.json && \
  cd /workspace/apps/auth && \
  ./node_modules/.bin/concurrently -k -n tsc,app -c blue,green \
    './node_modules/.bin/tsc -p tsconfig.json --watch --preserveWatchOutput' \
    './node_modules/.bin/nodemon' \
"]

# --- build: compile TypeScript for all workspace packages needed -----------
FROM deps AS build
COPY tsconfig.base.json tsconfig.base.json
COPY packages/service-kit packages/service-kit
COPY packages/contracts packages/contracts
COPY apps/auth apps/auth
RUN pnpm --filter @wallet/contracts build && pnpm --filter @wallet/service-kit build && pnpm --filter @wallet/auth build

# --- prod-deps: production-only dependencies (no dev deps, no TS compiler) -
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/auth/package.json apps/auth/package.json
RUN pnpm install --frozen-lockfile --prod

# --- prod: compiled output + prod deps only, non-root, minimal image ------
# No pnpm/corepack needed here at all - the final CMD only runs
# `node dist/main.js`, never pnpm.
FROM node:24-slim AS prod
RUN groupadd --gid 1001 nodeapp \
  && useradd --uid 1001 --gid nodeapp --create-home nodeapp
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=prod-deps /workspace/packages/service-kit/node_modules ./packages/service-kit/node_modules
COPY --from=prod-deps /workspace/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=prod-deps /workspace/apps/auth/node_modules ./apps/auth/node_modules
COPY --from=build /workspace/packages/service-kit/dist ./packages/service-kit/dist
COPY --from=build /workspace/packages/service-kit/package.json ./packages/service-kit/package.json
COPY --from=build /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /workspace/apps/auth/dist ./apps/auth/dist
COPY --from=build /workspace/apps/auth/package.json ./apps/auth/package.json

USER nodeapp
EXPOSE 4001
CMD ["node", "apps/auth/dist/main.js"]
