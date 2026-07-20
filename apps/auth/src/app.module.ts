import { Module } from "@nestjs/common";
import {
  createLoggingModule,
  MetricsModule,
  HealthModule,
  pgHealthIndicator,
  redisHealthIndicator,
  MessagingModule,
} from "@wallet/service-kit";
import { AppController } from "./app.controller";
import { DemoController } from "./demo/demo.controller";

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
    MessagingModule.forRoot({
      clientId: "auth",
      brokers: (process.env.KAFKA_BROKERS ?? "redpanda:9092").split(","),
    }),
  ],
  controllers: [AppController, DemoController],
})
export class AppModule {}
