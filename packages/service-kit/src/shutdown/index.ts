import { INestApplication } from "@nestjs/common";

export interface ShutdownOptions {
  /** Hard exit if graceful shutdown hasn't finished within this window -
   * a stuck shutdown should never hang `docker stop` forever. */
  timeoutMs?: number;
}

/**
 * On SIGTERM (what `docker stop` / `docker compose down` sends) or SIGINT
 * (Ctrl+C locally), stop accepting new connections, let in-flight requests
 * finish, run Nest's onModuleDestroy/beforeApplicationShutdown lifecycle
 * (closing DB pools, Kafka clients, etc. as those get added later), then
 * exit - rather than the process just being killed mid-request.
 */
export function registerShutdownHooks(app: INestApplication, options: ShutdownOptions = {}): void {
  const timeoutMs = options.timeoutMs ?? 10_000;

  // Wires Nest's lifecycle hooks (onModuleDestroy etc.) to app.close() -
  // without this, app.close() alone would NOT run those hooks.
  app.enableShutdownHooks();

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    const forceExit = setTimeout(() => {
      process.exit(1);
    }, timeoutMs);
    forceExit.unref();

    try {
      await app.close();
      clearTimeout(forceExit);
      process.exit(0);
    } catch {
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}
