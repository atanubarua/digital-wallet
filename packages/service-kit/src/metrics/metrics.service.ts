import { Injectable, OnModuleInit } from "@nestjs/common";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * Owns the Prometheus Registry for this process. A dedicated Registry
 * (rather than prom-client's global default) means a service can be
 * embedded/tested without accidentally sharing metric state with anything
 * else in the same process.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  readonly httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [this.registry],
  });

  onModuleInit() {
    // Default Node process metrics: heap usage, event loop lag, GC pauses,
    // active handles/requests, CPU time - useful baseline for every service
    // with zero per-service configuration.
    collectDefaultMetrics({ register: this.registry });
  }
}
