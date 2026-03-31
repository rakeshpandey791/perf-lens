import { Redis } from "ioredis";
import { env } from "./env.js";

function buildRedisConnection(): Redis {
  const explicitUrl = env.redisUrl.trim();
  if (explicitUrl) {
    return new Redis(explicitUrl, { maxRetriesPerRequest: null });
  }

  const rawHost = env.redisHost.trim();
  if (/^rediss?:\/\//i.test(rawHost)) {
    return new Redis(rawHost, { maxRetriesPerRequest: null });
  }

  const hostWithoutScheme = rawHost.replace(/^rediss?:\/\//i, "");
  const [hostPart, portPart] = hostWithoutScheme.split(":");
  const host = hostPart.replace(/\/.*$/, "").trim();
  const port = Number(portPart?.trim() || env.redisPort);

  return new Redis({
    host,
    port: Number.isFinite(port) ? port : env.redisPort,
    maxRetriesPerRequest: null
  });
}

export const redisConnection = buildRedisConnection();
