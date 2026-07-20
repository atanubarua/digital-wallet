/**
 * Tracing bootstrap - deliberately isolated from every other export in this
 * package (see packages/service-kit/src/index.ts, which does NOT re-export
 * this file). OpenTelemetry's auto-instrumentation works by monkey-patching
 * Node's module loader so that when `http`, `pg`, `ioredis`, etc. are first
 * require()'d, the patched versions (which emit spans) are what get loaded
 * instead of the originals. That only works if `startTracing()` runs BEFORE
 * any of those modules have been required anywhere in the process.
 *
 * The root barrel (src/index.ts) re-exports metrics/health/logging/shutdown,
 * which transitively pull in @nestjs/*, which pulls in express, which
 * requires http. If tracing were bundled into that same barrel, importing
 * ANYTHING from @wallet/service-kit would load http first and silently
 * disable instrumentation for it. Keeping tracing on its own subpath export
 * (`@wallet/service-kit/tracing`, see package.json's "exports" map) means a
 * service's main.ts can import ONLY this, first, before importing anything
 * else - see apps/auth/src/tracing.ts + src/main.ts for the required order.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// Re-exported so consuming services never need "@opentelemetry/api" as their
// own direct dependency - same "service-kit owns its telemetry deps"
// pattern already used for nestjs-pino's Logger. `trace` lets a service
// start its own manually-named spans (see
// apps/user/src/demo/demo.controller.ts) without a direct OTel dependency.
export { trace } from "@opentelemetry/api";

export interface TracingOptions {
  /** Used as the "service.name" resource attribute - this is what shows up
   * as the service selector in the Jaeger UI. */
  serviceName: string;
  /** OTLP/HTTP traces endpoint. Defaults to OTEL_EXPORTER_OTLP_ENDPOINT env
   * var, then to Jaeger's OTLP/HTTP receiver on the shared wallet-net
   * network (see infra/docker-compose.yml's jaeger service, port 4318). */
  otlpEndpoint?: string;
}

let sdk: NodeSDK | undefined;

export function startTracing(options: TracingOptions): NodeSDK {
  const endpoint =
    options.otlpEndpoint ??
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
    "http://jaeger:4318/v1/traces";

  sdk = new NodeSDK({
    serviceName: options.serviceName,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  // NodeSDK#start() synchronously registers the instrumentation hooks before
  // returning - calling it here, at module-evaluation time (not inside an
  // async function), is what makes the "before anything else is required"
  // guarantee hold in practice.
  sdk.start();

  return sdk;
}

/** Call during graceful shutdown so buffered spans are flushed before exit. */
export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown();
}
