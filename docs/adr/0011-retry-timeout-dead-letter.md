# ADR-0011: Retry, timeout & dead-letter strategy

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

In a distributed system, failure is normal, not exceptional: a service is briefly down, a
network call hangs, a Kafka consumer throws on a bad message, an external mock gateway is slow.
Two failure surfaces need an explicit, consistent policy:

1. **Synchronous calls** (service→service REST/gRPC — [ADR-0009](./0009-service-to-service-communication.md)):
   how long to wait, whether/how to retry, and how to avoid hammering a struggling dependency.
2. **Asynchronous consumers** (Kafka event handlers): what happens when processing an event
   fails — retry forever? drop it? and how not to block the whole partition.

Without a deliberate policy, the classic failure modes appear: unbounded waits that exhaust
connections, retry storms that turn a blip into an outage, **duplicate side effects** from
naive retries, and a **"poison" message** that fails forever and stalls its partition (blocking
every later event for those accounts — a serious issue given per-account ordering,
[ADR-0008](./0008-per-account-ordering.md)).

## Decision

Adopt a single, system-wide reliability policy with four pillars:

**1. Timeouts on every synchronous call — always bounded.**
No inter-service call is unbounded. Each has an explicit timeout (short for hot paths, longer
for mock-external calls that simulate latency). A timeout is treated as a failure and handled
by the retry/circuit rules below.

**2. Retries with exponential backoff + jitter — only for idempotent operations.**
Transient failures (timeouts, 5xx, connection refused) are retried a **bounded** number of
times with exponentially increasing, jittered delays (jitter prevents synchronized retry
storms). Retries are only safe because operations are **idempotent**
([ADR-0004](./0004-transactional-outbox.md) dedup, idempotency keys) — this is what makes "try
again" not mean "charge twice". Non-retryable errors (validation, 4xx, business rejections) are
**not** retried.

**3. Circuit breaker on flaky dependencies.**
A dependency that keeps failing trips a **circuit breaker**: calls fail fast (without waiting on
the timeout) for a cooldown window, then a half-open probe tests recovery. This protects both
the caller (threads/connections not tied up) and the struggling callee (not pounded while
down). Primary target: the external gateway mocks.

**4. Dead-letter queue (DLQ) + retry topics for async consumers.**
A Kafka event that fails processing is retried a bounded number of times (via **delay/retry
topics** so the main partition is not blocked while waiting), and if it still fails it is moved
to a **dead-letter topic** with failure metadata. This unblocks the partition (critical for
per-account ordering), preserves the message for inspection, and surfaces it on the admin
dashboard for manual replay or intervention. **Consumers remain idempotent** so retried and
replayed messages are safe.

## Options Considered

### Option A: Full policy — timeouts + backoff/jitter + circuit breaker + DLQ (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium–High |
| Resilience | High — bounded, self-protecting, no poison-message stalls |
| Learning value | Very high — the canonical resilience toolkit |
| Operational visibility | High (DLQ + breaker state are observable) |

**Pros:** Covers both sync and async failure surfaces; prevents retry storms (jitter) and
cascading failure (breaker); a poison message can't stall a partition (retry topics + DLQ);
every mechanism is observable and demoable in Phase 6 chaos testing.
**Cons:** More moving parts (retry topics, DLQ, breaker state, tuning); needs idempotency
everywhere (already required); tuning timeouts/thresholds takes iteration.

### Option B: Timeouts + simple bounded retries only (no breaker, no DLQ)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Resilience | Medium — no cascade protection; poison messages stall partitions |
| Learning value | Medium |
| Operational visibility | Low |

**Pros:** Much simpler; covers the common transient case.
**Cons:** No circuit breaker → a down dependency causes cascading slowdowns; no DLQ → a single
bad event blocks its partition indefinitely (breaks per-account ordering for those accounts);
no place to inspect/replay failures. Insufficient for a system meant to teach resilience.

### Option C: Infinite retries / no dead-lettering
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Resilience | Poor — poison messages loop forever |
| Learning value | Negative |

**Pros:** "Nothing is ever lost."
**Cons:** A permanently-failing message retries forever, stalling its partition and burning
resources; no isolation of bad messages. Rejected.

## Trade-off Analysis

The tension is **simplicity vs. resilience + observability**. Option B is tempting but leaves
the two most instructive distributed failure modes unhandled: **cascading failure** (needs a
circuit breaker) and **poison messages stalling ordered partitions** (needs retry topics + a
DLQ). Since a headline goal is to *learn and demonstrate resilience* — including deliberately
injecting these failures in Phase 6 — the full policy (A) is worth its complexity: each
mechanism maps to a real failure the system will be made to survive, on camera, in the chaos
tests. The cost (tuning, more infrastructure) is the exact material being learned.

## Consequences

- **Easier:** surviving transient failures automatically; protecting struggling dependencies;
  isolating and inspecting bad messages without stalling ordered partitions; concrete,
  observable behavior for the Phase 6 chaos/failure demos and postmortems.
- **Harder:** more infrastructure (retry topics, DLQ, breaker) to build and tune; correctness
  depends on idempotency being truly everywhere; thresholds/timeouts need empirical tuning.
- **Revisit when:** DLQ volume reveals a systemic bug (fix the cause, then replay); or breaker
  thresholds cause false trips under normal load (tune); or a flow needs different retry
  semantics than the default (make it configurable per consumer/route).

## Action Items

1. [ ] Set default timeouts per route/consumer; forbid unbounded synchronous calls.
2. [ ] Implement exponential backoff + jitter for retryable errors; classify errors as
       retryable vs terminal.
3. [ ] Add a circuit breaker around the external-gateway mock clients.
4. [ ] Build retry topics + a dead-letter topic per consumer group; surface DLQ contents and
       breaker state on the admin dashboard with a manual replay action.
5. [ ] Verify idempotency/dedup on every retryable and replayable path.
6. [ ] Exercise all four mechanisms in Phase 6 chaos testing and write up the results.
