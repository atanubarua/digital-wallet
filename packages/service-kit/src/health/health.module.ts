import { DynamicModule, Module } from "@nestjs/common";
import { TerminusModule, HealthIndicatorFunction } from "@nestjs/terminus";
import { HealthController } from "./health.controller";
import { HEALTH_READINESS_INDICATORS } from "./health.tokens";

export interface HealthModuleOptions {
  /** What /health/ready actually checks - built with pgHealthIndicator /
   * redisHealthIndicator (or any function matching HealthIndicatorFunction)
   * by the CONSUMING service, which knows its own env vars/dependencies. */
  readinessIndicators: HealthIndicatorFunction[];
}

@Module({})
export class HealthModule {
  static register(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        { provide: HEALTH_READINESS_INDICATORS, useValue: options.readinessIndicators },
      ],
    };
  }
}
