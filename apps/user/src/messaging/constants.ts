/**
 * Consumer group id - hardcoded as an application constant, not an env var.
 * Consumer group identity is an application invariant here (this consumer
 * always belongs to this group), not deployment config, and it must be
 * DETERMINISTIC since Kafka persists offset tracking by group id - a
 * random/generated id would silently lose the "resume where we left off"
 * guarantee on every restart.
 */
export const USER_REGISTERED_CONSUMER_GROUP_ID = "user-service.user-registered-consumer";
