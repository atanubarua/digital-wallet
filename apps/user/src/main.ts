// Tracing MUST be imported first - see apps/auth/src/main.ts's comment for
// the full ordering rationale (identical here).
import "./tracing";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { Logger, registerShutdownHooks } from "@wallet/service-kit";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  registerShutdownHooks(app, { timeoutMs: 10_000 });

  const port = process.env.PORT ?? 4002;
  await app.listen(port);
}

bootstrap();
