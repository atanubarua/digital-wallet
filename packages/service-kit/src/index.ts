/**
 * Root barrel - deliberately does NOT export ./tracing. See
 * src/tracing/index.ts's comment for why: tracing must be imported alone,
 * before anything else (including this barrel), to satisfy OpenTelemetry's
 * "instrument before first require()" requirement. Import
 * "@wallet/service-kit/tracing" directly instead.
 */
export { MetricsModule, MetricsService } from "./metrics";
export { HealthModule, pgHealthIndicator, redisHealthIndicator } from "./health";
export { createLoggingModule, Logger } from "./logging";
export { registerShutdownHooks } from "./shutdown";
