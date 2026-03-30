import cors from "cors";
import express from "express";
import { MulterError } from "multer";
import { stripeWebhookController } from "./controllers/billing.controller.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { redisConnection } from "./config/redis.js";
import { router } from "./routes/index.js";
import { ensureDir } from "./utils/fs.js";

async function bootstrap(): Promise<void> {
  await ensureDir(env.uploadDir);
  await ensureDir(env.tempDir);

  await connectDb();
  await redisConnection.ping();

  const app = express();
  const configuredOrigins = env.clientOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        const isConfigured = configuredOrigins.includes(origin);
        const isLocalDev = /^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin);
        callback(null, isConfigured || isLocalDev);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["*"],
      optionsSuccessStatus: 204
    })
  );
  app.post("/api/billing/webhook", express.raw({ type: "application/json" }), stripeWebhookController);
  app.use(express.json());
  app.use("/api", router);
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        message: `File too large. Max allowed size is ${env.uploadMaxMb}MB.`
      });
      return;
    }

    if (error instanceof Error) {
      res.status(500).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: "Internal server error" });
  });

  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${env.port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
