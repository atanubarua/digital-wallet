# ADR-0010: Sagas & compensating transactions for cross-service consistency

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

Because each service owns its own database ([ADR-0006](./0006-database-per-service.md)) and the
system is distributed from day one ([ADR-0001](./0001-modular-monolith-to-microservices.md)),
there is **no shared ACID transaction across services**. Yet several business flows span
multiple services and must end in a consistent state — no money created, none lost.

The canonical example is **Add Money** (bank/card → wallet):

1. Reserve/record an intent in the Transaction service.
2. Call the (mocked) external bank gateway — an async, failure-prone, slow step.
3. On success, credit the wallet in the Ledger service.
4. On failure/timeout, the intent must be unwound so no phantom credit or stuck reservation
   remains.

Steps 1, 3, and 4 are in different services/databases. A single `BEGIN...COMMIT` cannot cover
them. We need a way to coordinate a multi-step, multi-service flow with well-defined behavior
on partial failure.

## Decision

Use the **Saga pattern**: model each cross-service flow as a **sequence of local ACID
transactions**, where each step publishes an event that triggers the next, and **every step
that has a side effect defines a compensating transaction** that semantically undoes it if a
later step fails.

- **Local atomicity per step** — each service's step is a real DB transaction in *its* database
  (and emits its event via the outbox, [ADR-0004](./0004-transactional-outbox.md), so the
  step and its event are atomic).
- **Compensation, not rollback** — you cannot roll back a committed step in another service;
  you issue an explicit *compensating* action (e.g. "release the reservation", "reverse the
  credit with a balancing ledger entry"). Because the ledger is append-only
  ([ADR-0003](./0003-double-entry-ledger.md)), a reversal is a **new balanced entry**, never a
  delete — preserving the audit trail.
- **Choreography as the default** — steps react to each other's events (no central controller).
  This keeps services decoupled and is the more instructive pattern to learn first.
- **Orchestration reserved for the most complex flows** — if a saga grows many steps/branches
  and choreography becomes hard to follow (likely Add Money, with external timeouts and
  branches), introduce a dedicated **orchestrator** (a saga state machine in the Transaction
  service) that explicitly drives and tracks each step. Learning *both* styles, and *when each
  fits*, is an explicit goal.
- **Idempotent steps + saga state** — each step and each compensation is idempotent
  (keyed by saga id + step), and the saga's progress is persisted so it can resume/complete
  after a crash.

### Add Money saga (choreography, with compensation)

```
1. Transaction:  create AddMoney intent (PENDING)         → emit AddMoneyRequested
2. ExtGateway:   call bank mock
      success →                                            emit AddMoneyConfirmed
      failure/timeout →                                    emit AddMoneyFailed
3a. Ledger (on AddMoneyConfirmed): credit wallet (entry)  → emit LedgerPosted
3b. Transaction (on AddMoneyFailed): mark intent FAILED   → (compensation: nothing credited yet,
                                                             just release the intent)
4. Transaction (on LedgerPosted for this saga): mark intent COMPLETED
```
If a credit had occurred and a *later* step failed, compensation would post a **reversing
ledger entry**, not delete the original.

## Options Considered

### Option A: Sagas (choreography-first, orchestration where needed) — chosen
| Dimension | Assessment |
|---|---|
| Complexity | Medium–High |
| Consistency | Eventual, but well-defined on failure |
| Availability | High (no distributed lock/coordinator blocking) |
| Learning value | Very high — the core distributed-consistency pattern |

**Pros:** The standard solution for cross-service consistency; no blocking coordinator; each
step stays locally ACID; compensation makes failure behavior explicit and auditable; teaches
both choreography and orchestration.
**Cons:** Eventual consistency (a flow is briefly "in progress"); compensations must be
designed for every side-effecting step; reasoning about all failure orderings is real work;
choreography can become hard to trace as steps grow (mitigated by orchestration + tracing).

### Option B: Two-phase commit (XA) across services
| Dimension | Assessment |
|---|---|
| Complexity | High |
| Consistency | Strong in theory |
| Availability | Poor (blocking; coordinator is a liability) |
| Learning value | Low (a known anti-pattern here) |

**Pros:** Conceptually atomic across steps.
**Cons:** Blocking protocol holding locks across services; coordinator failure stalls
participants; Kafka has no usable XA; widely discouraged. Already rejected for DB↔Kafka in
[ADR-0004](./0004-transactional-outbox.md); same reasons apply across services.

### Option C: Best-effort with no compensation ("hope it succeeds")
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Consistency | Broken on partial failure |
| Availability | High |
| Learning value | Negative |

**Pros:** Trivial.
**Cons:** Leaves stuck reservations / phantom credits on failure. Unacceptable for money.

## Trade-off Analysis

The real choice is **strong-but-blocking (2PC) vs eventual-but-available (sagas)**. For money
across services, 2PC's blocking/coordinator problems and the lack of Kafka XA make it
impractical — the same conclusion as [ADR-0004](./0004-transactional-outbox.md). Sagas accept
**eventual consistency** (a flow is briefly in-flight) in exchange for **availability and no
distributed locking**, and make failure handling *explicit* via compensation. The added cost —
designing compensations and reasoning about failure orderings — is precisely the distributed-
systems skill this project exists to build, so it is a cost worth paying, not just tolerating.

## Consequences

- **Easier:** cross-service flows that stay available under partial failure; auditable
  failure handling (reversing ledger entries, not deletes); a natural place to learn both saga
  styles.
- **Harder:** every side-effecting step needs a compensation; must persist saga state and make
  steps idempotent; must reason about all interleavings/timeouts; UX must represent
  "in-progress" states (Add Money is `PENDING` before `COMPLETED`).
- **Revisit when:** a choreographed saga's event flow becomes hard to follow → promote it to an
  orchestrated saga (state machine); or if saga observability is weak → add a saga-status view
  on the admin dashboard.

## Action Items

1. [ ] Implement Add Money as the first saga (choreography), with `PENDING/COMPLETED/FAILED`
       intent states and a compensation path.
2. [ ] Define compensations for every side-effecting step (release reservation, reversing
       ledger entry).
3. [ ] Persist saga state; make each step + compensation idempotent (keyed by saga id + step).
4. [ ] Add distributed tracing across saga steps and a saga-status view for the admin dashboard.
5. [ ] Later, re-implement one saga with an orchestrator and write up the choreography-vs-
       orchestration comparison as a learning artifact.
