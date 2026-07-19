import { HealthCheckError, HealthIndicatorFunction } from "@nestjs/terminus";
import Redis from "ioredis";

/** Same design as pgHealthIndicator - see that file's comment for the rationale. */
export function redisHealthIndicator(key: string, url: string): HealthIndicatorFunction {
  return async () => {
    // lazyConnect: true means `new Redis()` does not connect immediately -
    // we control exactly when the connection attempt happens, inside the
    // try block, so a connection failure surfaces as a normal rejected
    // promise here rather than an unhandled event on a socket we don't
    // control the lifecycle of.
    const client = new Redis(url, { lazyConnect: true, connectTimeout: 2000 });
    try {
      await client.connect();
      const pong = await client.ping();
      if (pong !== "PONG") {
        throw new Error(`unexpected PING reply: ${pong}`);
      }
      return { [key]: { status: "up" } };
    } catch (err) {
      throw new HealthCheckError(`${key} check failed`, {
        [key]: { status: "down", message: (err as Error).message },
      });
    } finally {
      client.disconnect();
    }
  };
}
