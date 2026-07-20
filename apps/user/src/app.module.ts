import { Module } from "@nestjs/common";
import {
  createLoggingModule,
  MetricsModule,
  HealthModule,
  pgHealthIndicator,
  MessagingModule,
} from "@wallet/service-kit";
import { AppController } from "./app.controller";
import { DemoController } from "./demo/demo.controller";
import { UserRegisteredConsumer } from "./messaging/user-registered.consumer";

@Module({
  imports: [
    createLoggingModule({ serviceName: "user" }),
    MetricsModule,
    // ONLY user_db - deliberately no redisHealthIndicator. Unlike Auth,
    // User/KYC has no stated Redis dependency (docs/architecture.md's
    // service table) - this proves the health module's indicator list is
    // genuinely per-service configurable, not copy-pasted from auth.
    HealthModule.register({
      readinessIndicators: [pgHealthIndicator("user_db", process.env.DATABASE_URL as string)],
    }),
    MessagingModule.forRoot({
      clientId: "user",
      brokers: (process.env.KAFKA_BROKERS ?? "redpanda:9092").split(","),
    }),
  ],
  controllers: [AppController, DemoController],
  providers: [UserRegisteredConsumer],
})
export class AppModule {}
