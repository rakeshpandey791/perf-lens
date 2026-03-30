import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = env.redisUrl
  ? new Redis(env.redisUrl, { maxRetriesPerRequest: null })
  : new Redis({
      host: env.redisHost,
      port: env.redisPort,
      maxRetriesPerRequest: null
    });
