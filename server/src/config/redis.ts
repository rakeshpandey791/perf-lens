import { Redis } from "ioredis";
import { env } from "./env.js";

const redisEndpoint = env.redisUrl || env.redisHost;
const isRedisUri = /^rediss?:\/\//i.test(redisEndpoint);

export const redisConnection = isRedisUri
  ? new Redis(redisEndpoint, { maxRetriesPerRequest: null })
  : new Redis({
      host: redisEndpoint,
      port: env.redisPort,
      maxRetriesPerRequest: null
    });
