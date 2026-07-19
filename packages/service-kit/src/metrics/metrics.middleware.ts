import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint();

    // Recorded on "finish", not as an interceptor - this fires even when an
    // exception filter (not a normal controller return) produced the
    // response, so error responses are counted too, not just happy paths.
    res.on("finish", () => {
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      // req.route.path is the matched route PATTERN (e.g. "/users/:id"),
      // not the literal URL - keeps cardinality bounded regardless of how
      // many distinct ids/values are requested. Falls back to the raw path
      // for unmatched routes (404s never reach a route handler).
      const route = req.route?.path ?? req.path;
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      this.metrics.httpRequestDuration.observe(labels, durationSeconds);
      this.metrics.httpRequestsTotal.inc(labels);
    });

    next();
  }
}
