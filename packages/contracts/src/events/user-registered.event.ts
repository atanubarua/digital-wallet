/**
 * First real use of this package (ADR-0012 reserved packages/contracts for
 * shared DTOs/event schemas). The topic name and payload shape here must be
 * IDENTICAL for Auth (producer) and User (consumer) - putting them here,
 * imported by both, means a drift between producer and consumer is a
 * compile error, not a silent runtime mismatch two files apart.
 *
 * Topic naming convention: "<producing-service>.<event-name>", not
 * "user-events" - Auth, not User, produces this event, and naming it after
 * the "user" domain would misattribute provenance once User starts emitting
 * its own KycTierChanged/LimitsUpdated events (see docs/architecture.md's
 * service table). Worth a short ADR addendum later if more non-ledger
 * event topics accumulate.
 */
export const USER_REGISTERED_TOPIC = "auth.user-registered";

export interface UserRegisteredEvent {
  eventType: "UserRegistered";
  /**
   * Partition key for this topic. No accountId exists yet at registration
   * time (ADR-0008's per-account partitioning is scoped to money/ledger
   * operations and doesn't apply here) - phone number is the only stable,
   * unique identifier available pre-userId.
   *
   * Known caveat, flagged honestly: this puts PII into a Kafka message key
   * (visible in any Kafka/Redpanda admin UI). Revisit once real
   * registration logic generates a proper userId to key on instead - this
   * whole endpoint is a demo stand-in (see apps/auth/src/demo/demo.controller.ts).
   */
  phoneNumber: string;
  registeredAt: string;
}
