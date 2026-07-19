import { HealthCheckError, HealthIndicatorFunction } from "@nestjs/terminus";
import { Client } from "pg";

/**
 * A readiness check factory, NOT a class this package hardcodes into a
 * service. service-kit deliberately does not know the name "DATABASE_URL"
 * or any other env var - the CONSUMING service reads its own config and
 * passes the resolved connection string in (see apps/auth/src/app.module.ts).
 * This keeps service-kit reusable across services with entirely different
 * env var names/shapes.
 *
 * Opens a fresh, short-lived client per check rather than holding a pool -
 * simplest possible thing that proves real connectivity, with no shared
 * state to manage. Revisit if/when a service already holds a live
 * pool/client elsewhere and a fresh connection per check becomes wasteful.
 */
export function pgHealthIndicator(key: string, connectionString: string): HealthIndicatorFunction {
  return async () => {
    const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { [key]: { status: "up" } };
    } catch (err) {
      throw new HealthCheckError(`${key} check failed`, {
        [key]: { status: "down", message: (err as Error).message },
      });
    } finally {
      await client.end().catch(() => undefined);
    }
  };
}
