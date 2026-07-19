import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { MetricsMiddleware } from "./metrics.middleware";

/**
 * Import this once in a service's root module. Exposes GET /metrics in
 * Prometheus text-exposition format, and records a duration histogram +
 * request counter for every HTTP request via MetricsMiddleware.
 */
@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes("*");
  }
}
