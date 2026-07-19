# ADR-0008: Per-account ordering via Kafka partitioning

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

Money operations on a **single wallet must not race**. Two concurrent cash-outs on the same
account could both read the balance, both pass the "sufficient funds" check, and both
proceed — overdrawing the wallet. A popular merchant or a busy agent float account is a **hot
account** receiving many concurrent writes. We need per-account serialization **without**
serializing the whole system (which would destroy throughput), and we need it to compose with
at-least-once event delivery ([ADR-0004](./0004-transactional-outbox.md)).

## Decision

Guarantee **ordering per account, parallelism across accounts** using two complementary
mechanisms:

1. **Kafka partitioning by `accountId`.** Events/commands for a given account always hash to
   the **same partition**, and a partition is consumed by **one consumer in a group at a
   time** → all operations for one account are processed **in order**, while different
   accounts spread across partitions and run **in parallel**.
2. **Database-level guard on the write.** The ledger post uses a **row lock / advisory lock on
   the account** (or `SERIALIZABLE` isolation with retry) so the balance check-and-update is
   atomic even if two commands slip through concurrently. This is the correctness backstop;
   partitioning is the throughput/ordering strategy.
3. **Idempotent consumers.** Because delivery is at-least-once, consumers **dedup by event
   id** so re-delivery does not double-apply — turning at-least-once *delivery* into
   exactly-once *effects*.

## Options Considered

### Option A: Partition-by-account + DB lock + dedup (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Throughput | High (parallel across accounts) |
| Correctness | Strong (ordering + DB backstop + dedup) |
| Hot-account handling | Good (bounded to that account's partition) |

**Pros:** Serializes only what must be serialized; scales horizontally by partition;
correctness guaranteed even under redelivery; a clean, explainable answer to the classic
concurrency question.
**Cons:** A single very hot account is bounded by one partition's throughput; partition count
must be chosen with room to grow (repartitioning is disruptive); consumers must implement dedup.

### Option B: Global lock / single-threaded processing
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Throughput | Poor (everything serialized) |
| Correctness | Strong |
| Hot-account handling | N/A (everything is a bottleneck) |

**Pros:** Trivially correct.
**Cons:** No parallelism; unusable at any scale; defeats the "scale & performance" pillar.

### Option C: Optimistic concurrency only (version column, retry)
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium |
| Throughput | High when contention is low |
| Correctness | Strong (retries on conflict) |
| Hot-account handling | Poor (retry storms on hot accounts) |

**Pros:** Simple; great under low contention; no ordering infrastructure.
**Cons:** On hot accounts, conflicting writes cause repeated retries (wasted work, latency
spikes). Useful as a *complement* to the DB backstop, but insufficient alone for hot accounts.

## Trade-off Analysis

The core trade-off is **parallelism vs. ordering**. A global lock gives ordering but no
parallelism; pure optimism gives parallelism but degrades badly on exactly the hot accounts we
care about. Partition-by-account gives **both** — order within an account, parallelism across
accounts — with a DB lock as the correctness backstop and dedup for at-least-once delivery.
The residual limit (one very hot account is capped by a single partition) is acceptable at this
scale and is a precise, honest thing to be able to discuss.

## Consequences

- **Easier:** correct concurrent money handling; horizontal scaling by partition; a strong,
  concrete answer to "how do you prevent double-spend / handle hot wallets."
- **Harder:** choose partition count with growth in mind; all consumers must dedup; a
  single extreme-hot account needs extra thought (e.g., batching, or splitting internal
  sub-accounts) if it ever exceeds one partition's capacity.
- **Revisit when:** an individual account's write rate approaches a single partition's limit,
  or repartitioning is needed → plan a keyed-repartition strategy.

## Action Items

1. [ ] Set `accountId` as the Kafka partition key for account-scoped topics.
2. [ ] Choose an initial partition count with headroom; document the repartition plan.
3. [ ] Implement the ledger write with a per-account lock (or SERIALIZABLE + retry).
4. [ ] Implement consumer dedup (processed-event-id store).
5. [ ] Load-test a hot account with k6; publish the contention results in `docs/perf/`.
