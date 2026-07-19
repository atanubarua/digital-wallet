// Tracing MUST be imported first - before @nestjs/core, before AppModule,
// before anything that might require http/pg/ioredis. Because
// tsconfig.base.json compiles to CommonJS, these imports become require()
// calls executed in this literal source order (unlike ESM, which hoists
// imports) - that ordering guarantee is the whole point.
import "./tracing";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
// Logger comes from @wallet/service-kit's re-export, NOT directly from
// "nestjs-pino" - see packages/service-kit/src/logging/index.ts's comment
// for why importing it from anywhere else can silently break app.get(Logger).
import { Logger, registerShutdownHooks } from "@wallet/service-kit";
import { AppModule } from "./app.module";

async function bootstrap() {
  // bufferLogs: true holds Nest's own bootstrap logs until our pino logger
  // (attached below) is ready, so nothing is lost or printed with the
  // default (non-JSON) Nest logger before the swap.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  registerShutdownHooks(app, { timeoutMs: 10_000 });

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
}

bootstrap();
