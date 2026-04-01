import { Pool } from "pg";
import { env } from "./env.js";

export const db = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined
});

export async function connectDb(): Promise<void> {
  await db.query("SELECT 1");
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      subscription_plan TEXT NOT NULL DEFAULT 'free',
      subscription_status TEXT NOT NULL DEFAULT 'active',
      subscription_interval TEXT,
      monthly_report_limit INTEGER,
      monthly_reports_used INTEGER NOT NULL DEFAULT 0,
      usage_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      subscription_current_period_start TIMESTAMPTZ,
      subscription_current_period_end TIMESTAMPTZ,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS team_plan_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      company_name TEXT,
      work_email TEXT NOT NULL,
      seat_count INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS reports (
      job_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_name TEXT NOT NULL DEFAULT 'Untitled Project',
      status TEXT NOT NULL,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      bundle_insights JSONB NOT NULL DEFAULT '{}'::jsonb,
      largest_files JSONB NOT NULL DEFAULT '[]'::jsonb,
      issues JSONB NOT NULL DEFAULT '[]'::jsonb,
      suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
      issue_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
      detected_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free'`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_interval TEXT`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_report_limit INTEGER`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_reports_used INTEGER NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_start TIMESTAMPTZ`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL`);
  await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL`);
  await db.query(`UPDATE users SET monthly_report_limit = 5 WHERE subscription_plan = 'free' AND monthly_report_limit IS NULL`);
  await db.query(`UPDATE users SET monthly_report_limit = NULL WHERE subscription_plan IN ('pro', 'individual', 'team')`);
  await db.query(`UPDATE users SET subscription_plan = 'individual' WHERE subscription_plan = 'pro'`);
  await db.query(`UPDATE users SET subscription_interval = 'monthly' WHERE subscription_plan = 'individual' AND subscription_interval IS NULL`);
  await db.query(`UPDATE users SET monthly_reports_used = 0 WHERE monthly_reports_used IS NULL`);
  await db.query(`UPDATE users SET usage_period_start = NOW() WHERE usage_period_start IS NULL`);
  await db.query(`UPDATE users SET profile = '{}'::jsonb WHERE profile IS NULL`);
  await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id TEXT`);
  await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT 'Untitled Project'`);
  await db.query(`UPDATE reports SET project_name = 'Untitled Project' WHERE project_name IS NULL OR BTRIM(project_name) = ''`);
  await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS issue_progress JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await db.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS detected_frameworks JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_reports_user_id_created_at ON reports(user_id, created_at DESC)`);
  // eslint-disable-next-line no-console
  console.log("Connected to PostgreSQL");
}
