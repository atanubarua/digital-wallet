import { Module } from "@nestjs/common";
import {
  createLoggingModule,
  MetricsModule,
  HealthModule,
  pgHealthIndicator,
  redisHealthIndicator,
} from "@wallet/service-kit";
import { AppController } from "./app.controller";

@Module({
  imports: [
    createLoggingModule({ serviceName: "auth" }),
    MetricsModule,
    // Auth reads its OWN env vars and hands resolved connection strings to
    // service-kit's generic indicator factories - service-kit itself never
    // knows the names "DATABASE_URL"/"REDIS_URL" (see health/index.ts).
    HealthModule.register({
      readinessIndicators: [
        pgHealthIndicator("auth_db", process.env.DATABASE_URL as string),
        redisHealthIndicator("redis", process.env.REDIS_URL as string),
      ],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
