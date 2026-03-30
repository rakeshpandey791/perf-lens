import { connectDb } from "./config/db.js";
import { redisConnection } from "./config/redis.js";
import { analysisWorker } from "./queue/analysisWorker.js";

async function bootstrap(): Promise<void> {
  await connectDb();
  await redisConnection.ping();

  // eslint-disable-next-line no-console
  console.log("Worker is running and listening for analysis jobs.");
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Worker startup failed", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  await analysisWorker.close();
  await redisConnection.quit();
  process.exit(0);
});
