# ADR-0007: NestJS/TypeScript primary; Go for the ledger service

**Status:** Proposed
**Date:** 2026-07-19
**Deciders:** Niloy

## Context

One engineer is building **multiple backend services and three frontends** in 4–6 months.
Language choice trades **development velocity** against **per-service fit** and the **signal**
the stack sends to reviewers. Two forces pull in opposite directions:

- Fewer languages → less context-switching, shared types with the frontend, faster shipping.
- A deliberate polyglot choice on the *right* service → demonstrates the senior judgment of
  "right tool for the job," which interviewers actively probe.

## Decision

- **Primary: NestJS + TypeScript** for all services and the API gateway. Rationale: opinionated
  modular structure that maps cleanly to service boundaries
  ([ADR-0001](./0001-modular-monolith-to-microservices.md)), first-class Kafka transport,
  and **shared TypeScript types** across backend and the Next.js frontends — maximizing solo
  velocity across a broad surface.
- **One deliberate polyglot move: rewrite the Wallet/Ledger service in Go** as a **Phase 3
  deliverable** (not day one). The ledger is the money-critical, highest-throughput,
  concurrency-heavy service; Go's performance, simple concurrency model, and small deployment
  footprint make it a defensible, explainable choice for exactly that service.
- **Fallback:** if Go over-stretches the timeline, the ledger **stays in NestJS**. The
  *architecture* is the signal; the language of one service is secondary. This ADR is
  **Proposed** precisely because the Go rewrite is conditional on Phase 1–2 landing on schedule.

## Options Considered

### Option A: NestJS/TS everywhere
| Dimension | Assessment |
|---|---|
| Velocity | Highest (one language, shared types) |
| Per-service fit | Good enough everywhere |
| Signal | Solid, but "all TS" is less distinctive |
| Risk | Lowest |

**Pros:** Fastest to build; shared DTOs FE↔BE; one mental model; lowest risk of not shipping.
**Cons:** Doesn't showcase polyglot judgment; Node is not the obvious choice for a
CPU/concurrency-bound money core.

### Option B: NestJS/TS primary + Go ledger (chosen, phased)
| Dimension | Assessment |
|---|---|
| Velocity | High for most; a focused cost on one service |
| Per-service fit | Excellent (Go where it matters) |
| Signal | Strong — deliberate, explainable tool choice |
| Risk | Medium (contained to Phase 3, with a fallback) |

**Pros:** Keeps velocity across the broad surface while making one high-value, well-reasoned
polyglot choice; the ledger genuinely benefits from Go; great interview narrative.
**Cons:** A second toolchain/deploy; the ledger rewrite is real work; needs the fallback to
stay safe.

### Option C: Java/Spring Boot everywhere
| Dimension | Assessment |
|---|---|
| Velocity | Lower for a solo dev across 3 frontends |
| Per-service fit | Excellent for fintech; strongest "banking" signal |
| Signal | Strong for backend-only roles |
| Risk | Medium–High (heavier; slower to cover the whole surface) |

**Pros:** The fintech lingua franca; strongest signal for pure backend roles.
**Cons:** Heavier and slower for a solo builder who also owns three frontends; no shared types
with the frontend; higher risk of not finishing the full-stack scope.

## Trade-off Analysis

The dominant constraint is **solo capacity across a wide full-stack scope**, which argues for
a single, velocity-friendly language — TypeScript, with the bonus of shared FE/BE types.
Against that, an all-TS stack is a weaker seniority signal for a money system. The chosen
option resolves the tension by **defaulting to TS for velocity and making exactly one
deliberate, well-justified polyglot choice** (Go for the ledger), **deferred to Phase 3 with a
fallback** so it can never sink the project. Java-everywhere is rejected because the full-stack,
solo, time-boxed shape makes its weight a liability that outweighs its stronger backend signal.

## Consequences

- **Easier:** rapid delivery of most services and all frontends; shared types reduce bugs;
  a concrete, defensible "why Go here" story for the ledger.
- **Harder:** maintaining a second toolchain and deploy for the Go service; ensuring the Go
  ledger honors the same contracts (double-entry, outbox, ordering) as the TS version it
  replaces.
- **Revisit when:** Phase 1–2 slip → keep the ledger in NestJS and mark this ADR Superseded/
  Deprecated; or if a backend-only role is the target → reconsider a Java service.

## Action Items

1. [ ] Build all Phase 1–2 services in NestJS/TS with shared type packages.
2. [ ] Gate the Go ledger rewrite on Phase 1–2 landing on schedule.
3. [ ] Keep the ledger's contracts (schema, outbox, ordering) language-agnostic so either
       implementation is a drop-in.
4. [ ] Update this ADR's status to Accepted or Deprecated once the Phase 3 decision is made.
