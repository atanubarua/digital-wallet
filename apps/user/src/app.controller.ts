import { Controller, Get } from "@nestjs/common";

/**
 * Deliberately trivial, same as apps/auth/src/app.controller.ts - real
 * User/KYC logic (profiles, roles, KYC tier - docs/architecture.md's
 * service table) lands in a follow-up commit on top of this proven
 * template. Also the target of apps/user's own cross-service demo call.
 */
@Controller()
export class AppController {
  @Get()
  getStatus() {
    return { service: "user", status: "ok" };
  }
}
