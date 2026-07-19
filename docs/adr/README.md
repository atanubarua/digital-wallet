# Architecture Decision Records

This directory records the significant architecture decisions for the bKash-Clone platform.
Each ADR captures the **context**, the **options considered**, the **trade-offs**, and the
**consequences** — the point is to preserve the *reasoning*, so a future reader (or
interviewer) understands not just *what* was chosen but *why*, and what would trigger a revisit.

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](./0001-modular-monolith-to-microservices.md) | Distributed (microservices) architecture from day one | Accepted |
| [0002](./0002-kafka-event-bus.md) | Kafka (Redpanda in dev) as the event bus | Accepted |
| [0003](./0003-double-entry-ledger.md) | Double-entry ledger for money movement | Accepted |
| [0004](./0004-transactional-outbox.md) | Transactional outbox for reliable event publishing | Accepted |
| [0005](./0005-cqrs-read-models.md) | CQRS read models for transaction history | Accepted |
| [0006](./0006-database-per-service.md) | PostgreSQL, database-per-service | Accepted |
| [0007](./0007-backend-language.md) | NestJS/TypeScript primary; Go for the ledger service | Proposed |
| [0008](./0008-per-account-ordering.md) | Per-account ordering via Kafka partitioning | Accepted |
| [0009](./0009-service-to-service-communication.md) | Service-to-service communication (hybrid: async-default, REST sync, gRPC on hot path) | Accepted |
| [0010](./0010-sagas-and-compensation.md) | Sagas & compensating transactions for cross-service consistency | Accepted |
| [0011](./0011-retry-timeout-dead-letter.md) | Retry, timeout, circuit breaker & dead-letter strategy | Accepted |
| [0012](./0012-monorepo.md) | Monorepo for all services, frontends, and infrastructure | Accepted |

## Status values

- **Proposed** — under consideration, not yet committed.
- **Accepted** — the decision is in effect.
- **Deprecated** — no longer recommended, but may still exist in the system.
- **Superseded by ADR-XXXX** — replaced by a later decision.

## Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXXX
**Date:** YYYY-MM-DD
**Deciders:** Who signs off

## Context
The situation and the forces at play (requirements, constraints, non-functionals).

## Decision
The change we are proposing / making.

## Options Considered
### Option A: Name
| Dimension | Assessment |
|---|---|
| Complexity | Low/Med/High |
| Cost | ... |
| Scalability | ... |
| Team familiarity | ... |
**Pros:** ...
**Cons:** ...

## Trade-off Analysis
Key trade-offs with reasoning.

## Consequences
- What becomes easier
- What becomes harder
- What we will need to revisit

## Action Items
1. [ ] step
```
