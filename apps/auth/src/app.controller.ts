import { Controller, Get } from "@nestjs/common";

/**
 * Deliberately trivial - this service's real Auth logic (OTP, PIN, JWT -
 * see docs/architecture.md's service table) lands in a follow-up commit on
 * top of this proven template. This endpoint exists only so there is
 * something to curl for the tracing/log-correlation verification.
 */
@Controller()
export class AppController {
  @Get()
  getStatus() {
    return { service: "auth", status: "ok" };
  }
}
