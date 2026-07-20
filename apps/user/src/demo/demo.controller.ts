import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { trace } from "@wallet/service-kit/tracing";

/**
 * DEMO-ONLY. Proves a synchronous cross-service call (REST, per ADR-0009's
 * "sync for true queries the caller must await") and is the request used to
 * verify the Phase 0 finish line: one request producing a SINGLE Jaeger
 * trace that spans both the user and auth containers.
 *
 * Wraps the call in a manually-named span (for a readable operation name in
 * Jaeger), but deliberately does NOT manually inject the W3C trace-context
 * header. An earlier version did - belt-and-suspenders against
 * undici/fetch auto-instrumentation possibly being absent - but
 * @opentelemetry/auto-instrumentations-node was confirmed to already bundle
 * @opentelemetry/instrumentation-undici, and it independently injects its
 * OWN traceparent header on every fetch() call based on the active span.
 * Both injections firing at once produced a malformed, duplicated
 * traceparent header (two comma-joined values) that Auth's server-side
 * instrumentation could not parse, so it started a disconnected trace
 * instead of linking as a child - observed and fixed during Phase 0
 * verification. Trusting the confirmed-present auto-instrumentation alone
 * is both simpler and correct.
 */
@Controller("demo")
export class DemoController {
  @Get("ping-auth")
  async pingAuth() {
    const tracer = trace.getTracer("user");
    return tracer.startActiveSpan("GET auth /", async (span) => {
      try {
        const response = await fetch(`${process.env.AUTH_SERVICE_URL}/`);
        if (!response.ok) {
          throw new Error(`auth service responded with status ${response.status}`);
        }
        const authBody = await response.json();
        return { service: "user", status: "ok", auth: authBody };
      } catch {
        throw new ServiceUnavailableException("failed to reach auth service");
      } finally {
        span.end();
      }
    });
  }
}
