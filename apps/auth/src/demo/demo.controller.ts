import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { KafkaProducerService } from "@wallet/service-kit";
import { USER_REGISTERED_TOPIC, UserRegisteredEvent } from "@wallet/contracts";

interface RegisterDemoBody {
  phoneNumber: string;
}

/**
 * DEMO-ONLY. Stands in for real OTP/registration logic (deferred to a
 * future commit) purely to have something that triggers a UserRegistered
 * event for the cross-service Kafka + tracing proof. Do not build on this
 * as-is - it does no validation, no OTP, no persistence.
 */
@Controller("demo")
export class DemoController {
  constructor(private readonly producer: KafkaProducerService) {}

  @Post("register")
  async register(@Body() body: RegisterDemoBody) {
    if (!body?.phoneNumber || typeof body.phoneNumber !== "string") {
      throw new BadRequestException("phoneNumber is required");
    }

    const event: UserRegisteredEvent = {
      eventType: "UserRegistered",
      phoneNumber: body.phoneNumber,
      registeredAt: new Date().toISOString(),
    };

    // Keyed by phone number - see packages/contracts's UserRegisteredEvent
    // for why (no userId exists yet at this demo stand-in stage).
    await this.producer.publish(USER_REGISTERED_TOPIC, body.phoneNumber, event);

    return { status: "published", topic: USER_REGISTERED_TOPIC };
  }
}
