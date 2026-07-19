# digital-wallet — A Distributed Mobile Financial Service (MFS) Platform

A closed-loop stored-value wallet platform — modelled on the **bKash** mobile financial
service — built as **event-driven microservices**, with a correctness-first double-entry
ledger at its core.

> **Disclaimer:** An **independent, educational project** built for system-design and
> distributed-systems practice. It is **not affiliated with, endorsed by, or connected to
> bKash Limited** in any way. No real money is involved; all external integrations
> (bank, card, SMS, mobile operators) are simulated.

**Status:** 🚧 Phase 0 — building the distributed substrate. Not yet functional.

---

## Why this project exists

This is a deliberate study of production distributed-systems patterns, built end to end:
money correctness, scale, security, and operability. Every significant decision is recorded
as an **Architecture Decision Record** explaining the options considered and the trade-offs —
see [`docs/adr/`](./docs/adr/).

## Architecture

Full design document: **[`docs/architecture.md`](./docs/architecture.md)** (C4 context,
container, and component diagrams).

**Core patterns**

| Pattern | Purpose | ADR |
|---|---|---|
| Double-entry ledger | Money is never created or destroyed; fully auditable | [0003](./docs/adr/0003-double-entry-ledger.md) |
| Transactional outbox | Event published **iff** the DB transaction committed — no dual-write | [0004](./docs/adr/0004-transactional-outbox.md) |
| CQRS read models | Writes optimized for correctness, reads for speed | [0005](./docs/adr/0005-cqrs-read-models.md) |
| Per-account partitioning | Ordering within an account, parallelism across accounts | [0008](./docs/adr/0008-per-account-ordering.md) |
| Sagas + compensation | Cross-service consistency without distributed transactions | [0010](./docs/adr/0010-sagas-and-compensation.md) |
| Retry / circuit breaker / DLQ | Bounded, observable failure handling | [0011](./docs/adr/0011-retry-timeout-dead-letter.md) |

## Tech stack

- **Services:** NestJS + TypeScript (Ledger possibly Go — [ADR-0007](./docs/adr/0007-backend-language.md))
- **Event bus:** Kafka (Redpanda) · **Datastores:** PostgreSQL (DB per service), Redis
- **Frontends:** Next.js + React + TypeScript — customer app, agent/merchant portal, admin dashboard
- **Observability:** Prometheus, Grafana, OpenTelemetry/Jaeger, Loki
- **Infra:** Docker Compose on a single VPS · CI/CD via GitHub Actions

## Getting started

> Requires Docker (WSL2 backend on Windows). Detailed setup lands with Phase 0.

```bash
docker compose up
```

## Roadmap

| Phase | Focus | Distributed concept learned |
|---|---|---|
| 0 | Distributed substrate, service template, observability | Service topology, tracing across processes |
| 1 | Auth + User/KYC across the network | Service-to-service auth, correlation IDs |
| 2 | **Money core** — ledger, Send Money, outbox | Distributed transactions, idempotency, ordering |
| 3 | CQRS history, cash in/out, agent portal | Eventual consistency, read-model replay |
| 4 | Add Money saga, external mocks, merchant | Sagas, compensation, timeouts, DLQ |
| 5 | Fraud engine, admin dashboard | Stream processing |
| 6 | Load + **chaos testing** | Resilience, backpressure, graceful degradation |
| 7 | Diagrams, runbooks, failure postmortems | Communicating system design |

## License

MIT — see [`LICENSE`](./LICENSE).
