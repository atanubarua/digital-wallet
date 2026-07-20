import { Injectable, OnModuleInit } from "@nestjs/common";
import { KafkaConsumerService, Logger } from "@wallet/service-kit";
import { USER_REGISTERED_TOPIC } from "@wallet/contracts";
import { USER_REGISTERED_CONSUMER_GROUP_ID } from "./constants";

/**
 * Logs incoming UserRegistered events. No DB write yet - deferred until
 * User has a real profile schema/migrations (Phase 1), matching this
 * project's thin-template pattern (see apps/auth's demo controller for the
 * producer side of this same demo flow).
 *
 * No retry/DLQ/backoff on handler failure in this commit - an unhandled
 * error here surfaces via kafkajs's default behavior. Known gap, revisit
 * before this goes near production (see ADR-0011).
 */
@Injectable()
export class UserRegisteredConsumer implements OnModuleInit {
  constructor(
    private readonly consumer: KafkaConsumerService,
    private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.run(USER_REGISTERED_CONSUMER_GROUP_ID, [USER_REGISTERED_TOPIC], async ({ key, value }) => {
      this.logger.log({ key, value }, "Received UserRegistered event");
    });
  }
}
