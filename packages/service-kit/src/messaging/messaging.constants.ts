export const KAFKA_CLIENT = Symbol("KAFKA_CLIENT");
export const MESSAGING_OPTIONS = Symbol("MESSAGING_OPTIONS");

export interface MessagingModuleOptions {
  /** Shown in Redpanda/Kafka broker logs and consumer-group metadata -
   * usually just the service's own name. */
  clientId: string;
  brokers: string[];
}
