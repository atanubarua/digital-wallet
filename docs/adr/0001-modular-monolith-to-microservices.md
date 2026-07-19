# ADR-0001: Distributed (microservices) architecture from day one

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

> **Revision note (2026-07-19):** This ADR originally recommended a *modular-monolith-first*
> approach, decomposed into services over time, to optimize for shipping speed. That was
> revised once the project's primary goal was clarified: **this is a learning vehicle for
> distributed systems and system design, not a product with a delivery deadline.** Under that
> goal the original recommendation was wrong — see the trade-off analysis. The rejected
> monolith-first option is retained below because the reasoning is instructive.

## Context

The explicit purpose of this project is to **learn distributed systems and system design** to
the depth expected of a senior/principal engineer. There is **no delivery deadline** and no
business/MVP pressure — the builder has stated that 3–4 months or more is acceptable.

The hard, valuable lessons of distributed systems live *at and beyond the network boundary*:
service-to-service communication, partial failure, timeouts and retries, eventual
consistency, event ordering, idempotency across processes, distributed tracing, sagas and
compensation, and operating many moving parts. A monolith — even a well-structured modular
one — hides almost all of these behind in-process function calls and a single database
transaction.

## Decision

Build the system as **distributed microservices from day one**: separate deployable services,
each with its **own database** ([ADR-0006](./0006-database-per-service.md)), communicating
over the **network** (sync) and via **Kafka events** (async), from the very first feature.

Crucially, *distributed from day one* describes the **topology, not the pace**. Services are
still added **incrementally**, one capability at a time, so each distributed concept is learned
deliberately:

- **Phase 0** establishes the distributed *substrate* (Kafka, per-service DBs, gateway,
  observability, a service template) with a trivial two-service + one-event "hello" flow — so
  the plumbing is understood before real domain logic rides on it.
- Each later phase adds a service (or a pattern) across real network/DB boundaries, and names
  the specific distributed-systems concept it teaches.

The first "money actually moves" demo therefore arrives **later** than it would in a monolith
(end of Phase 2 rather than Phase 1). That cost is **explicitly accepted** in exchange for
practising the distributed problems from the start.

## Options Considered

### Option A: Distributed microservices from day one (chosen)
| Dimension | Assessment |
|---|---|
| Learning value | Highest — the distributed problems are faced immediately |
| Time to first demo | Slower (substrate first) |
| Complexity | High from the start (accepted) |
| Fit to stated goal | Exact |

**Pros:** Directly exercises the target skills (network failure, eventual consistency, sagas,
tracing, ops of many services); the end-state topology is real from day one; no later "big
refactor"; matches the senior/principal learning objective precisely.
**Cons:** Heavy upfront setup; distributed debugging before the domain is fleshed out; more
to operate throughout; no free cross-service ACID transaction — sagas from early on.

### Option B: Modular monolith → microservices (originally recommended, now rejected)
| Dimension | Assessment |
|---|---|
| Learning value | Defers the distributed lessons by weeks/months |
| Time to first demo | Fast (Phase 1 ships end-to-end) |
| Complexity | Grows incrementally |
| Fit to stated goal | Poor — postpones the very thing being learned |

**Pros:** Fastest to a working feature; simplest early debugging; real ACID across modules
early; lowest risk of *not shipping*.
**Cons:** Hides network boundary, partial failure, and eventual consistency behind in-process
calls — i.e., **postpones the curriculum**. Optimizes for a deadline that does not exist here.

### Option C: Permanent monolith
Rejected: does not teach distributed systems at all; fails the project's sole purpose.

## Trade-off Analysis

The decision hinges entirely on **what is being optimized**. If the goal were shipping a
product on a deadline, Option B wins decisively (and that was the original recommendation).
But the goal is **learning distributed systems with no time pressure**, which inverts the
calculus: the "cost" of Option A (facing distributed complexity immediately) *is the benefit*,
and the "benefit" of Option B (hiding that complexity to ship faster) *is the cost*. With no
deadline, the risk that Option B mitigates — not finishing — is not worth paying for by
deferring the core learning. Option A is therefore the correct choice **for this goal**.

## Consequences

- **Easier:** learning the real distributed-systems concepts from the outset; the target
  topology exists immediately; no future monolith-splitting phase; a portfolio that
  demonstrates distributed design end to end.
- **Harder:** every cross-service flow needs sagas/events (no shared ACID transaction —
  see the Add Money saga); more services to run, debug, deploy, and observe from day one;
  the first end-to-end money demo is deferred to Phase 2; disciplined Phase 0 investment in a
  service template and observability is required so per-service overhead stays manageable.
- **Revisit when:** operational overhead of many services on a single VPS becomes the
  bottleneck to *learning* (e.g., too much time on ops, not enough on concepts) → consider
  consolidating the least-interesting services, or moving to k3s to standardize operations.

## Related decisions that now become day-one concerns

Making the system distributed from the start pulls several patterns forward:
- **Service-to-service communication** (sync REST/gRPC vs async events) — candidate for a new ADR.
- **Sagas + compensating transactions** for cross-service consistency — candidate for a new ADR.
- **Retry / timeout / dead-letter strategy** for inter-service and consumer failures — candidate for a new ADR.
- Existing ADRs [0002](./0002-kafka-event-bus.md) (Kafka), [0004](./0004-transactional-outbox.md)
  (outbox), [0006](./0006-database-per-service.md) (DB-per-service), and
  [0008](./0008-per-account-ordering.md) (per-account ordering) are all in effect from Phase 0/1
  rather than being introduced later.

## Action Items

1. [ ] Build a **service template** in Phase 0 (health/readiness, metrics, tracing, structured
       logs, graceful shutdown, Kafka producer/consumer wiring) so new services are cheap.
2. [ ] Stand up the full distributed substrate in Phase 0 (Redpanda, per-service Postgres,
       Redis, gateway, Prometheus/Grafana/Jaeger/Loki) with a trivial 2-service + 1-event demo.
3. [ ] Write ADRs for service-to-service communication, sagas, and retry/DLQ strategy.
4. [ ] Invest early in **distributed tracing** so cross-service debugging is tractable.
