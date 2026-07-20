import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Consumer, Kafka } from "kafkajs";
import { KAFKA_CLIENT } from "./messaging.constants";

export interface KafkaConsumedMessage {
  key: string | null;
  value: Record<string, unknown> | null;
}

export type KafkaMessageHandler = (message: KafkaConsumedMessage) => Promise<void>;

/**
 * Thin wrapper over a kafkajs consumer. Unlike the producer, connecting
 * requires knowing the topic(s) and consumer group up front, so there is no
 * generic OnModuleInit here - the consuming service calls run() itself
 * (typically from its own OnModuleInit) once it knows what to subscribe to.
 * See apps/user/src/messaging/user-registered.consumer.ts for the pattern.
 */
@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private consumer?: Consumer;

  constructor(@Inject(KAFKA_CLIENT) private readonly kafka: Kafka) {}

  /**
   * Connects, subscribes, and starts the consume loop. Resolves once
   * running - kafkajs's consumer.run() does not block; messages are handled
   * on kafkajs's own internal loop via the eachMessage callback below.
   */
  async run(groupId: string, topics: string[], handler: KafkaMessageHandler): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId });
    await this.consumer.connect();
    await this.consumer.subscribe({ topics, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value
          ? (JSON.parse(message.value.toString()) as Record<string, unknown>)
          : null;
        await handler({ key: message.key?.toString() ?? null, value });
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }
}
