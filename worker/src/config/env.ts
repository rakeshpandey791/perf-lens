import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const workerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverRoot = path.resolve(workerRoot, "../server");

dotenv.config({ path: path.join(serverRoot, ".env") });
dotenv.config();
const tempDir = process.env.TEMP_DIR?.trim() ? process.env.TEMP_DIR : path.join(serverRoot, "temp");

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/perf_lens",
  redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  tempDir
};
