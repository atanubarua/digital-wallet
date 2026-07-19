# ADR-0003: Double-entry ledger for money movement

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

This is a real-money system. The single most important property is that **money is never
created or destroyed by a bug** — every unit is accounted for, balances are always
explainable, and the system can prove its own integrity. We also need an **auditable
history** of every movement (for the statement feature, dispute handling, and the nightly
reconciliation job).

A naive design ("a `balance` column we increment/decrement") makes it trivially easy to lose
money to a partial failure, a race, or a bad migration, and leaves no trail to reconstruct
what happened.

## Decision

Model all money movement as **double-entry bookkeeping**:

- An **append-only `ledger_entries` table**. Each entry is a debit or credit against an
  account, tagged with a `transaction_id`. Entries are **never updated or deleted**.
- Every transaction produces **balanced entries that sum to zero** (Σ debits = Σ credits),
  including fee legs (customer debit, fee/revenue credit).
- **Accounts** include user wallets, agent float accounts, merchant accounts, and internal
  system accounts (fees/revenue, external-settlement clearing, cash).
- **Balances are materialized** in a `balances` table for O(1) reads, updated *in the same
  DB transaction* as the entries — they are a cache of `Σ entries`, never an independent
  source of truth.
- A **reconciliation job** periodically asserts `materialized balance == Σ ledger_entries`
  per account and raises an alert on any drift.

Example — Send Money of 1000 with a 5 fee:

| account | debit | credit |
|---|---:|---:|
| sender wallet | 1005 | |
| receiver wallet | | 1000 |
| system fee/revenue | | 5 |

## Options Considered

### Option A: Double-entry ledger (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Correctness | Highest — self-proving via balanced entries + reconciliation |
| Auditability | Excellent — complete immutable history |
| Read performance | Good (materialized balances) |

**Pros:** Industry-standard for financial systems; every movement is auditable; integrity is
checkable; fees, reversals, and multi-leg flows model naturally.
**Cons:** More tables and discipline than a balance column; must keep entries and
materialized balance consistent within one transaction.

### Option B: Mutable balance column
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Correctness | Poor — easy to lose/create money on partial failure |
| Auditability | None without a separate log |
| Read performance | Excellent |

**Pros:** Simplest possible; fastest reads.
**Cons:** No audit trail; no integrity proof; reversals and fees are error-prone; unacceptable
for a system whose headline goal is money correctness.

### Option C: Event-sourced wallet (balance = fold over events)
| Dimension | Assessment |
|---|---|
| Complexity | High |
| Correctness | High |
| Auditability | Excellent |
| Read performance | Needs snapshots to stay fast |

**Pros:** Full history by construction; natural fit with Kafka.
**Cons:** More moving parts (snapshots, projections) than needed for the write model;
accountants/auditors reason in double-entry, not event streams.

## Trade-off Analysis

Double-entry gives the **correctness and auditability of event sourcing with a simpler,
universally-understood model** for the write side. Event sourcing is reserved as an optional
future enhancement on the wallet aggregate; the ledger itself stays classic double-entry
because it is the clearest way to *prove* money integrity — which is the entire point.

## Consequences

- **Easier:** auditing; reconciliation; modelling fees, reversals, cash-in/out, settlement;
  explaining any balance ("here are the entries that produced it").
- **Harder:** every feature must think in accounts and balanced legs; the entries + balance
  update must be atomic (and pair with the outbox — [ADR-0004](./0004-transactional-outbox.md)).
- **Revisit when:** high-volume accounts make materialized-balance contention a bottleneck
  (mitigate with per-account ordering, [ADR-0008](./0008-per-account-ordering.md), before
  considering event-sourced snapshots).

## Action Items

1. [ ] Design `accounts`, `ledger_entries`, `balances` schema; define system accounts.
2. [ ] Enforce "entries sum to zero" as an invariant in the posting code (and a test).
3. [ ] Write the entries + balance update + outbox insert in one DB transaction.
4. [ ] Build the nightly reconciliation job and surface drift on the admin dashboard.
