# ADR-0012: Monorepo for all services, frontends, and infrastructure

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

The system is distributed from day one ([ADR-0001](./0001-modular-monolith-to-microservices.md)):
many backend services, three frontends (customer app, agent/merchant portal, admin dashboard),
shared TypeScript types, Compose files, and observability configuration. A foundational
question is how this is organized in version control: **one repository** containing everything,
or **one repository per service**.

This is often treated as preference, but it materially affects day-to-day work: how a
cross-cutting change is made, how shared code is consumed, how CI is configured, and how much
overhead each new service costs.

Relevant constraints:
- **One engineer.** Coordination overhead across repos has no upside — there are no separate
  teams to decouple.
- **Shared types.** The frontends and services are all TypeScript
  ([ADR-0007](./0007-backend-language.md)); sharing DTO/event types is highly valuable.
- **Frequent cross-service changes.** Adding an event or changing a contract touches a
  producer, one or more consumers, and often a frontend — in the same logical change.
- **Portfolio visibility.** A reviewer should be able to clone one repo and see the whole system.

## Decision

Use a **monorepo**: all backend services, all three frontends, shared packages, Docker Compose
files, observability config, and `docs/` live in a single Git repository (`digital-wallet`),
public on GitHub.

Structure (indicative):

```
digital-wallet/
  apps/            # deployable units
    gateway/  auth/  user/  ledger/  transaction/  ...
    web-customer/  web-agent/  web-admin/
  packages/        # shared, versioned in-repo
    contracts/     # DTOs, event schemas shared by services + frontends
    service-kit/   # the service template: health, metrics, tracing, logging, graceful shutdown
  infra/           # compose files, observability config, DB init
  docs/            # architecture.md + adr/
```

Independent *deployability* is preserved: each service still has its own Dockerfile, its own
database ([ADR-0006](./0006-database-per-service.md)), and its own image — a monorepo is a
**source-organization** choice, not a coupling of runtime or deployment.

## Options Considered

### Option A: Monorepo (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium (tooling for selective builds) |
| Cross-service changes | Atomic — one commit, one PR, one review |
| Shared code | Trivial — direct in-repo imports |
| CI | One config; needs change-detection to avoid rebuilding everything |
| Solo ergonomics | Excellent |

**Pros:** Atomic cross-cutting changes (contract + producer + consumer + UI in one commit);
shared types without publishing packages to a registry; one clone/one CI config; a reviewer
sees the whole system at once; refactoring across services is straightforward.
**Cons:** CI must detect *which* apps changed or it rebuilds everything; the repo grows large
over time; requires discipline so that "easy to import" doesn't become "everything imports
everything" (which would recreate a distributed monolith).

### Option B: Repo per service
| Dimension | Assessment |
|---|---|
| Complexity | High for a solo dev |
| Cross-service changes | Painful — coordinated PRs across repos |
| Shared code | Needs a published package + version bumps |
| CI | Independent per repo (simpler each, more total) |
| Solo ergonomics | Poor |

**Pros:** Hard boundaries; each service independently versioned; matches how some large orgs
with separate per-service teams operate; smaller CI scope per repo.
**Cons:** A single contract change becomes several coordinated PRs; shared types require
publishing and version-bumping a package for every change; N repos to configure and maintain;
no single place to view the system. The main benefit — **team** decoupling — does not apply to
a solo project.

### Option C: Hybrid (backend monorepo + separate frontend/infra repos)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Cross-service changes | Fine within backend; awkward backend↔frontend |
| Shared code | Backend-internal easy; FE/BE type sharing needs publishing |
| Solo ergonomics | Medium |

**Pros:** Keeps frontends' tooling separate from backend concerns.
**Cons:** Loses end-to-end type sharing between backend contracts and the frontends — one of
the strongest reasons for choosing TypeScript throughout. Splits the system view for no
compensating benefit here.

## Trade-off Analysis

The classic argument for repo-per-service is **team autonomy** — letting independent teams
release on independent cadences without stepping on each other. That benefit is **entirely
absent for a single engineer**, while its costs (coordinated multi-repo PRs, publishing shared
packages, N CI configs) are paid in full and daily. Meanwhile the monorepo's main cost — CI
rebuilding everything — is a solvable tooling problem (change detection / affected-project
builds), not a structural flaw. Given frequent cross-service contract changes and end-to-end
TypeScript type sharing, the monorepo is clearly correct here.

The one genuine risk is that easy imports erode service boundaries into a **distributed
monolith**. This is mitigated by the same discipline already mandated in
[ADR-0006](./0006-database-per-service.md): services communicate only via APIs/events, never by
importing each other's internals — only `packages/contracts` and `packages/service-kit` are
shared.

## Consequences

- **Easier:** atomic cross-cutting changes; shared contracts/types with zero publishing
  overhead; one clone shows the whole system (good for portfolio review); consistent tooling,
  lint, and CI; adding a new service is cheap.
- **Harder:** CI needs change-detection so it doesn't rebuild/redeploy everything on each
  commit; repo size grows; boundary discipline must be enforced deliberately (lint rules on
  allowed imports) since nothing physically prevents cross-service imports.
- **Revisit when:** the project gains multiple independent contributors/teams wanting separate
  release cadences, or CI times become unmanageable even with change detection.

## Action Items

1. [ ] Adopt a monorepo tool/workspace (npm/pnpm workspaces; consider Turborepo or Nx for
       affected-project builds and caching).
2. [ ] Create `packages/contracts` (shared DTOs + event schemas) and `packages/service-kit`
       (the service template).
3. [ ] Add a lint rule forbidding direct imports between `apps/*` — services may only share via
       `packages/*`.
4. [ ] Configure CI change-detection so only affected apps are built, tested, and pushed.
