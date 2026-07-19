import { DynamicModule } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { trace } from "@opentelemetry/api";

export interface LoggingModuleOptions {
  serviceName: string;
}

/**
 * Returns nestjs-pino's OWN LoggerModule.forRoot(...) dynamic module
 * directly - NOT wrapped in a service-kit-owned module class that imports
 * and re-exports it. Wrapping it broke `app.get(Logger)` at bootstrap
 * (Nest raised "Logger element does not exist in the current context"):
 * nestjs-pino's documented usage is `app.useLogger(app.get(Logger))` after
 * importing LoggerModule directly into the consuming app's module graph,
 * and an extra layer of module-wraps-module re-export did not make that
 * provider resolvable the same way. Returning the DynamicModule as-is means
 * AppModule imports the real LoggerModule (see apps/auth/src/app.module.ts),
 * matching nestjs-pino's own documented pattern exactly.
 */
export function createLoggingModule(options: LoggingModuleOptions): DynamicModule {
  return LoggerModule.forRoot({
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? "info",
      base: { service: options.serviceName },
      // Pulls the ACTIVE OpenTelemetry span's trace/span id into every log
      // line. Only works because startTracing() (../tracing/index.ts) ran
      // before http/express were required - see that file's comment.
      mixin() {
        const span = trace.getActiveSpan();
        if (!span) return {};
        const ctx = span.spanContext();
        return { traceId: ctx.traceId, spanId: ctx.spanId };
      },
      // Health/metrics endpoints are polled every few seconds by Docker's
      // healthcheck and Prometheus - logging every poll would drown out
      // real request logs.
      autoLogging: {
        ignore: (req) => ["/health/live", "/health/ready", "/metrics"].includes(req.url ?? ""),
      },
    },
  });
}
