import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = new Redis({
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null
});
