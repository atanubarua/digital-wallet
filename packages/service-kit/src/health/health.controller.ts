import { Controller, Get, Inject } from "@nestjs/common";
import { HealthCheck, HealthCheckService, HealthIndicatorFunction } from "@nestjs/terminus";
import { HEALTH_READINESS_INDICATORS } from "./health.tokens";

@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(HEALTH_READINESS_INDICATORS)
    private readonly readinessIndicators: HealthIndicatorFunction[],
  ) {}

  /**
   * Liveness: "is this process able to respond at all". Deliberately checks
   * NOTHING external. If this also pinged Postgres/Redis, an outage in a
   * dependency this process can't fix would make a container orchestrator
   * kill and restart an otherwise-healthy process - pure churn, no benefit.
   */
  @Get("live")
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /**
   * Readiness: "can this process actually serve traffic right now" - runs
   * whatever dependency checks the consuming service registered (see
   * HealthModule.register in this service's app.module.ts). Terminus
   * returns HTTP 503 with a per-dependency breakdown if any indicator
   * throws a HealthCheckError, so a partial outage (e.g. Redis down,
   * Postgres fine) is visible per-dependency, not a single opaque failure.
   */
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check(this.readinessIndicators);
  }
}
