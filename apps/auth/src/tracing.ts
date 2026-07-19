/**
 * Imported as the FIRST line of main.ts, before anything else - this is
 * what makes OpenTelemetry's auto-instrumentation actually catch this
 * service's http/pg/ioredis usage. See
 * packages/service-kit/src/tracing/index.ts for the full explanation.
 */
import { startTracing } from "@wallet/service-kit/tracing";

startTracing({ serviceName: process.env.OTEL_SERVICE_NAME ?? "auth" });
