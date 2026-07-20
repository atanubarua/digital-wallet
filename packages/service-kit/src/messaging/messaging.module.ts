import { DynamicModule, Module } from "@nestjs/common";
import { Kafka } from "kafkajs";
import { KAFKA_CLIENT, MESSAGING_OPTIONS, MessagingModuleOptions } from "./messaging.constants";
import { KafkaProducerService } from "./kafka-producer.service";
import { KafkaConsumerService } from "./kafka-consumer.service";

/**
 * DynamicModule, matching HealthModule.register()'s pattern - messaging
 * needs its own OnModuleInit/OnModuleDestroy lifecycle and DI-injectability
 * into controllers/consumers, unlike logging's plain pass-through factory.
 *
 * One shared Kafka client per process; the producer and consumer each pull
 * their own .producer()/.consumer() off it - kafkajs's own recommended
 * usage (a single client can back multiple producers/consumers).
 */
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingModuleOptions): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        { provide: MESSAGING_OPTIONS, useValue: options },
        {
          provide: KAFKA_CLIENT,
          useFactory: (opts: MessagingModuleOptions) =>
            new Kafka({ clientId: opts.clientId, brokers: opts.brokers }),
          inject: [MESSAGING_OPTIONS],
        },
        KafkaProducerService,
        KafkaConsumerService,
      ],
      exports: [KafkaProducerService, KafkaConsumerService],
    };
  }
}
