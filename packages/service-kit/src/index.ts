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
// Messaging (kafkajs) is safe in the root barrel, unlike tracing: its
// producer/consumer need OnModuleInit/OnModuleDestroy, so they must live
// inside the Nest module graph - they can't run "before Nest exists" the
// way tracing does. kafkajs is only require()'d once a service's
// app.module.ts imports this barrel, which is always AFTER main.ts's
// literal-first `import "./tracing"` - so instrumentation ordering still
// holds without messaging needing its own isolated subpath export.
export {
  MessagingModule,
  KafkaProducerService,
  KafkaConsumerService,
} from "./messaging";
export type { KafkaMessageHandler, KafkaConsumedMessage, MessagingModuleOptions } from "./messaging";
