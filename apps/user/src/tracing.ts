/**
 * Imported as the FIRST line of main.ts, before anything else - see
 * apps/auth/src/tracing.ts and packages/service-kit/src/tracing/index.ts
 * for the full explanation of why this ordering matters.
 */
import { startTracing } from "@wallet/service-kit/tracing";

startTracing({ serviceName: process.env.OTEL_SERVICE_NAME ?? "user" });
