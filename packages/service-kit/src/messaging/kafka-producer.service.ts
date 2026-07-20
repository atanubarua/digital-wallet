import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Kafka, Producer } from "kafkajs";
import { KAFKA_CLIENT } from "./messaging.constants";

/**
 * Thin wrapper over a kafkajs producer. Connects on module init, disconnects
 * on module destroy - both driven by Nest's own lifecycle (via
 * app.enableShutdownHooks(), already wired by registerShutdownHooks() in
 * every service's main.ts), so no separate shutdown wiring is needed here.
 */
@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor(@Inject(KAFKA_CLIENT) kafka: Kafka) {
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.producer.disconnect();
  }

  // Generic, not Record<string, unknown> - a concrete event interface (e.g.
  // @wallet/contracts's UserRegisteredEvent) has no index signature, so it
  // isn't assignable to Record<string, unknown> even though every one of
  // its properties is. A generic constrained to `object` accepts any plain
  // event shape without forcing callers to add an index signature.
  async publish<T extends object>(topic: string, key: string, event: T): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event) }],
    });
  }
}
