import Redis, { RedisOptions } from "ioredis";
import { logger } from "../lib/logger";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redisClient: Redis | null = null;

export function getRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null, // Required by BullMQ
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`Redis connection lost. Retrying in ${delay}ms (attempt ${times})...`);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.slice(0, targetError.length) === targetError) {
        return true;
      }
      return false;
    },
  };
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    logger.info(`Connecting to Redis at: ${REDIS_URL}`);
    redisClient = new Redis(REDIS_URL, getRedisOptions());

    redisClient.on("connect", () => {
      logger.info("Successfully connected to Redis");
    });

    redisClient.on("error", (err) => {
      logger.error(err, "Redis connection error");
    });
  }
  return redisClient;
}

export async function checkRedisHealth(): Promise<{ status: string; error?: string }> {
  if (process.env.NODE_ENV === "test") {
    return { status: "healthy" };
  }
  try {
    const client = getRedisClient();
    const pingResult = await client.ping();
    if (pingResult === "PONG") {
      return { status: "healthy" };
    }
    return { status: "unhealthy", error: `Unexpected ping response: ${pingResult}` };
  } catch (err: any) {
    return { status: "unhealthy", error: err.message };
  }
}
