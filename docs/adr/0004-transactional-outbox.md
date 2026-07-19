# ADR-0004: Transactional outbox for reliable event publishing

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

When the ledger posts a transaction, two things must happen: (1) the money change is
committed to Postgres, and (2) a `LedgerPosted` event is published to Kafka so downstream
consumers (history, notifications, fraud) react. These two systems cannot be updated in a
single atomic operation, which creates the classic **dual-write problem**:

- Commit DB, then crash before publishing → money moved but **no event** → history/notifications
  silently missing; read models drift from the ledger.
- Publish, then DB transaction rolls back → **phantom event** for money that never moved.

For a money system this is unacceptable: the event must fire **if and only if** the ledger
transaction committed.

## Decision

Use the **transactional outbox pattern**:

1. In the **same DB transaction** that writes `ledger_entries` + `balances`, insert a row
   into an **`outbox` table** describing the event.
2. A separate **relay** (Debezium CDC on the outbox table, or a simple polling publisher)
   reads new outbox rows and publishes them to Kafka, marking them dispatched.
3. Delivery is **at-least-once**; consumers **dedup by event id** to make *effects*
   exactly-once ([ADR-0008](./0008-per-account-ordering.md)).

Because the outbox insert shares the ledger's transaction, the event exists exactly when the
money moved — no dual write, no distributed transaction.

## Options Considered

### Option A: Transactional outbox (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Consistency | Strong (atomic with the DB write) |
| Operational cost | Low–Medium (a relay process) |
| Team familiarity | Well-documented, recognizable pattern |

**Pros:** No lost/phantom events; no 2PC; works with plain Postgres + Kafka; the relay is
simple; pairs cleanly with the ledger transaction.
**Cons:** Adds an outbox table and a relay to operate; events are at-least-once (consumers
must dedup); slight publish latency (bounded by poll interval or CDC lag).

### Option B: Two-phase commit (XA) across Postgres + Kafka
| Dimension | Assessment |
|---|---|
| Complexity | High |
| Consistency | Strong in theory |
| Operational cost | High |
| Team familiarity | Low; Kafka XA support is poor |

**Pros:** Conceptually atomic across both systems.
**Cons:** Kafka has no first-class XA; coordinator is a availability/latency liability;
blocking protocol; widely discouraged for exactly this use case.

### Option C: Direct dual-write (publish after commit, best-effort)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Consistency | Weak — the failure modes above are real |
| Operational cost | Low |
| Team familiarity | High |

**Pros:** Trivial to implement.
**Cons:** Loses or duplicates events on crash between the two writes; unacceptable for money.

## Trade-off Analysis

The real choice is **outbox vs. 2PC** for atomicity between the DB and Kafka. 2PC is the
"textbook" atomic answer but is impractical (no good Kafka XA, poor availability, blocking).
The outbox achieves the needed guarantee — event iff commit — with ordinary Postgres
transactions and a small relay, at the cost of at-least-once delivery, which we handle with
consumer dedup. This trade (accept at-least-once + dedup, avoid 2PC) is the standard,
defensible answer and a strong talking point.

## Consequences

- **Easier:** guaranteed event/DB consistency; no distributed transaction coordinator;
  events survive crashes and restarts (they sit in the outbox until dispatched).
- **Harder:** operate a relay (or Debezium); **all consumers must be idempotent**; monitor
  outbox backlog / relay lag as a health signal.
- **Revisit when:** publish latency from polling becomes an issue → move from polling to
  Debezium CDC.

## Action Items

1. [ ] Add an `outbox` table; write its insert inside the ledger transaction.
2. [ ] Implement the relay (start with polling; document CDC as an upgrade path).
3. [ ] Establish the consumer dedup convention (store processed event ids).
4. [ ] Emit outbox-backlog and relay-lag metrics to Prometheus.
