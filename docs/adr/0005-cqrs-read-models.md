# ADR-0005: CQRS read models for transaction history

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

The write model — the double-entry ledger ([ADR-0003](./0003-double-entry-ledger.md)) — is
normalized and optimized for **correctness**: balanced entries, strict transactions, system
accounts, per-account ordering. But the **read** patterns are very different:

- A customer opening the app wants a fast, human-readable **transaction history**:
  "Sent 1,000 to 017… · fee 5 · balance 4,995", paginated, filterable by type/date.
- A monthly **statement**.
- The admin dashboard wants **monitoring queries** across many accounts.

Serving these directly from the normalized ledger means multi-join queries over an
append-only table on the hot write path — slow, and it couples read load to the correctness-
critical write store.

## Decision

Apply **CQRS**: separate the write model from the read model.

- **Command side:** the ledger service, as designed — normalized, ACID, correctness-first.
- **Query side:** a **Statement/History service** with its own **denormalized** store,
  built by **consuming `LedgerPosted` / `TransferCompleted` events** from Kafka. Each event
  appends pre-formatted, query-optimized history rows (per account, with running context,
  indexed for pagination and filtering).
- The read model is **eventually consistent** with the ledger (typically sub-second) and is
  **fully rebuildable** by replaying the Kafka log.

## Options Considered

### Option A: CQRS with an event-built read model (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Read performance | Excellent (denormalized, indexed) |
| Write isolation | Read load decoupled from ledger |
| Consistency | Eventual (sub-second) |

**Pros:** Fast reads without touching the write path; read schema tuned for UI; rebuildable
from events; scales reads independently. Natural payoff of already having Kafka + outbox.
**Cons:** Eventual consistency (must handle "just now" reads in the UI); extra service and
store; projection code to maintain.

### Option B: Read directly from the ledger (single model)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Read performance | Poor–Medium under load (joins on hot table) |
| Write isolation | None (reads compete with writes) |
| Consistency | Strong |

**Pros:** No extra moving parts; always strongly consistent.
**Cons:** Slow list/statement queries; read load contends with the correctness-critical
writes; UI-shaped queries fight the normalized schema.

### Option C: Read replica of the ledger DB
| Dimension | Assessment |
|---|---|
| Complexity | Low–Medium |
| Read performance | Medium (same normalized schema) |
| Write isolation | Partial (replica offloads reads) |
| Consistency | Eventual (replication lag) |

**Pros:** Offloads read traffic with little code; still eventually consistent, which we
accept anyway.
**Cons:** Same normalized schema → still join-heavy and not UI-shaped; doesn't give a
purpose-built read model. **Complementary, not a substitute** — we can still add replicas for
scale.

## Trade-off Analysis

The key trade-off is **strong consistency vs. read performance + isolation**. We accept
**eventual consistency** for history (a fraction of a second of lag on "recent transactions"
is fine, and the balance itself is returned synchronously from the command side, so the user
still sees their new balance immediately). In exchange we get fast, UI-shaped reads that
don't load the correctness-critical write store, and a read model we can rebuild or re-shape
by replaying events. This is a deliberate, well-understood CQRS trade rather than complexity
for its own sake — and it only exists because Kafka + outbox are already in place.

## Consequences

- **Easier:** fast history/statement queries; independent read scaling; re-shaping the read
  model (replay to rebuild); admin monitoring queries.
- **Harder:** must handle eventual consistency in the UX (e.g., optimistic insert of the
  just-made transaction); projections must be idempotent (at-least-once events); a second
  store to run.
- **Revisit when:** even the read model needs to scale further → add read replicas
  (Option C) on top; or if a read genuinely needs strong consistency → serve that specific
  field from the command side.

## Action Items

1. [ ] Design the denormalized history schema (indexed for pagination + type/date filters).
2. [ ] Build the projector consuming `LedgerPosted` / `TransferCompleted`; make it idempotent.
3. [ ] Support read-model rebuild from a Kafka replay.
4. [ ] Handle recent-write UX (optimistic update / read-your-writes on the client).
