# ADR-0006: PostgreSQL, database-per-service

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

The system decomposes into services (auth, user/KYC, ledger, history, etc.). A central
question is how data is stored: a **shared database** all services read/write, or a
**private database per service**. This choice determines whether service boundaries are real
or cosmetic, and it interacts directly with the modular-monolith-to-microservices path
([ADR-0001](./0001-modular-monolith-to-microservices.md)).

We also need to pick the DBMS. The workload is **transactional money data** requiring ACID
guarantees, row-level locking, and strong consistency on the write path.

## Decision

- **PostgreSQL** as the DBMS for all transactional services (ACID, mature locking/isolation,
  `SERIALIZABLE`, advisory locks, rich indexing, JSONB where useful).
- **Database-per-service**: each service owns its schema; **no service reads another
  service's tables**. Cross-service data flows through **APIs (sync)** or **events (async)**,
  never shared tables.
- In Phase 1 (modular monolith) this is enforced as **separate schemas + a rule that modules
  never cross schema boundaries**, so extraction later is mechanical. On the VPS, per-service
  databases run as separate logical DBs (and/or separate Postgres containers).

## Options Considered

### Option A: Database-per-service on Postgres (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Coupling | Low — services are independently evolvable |
| Consistency | Strong within a service; eventual across (via events) |
| Team familiarity | High (Postgres) |

**Pros:** Real service autonomy; schema changes don't ripple across services; matches the
microservices target; each store can be tuned to its access pattern; clean extraction path
from the modular monolith.
**Cons:** No cross-service SQL joins (must compose via API/events); more databases to run and
back up; distributed data requires events for consistency.

### Option B: Shared database
| Dimension | Assessment |
|---|---|
| Complexity | Low initially |
| Coupling | Very high — the schema becomes a global contract |
| Consistency | Strong |
| Team familiarity | High |

**Pros:** Easy joins; one DB to operate; simple transactions across domains.
**Cons:** Services become coupled through the schema; a migration can break many services;
undermines the entire microservices premise. Anti-pattern for this project's goals.

### Option C: Polyglot persistence (different DB type per service)
| Dimension | Assessment |
|---|---|
| Complexity | High |
| Coupling | Low |
| Consistency | Varies by store |
| Team familiarity | Mixed |

**Pros:** Each service uses the "best" store.
**Cons:** Operational overhead of many DB technologies for one engineer; the money core needs
Postgres anyway; unnecessary variety for this scope. (Redis is already used as a
cache/coordination store — see the architecture doc — but Postgres remains the system of
record.)

## Trade-off Analysis

The trade-off is **ease of cross-domain queries vs. service autonomy**. A shared DB is easier
day one but couples services through a shared schema, which defeats the microservices goal and
makes independent evolution impossible. Database-per-service costs some convenience
(no cross-service joins, more instances) in exchange for genuine autonomy and a clean
extraction path — the right call for a project whose point is to demonstrate real service
boundaries. Postgres is chosen over alternatives because the money workload is fundamentally
relational + ACID, and one well-understood store keeps operational load manageable for a solo
engineer.

## Consequences

- **Easier:** independent schema evolution and deployment; boundaries are enforced by
  construction; tuning per service; the Phase 2/3 extractions.
- **Harder:** composing data across services (API composition or read models via events);
  more databases to provision, migrate, and back up; no cross-service transactions (use sagas
  — see the Add Money flow).
- **Revisit when:** a specific service's access pattern clearly outgrows Postgres (e.g., a
  pure high-throughput cache/search need) → introduce a specialized store for that service
  only, still behind its own boundary.

### Dev-environment note (added 2026-07-20, Phase 0)

The development host has 16GB RAM, with Docker's WSL2 VM capped at ~8GB — running one
**Postgres server process per service** would cost ~50–100MB of idle overhead each, adding up
fast alongside Redpanda, Prometheus, Grafana, and Jaeger in the same budget. For local/dev
Compose, we run **one Postgres container** with **one logical database per service**
(`auth_db`, `user_db`, `ledger_db`, `transaction_db`, `history_db` — see
`infra/docker-compose.yml` and `infra/postgres/init-databases.sh`).

This preserves the actual boundary this ADR is about: no service is ever granted credentials
to another service's database, so there is still no cross-service querying and no shared
schema — only the **physical container** is shared, not the logical isolation. Production
(the VPS deployment) may still run separate Postgres instances per service if resources allow;
this note applies to the dev/demo Compose setup only.

## Action Items

1. [ ] Define per-service schemas; add a lint/CI check forbidding cross-schema access.
2. [ ] Standardize a migration tool per service.
3. [ ] Document the API/event contracts that replace would-be cross-service joins.
4. [ ] Plan backups per database on the VPS.
