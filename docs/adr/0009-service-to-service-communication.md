# ADR-0009: Service-to-service communication (sync REST vs gRPC vs async-only)

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

Now that the system is distributed from day one ([ADR-0001](./0001-modular-monolith-to-microservices.md)),
services must talk to each other over the network. Two distinct communication needs exist and
they should not be conflated:

1. **Commands that need an answer now** — e.g. the gateway asks Auth "is this token valid?",
   or the Transaction service asks the Ledger to post a transfer and needs the result
   (success + new balance) to return synchronously to the customer.
2. **Facts that happened** — e.g. `LedgerPosted`, `UserRegistered`. Other services react, but
   the originator does not need a reply and should not wait.

We already have Kafka for (2) ([ADR-0002](./0002-kafka-event-bus.md)). The open question is
what to use for (1): **REST/JSON over HTTP**, **gRPC**, or **push everything to async events**
and avoid synchronous calls entirely.

A guiding constraint for this project: it is a **learning vehicle**, and a *hybrid* model
(sync for commands, async for events) is the most common real-world topology and the one worth
learning to reason about.

## Decision

Adopt a **hybrid communication model** with a clear default:

- **Asynchronous events (Kafka) are the default** for anything that is a notification of a
  fact or a side effect that can happen eventually (notifications, history projection, fraud
  checks, external-gateway workflows). Prefer this whenever a synchronous answer is not
  strictly required — it maximizes decoupling and resilience.
- **Synchronous request/response for true commands and queries** that need an immediate answer
  in the caller's request path (token validation, "post this transfer and tell me the result",
  fetch a profile for the gateway to compose a response).
- For the synchronous transport, use **REST/JSON over HTTP** between services **initially**,
  and treat **gRPC as a deliberate, scoped upgrade** for the hottest internal path
  (Transaction → Ledger) once that path exists and is worth optimizing — so the performance and
  contract benefits of gRPC are learned in the place they matter, without paying its cost
  everywhere.
- **External-facing traffic (frontends → gateway) stays REST/JSON** regardless — browsers,
  tooling, and debuggability favor it.

## Options Considered

### Option A: Hybrid — async-default + REST for sync, gRPC later on the hot path (chosen)
| Dimension | Assessment |
|---|---|
| Complexity | Medium |
| Coupling | Low (async-default keeps services decoupled) |
| Performance | Good; excellent on the path that gets gRPC |
| Team familiarity | High (REST); gRPC introduced deliberately |
| Learning value | High — exercises both paradigms and *when to use which* |

**Pros:** Matches real-world topologies; async-default gives resilience/decoupling; REST is
easy to build, curl, and trace early; introducing gRPC on one path teaches its trade-offs
(schema-first contracts, streaming, binary perf) without a big-bang migration.
**Cons:** Two synchronous transports eventually coexist; must be disciplined about *which*
interactions are truly synchronous vs. events masquerading as calls.

### Option B: REST everywhere for sync (no gRPC)
| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Coupling | Low–Medium |
| Performance | Adequate; more overhead per call (JSON, HTTP/1.1) |
| Team familiarity | High |
| Learning value | Medium — misses gRPC/contract-first learning |

**Pros:** Simplest; one sync transport; universally debuggable.
**Cons:** No exposure to gRPC/protobuf contracts, streaming, or the perf story — a gap for a
project whose point is to learn distributed systems breadth; JSON/HTTP overhead on hot paths.

### Option C: gRPC everywhere for sync
| Dimension | Assessment |
|---|---|
| Complexity | Medium–High |
| Coupling | Low (strong contracts via protobuf) |
| Performance | Best |
| Team familiarity | Lower; more upfront tooling |
| Learning value | High for gRPC, but heavier from day one |

**Pros:** Strong schema-first contracts everywhere; best perf; server streaming is handy.
**Cons:** Harder to debug/curl during early development; browser can't call gRPC directly
(needs grpc-web/gateway) so the edge is REST anyway; more upfront friction while the domain is
still being shaped.

### Option D: Async-only (no synchronous calls at all)
| Dimension | Assessment |
|---|---|
| Complexity | High (request/reply over a bus is awkward) |
| Coupling | Lowest |
| Performance | Poor for user-facing "do X and tell me now" |
| Learning value | High but impractical as a blanket rule |

**Pros:** Maximum decoupling; everything is an event.
**Cons:** User-facing commands that need an immediate result (post a transfer → show new
balance) become correlation-id request/reply over Kafka — high latency and awkward UX.
Over-applies a good idea. Rejected as a *blanket* rule (still the default for facts/side effects).

## Trade-off Analysis

The key insight is that **"sync vs async" is not one decision but per-interaction**: commands
that a user is waiting on want synchronous request/response; facts and deferrable side effects
want events. Forcing everything into one paradigm (Option C's gRPC-everywhere or Option D's
async-everywhere) is the mistake. The hybrid (A) picks the right tool per interaction, keeps
early development easy with REST, and reserves gRPC for the one internal hot path where its
benefits are real and learnable — which also *teaches the trade-off* rather than assuming it.

## Consequences

- **Easier:** early development and debugging (REST/curl-able); resilient, decoupled default
  (events); a natural, contained place to learn gRPC (Transaction → Ledger).
- **Harder:** must consciously classify each interaction (command vs fact) — the discipline is
  the point but requires care; eventually two sync transports coexist and need consistent
  auth, tracing, and error conventions across both.
- **Revisit when:** the REST hot path shows measurable overhead → promote it to gRPC; or if
  contract drift between services becomes painful → adopt schema-first contracts (OpenAPI now,
  protobuf where gRPC lands) more broadly.

## Action Items

1. [ ] Define the rule of thumb in the repo: *event by default; synchronous only for commands/
       queries the caller must await.*
2. [ ] Standardize the synchronous REST conventions (error envelope, auth header, correlation-ID
       propagation, timeouts — see [ADR-0011](./0011-retry-timeout-dead-letter.md)).
3. [ ] Keep OpenAPI specs per service for the sync surface; AsyncAPI for the event surface.
4. [ ] When Transaction → Ledger exists and is hot, introduce gRPC there and document the
       before/after (contract + latency) as a learning artifact.
