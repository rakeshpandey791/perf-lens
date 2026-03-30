import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const uploadDir = process.env.UPLOAD_DIR?.trim() ? process.env.UPLOAD_DIR : path.join(serverRoot, "uploads");
const tempDir = process.env.TEMP_DIR?.trim() ? process.env.TEMP_DIR : path.join(serverRoot, "temp");

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://127.0.0.1:5432/perf_lens",
  redisHost: process.env.REDIS_HOST ?? "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB ?? 200),
  uploadDir,
  tempDir,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceIndividualMonthly: process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY ?? "",
  stripePriceIndividualQuarterly: process.env.STRIPE_PRICE_INDIVIDUAL_QUARTERLY ?? "",
  stripePriceIndividualAnnual: process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL ?? "",
  billingSuccessUrl: process.env.BILLING_SUCCESS_URL ?? "http://localhost:5173/profile?billing=success",
  billingCancelUrl: process.env.BILLING_CANCEL_URL ?? "http://localhost:5173/profile?billing=cancelled",
  teamPlanContactEmail: process.env.TEAM_PLAN_CONTACT_EMAIL ?? "sales@perflens.dev"
};
