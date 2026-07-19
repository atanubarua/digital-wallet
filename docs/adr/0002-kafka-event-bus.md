# ADR-0002: Kafka (Redpanda in dev) as the event bus

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

The system is event-driven: money movements emit domain events that drive notifications,
history/read-model projections, fraud checks, and external-gateway workflows. We need a
message backbone with:

- **Durable, replayable event log** — read models must be rebuildable by replaying events.
- **Per-key ordering** — all events for one wallet must be processed in order
  ([ADR-0008](./0008-per-account-ordering.md)).
- **At-least-once delivery** with consumer-side dedup for exactly-once *effects*.
- **Consumer lag visibility** for the observability pillar.
- Must run comfortably on a **single VPS via Docker Compose**.

## Decision

Use a **Kafka-compatible log**: **Redpanda** in development and on the demo VPS (single
binary, no ZooKeeper/JVM, Kafka API-compatible), with the option to swap to Apache Kafka
unchanged because the client API is identical.

## Options Considered

### Option A: Kafka / Redpanda (log-based) — chosen
| Dimension | Assessment |
|---|---|
| Complexity | Medium (Redpanda lowers it) |
| Cost (resources) | Medium |
| Ordering | Per-partition ordering — exactly what we need |
| Replay | Native — retained log, rebuild read models any time |
| Team familiarity | Industry-standard; strong signal |

**Pros:** Durable replayable log enables CQRS/event-sourcing; partition-key ordering; huge
ecosystem; consumer-lag metrics out of the box. Redpanda removes the JVM/ZooKeeper weight.
**Cons:** More conceptual overhead than a simple queue; partitions/consumer-groups to reason
about.

### Option B: RabbitMQ (broker/queue)
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium |
| Cost | Low |
| Ordering | Weak once concurrency/requeue involved |
| Replay | Not a log — no native replay |
| Team familiarity | High |

**Pros:** Simple, mature, great for task queues and RPC.
**Cons:** No durable replayable log → poor fit for rebuildable read models / event sourcing;
ordering guarantees erode with redelivery. Weaker fit for the stated goals.

### Option C: NATS JetStream
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Cost | Low |
| Ordering | Per-subject/stream ordering available |
| Replay | Supported |
| Team familiarity | Lower; less common in fintech interviews |

**Pros:** Lightweight, fast, replay-capable.
**Cons:** Smaller ecosystem/tooling; less of a recognizable "industry-standard" signal than
Kafka for the target audience.

### Option D: Cloud queue (SQS/SNS)
Rejected outright: the project runs on a **single self-hosted VPS with no cloud
dependencies**, and a managed queue can't be demoed offline or shown in the infra diagram.

## Trade-off Analysis

The decisive requirement is a **durable, replayable, per-key-ordered log** — CQRS read
models and any future event sourcing depend on replay, and per-wallet ordering depends on
partitioning by key. That rules out RabbitMQ/SQS as the primary bus. Between Kafka and NATS,
**Kafka is chosen for ecosystem, tooling, and interview recognizability**; **Redpanda** is
used to get the Kafka API without the operational weight on a single VPS.

## Consequences

- **Easier:** rebuildable read models; per-account ordering; consumer-lag observability;
  a recognizable, defensible choice to discuss.
- **Harder:** must design topics, partitioning keys, and consumer groups deliberately;
  consumers must be idempotent (dedup) because delivery is at-least-once.
- **Revisit when:** a flow genuinely needs request/reply RPC semantics (may add a lightweight
  synchronous path rather than forcing it onto the log).

## Action Items

1. [ ] Stand up Redpanda in Docker Compose; confirm Kafka client compatibility.
2. [ ] Define the topic taxonomy and partition key (accountId) — see [ADR-0008](./0008-per-account-ordering.md).
3. [ ] Establish a consumer idempotency/dedup convention.
4. [ ] Export consumer-lag metrics to Prometheus.
