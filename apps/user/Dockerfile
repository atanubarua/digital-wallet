# Multi-stage build for the User service. Mirrors apps/auth/Dockerfile
# exactly - see that file for the full rationale on each choice (repo-root
# build context, node:24-slim over alpine, the "node" user in dev, etc.).

# pnpm installed directly via npm, not `corepack enable` - see
# apps/auth/Dockerfile's base stage comment for why (corepack's lazy
# per-user fetch-and-cache hit a reproducible SQLite error at runtime).
FROM node:24-slim AS base
RUN npm install -g pnpm@11.15.0
WORKDIR /workspace

# --- deps: install every workspace package's dependencies -----------------
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/user/package.json apps/user/package.json
RUN pnpm install --frozen-lockfile

# --- dev: source is bind-mounted by docker-compose, not copied here --------
FROM deps AS dev
ENV NODE_ENV=development
ENV HOME=/home/node
USER node
EXPOSE 4002
# See apps/auth/Dockerfile's dev stage comment for the full diagnosis - this
# invokes node_modules/.bin/* directly rather than `pnpm --filter ... `,
# which at runtime triggered a reproducible SQLite "readonly database"
# crash via pnpm's own workspace deps-status self-heal.
CMD ["sh", "-c", "\
  /workspace/packages/contracts/node_modules/.bin/tsc -p /workspace/packages/contracts/tsconfig.json && \
  /workspace/packages/service-kit/node_modules/.bin/tsc -p /workspace/packages/service-kit/tsconfig.json && \
  cd /workspace/apps/user && \
  ./node_modules/.bin/concurrently -k -n tsc,app -c blue,green \
    './node_modules/.bin/tsc -p tsconfig.json --watch --preserveWatchOutput' \
    './node_modules/.bin/nodemon' \
"]

# --- build: compile TypeScript for all workspace packages needed -----------
FROM deps AS build
COPY tsconfig.base.json tsconfig.base.json
COPY packages/service-kit packages/service-kit
COPY packages/contracts packages/contracts
COPY apps/user apps/user
RUN pnpm --filter @wallet/contracts build && pnpm --filter @wallet/service-kit build && pnpm --filter @wallet/user build

# --- prod-deps: production-only dependencies (no dev deps, no TS compiler) -
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/service-kit/package.json packages/service-kit/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/user/package.json apps/user/package.json
RUN pnpm install --frozen-lockfile --prod

# --- prod: compiled output + prod deps only, non-root, minimal image ------
# No pnpm/corepack needed here - the final CMD only runs node dist/main.js.
FROM node:24-slim AS prod
RUN groupadd --gid 1001 nodeapp \
  && useradd --uid 1001 --gid nodeapp --create-home nodeapp
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=prod-deps /workspace/packages/service-kit/node_modules ./packages/service-kit/node_modules
COPY --from=prod-deps /workspace/packages/contracts/node_modules ./packages/contracts/node_modules
COPY --from=prod-deps /workspace/apps/user/node_modules ./apps/user/node_modules
COPY --from=build /workspace/packages/service-kit/dist ./packages/service-kit/dist
COPY --from=build /workspace/packages/service-kit/package.json ./packages/service-kit/package.json
COPY --from=build /workspace/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /workspace/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /workspace/apps/user/dist ./apps/user/dist
COPY --from=build /workspace/apps/user/package.json ./apps/user/package.json

USER nodeapp
EXPOSE 4002
CMD ["node", "apps/user/dist/main.js"]
