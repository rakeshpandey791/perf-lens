import { db } from "../config/db.js";
import { v4 as uuidv4 } from "uuid";
import type {
  PublicUser,
  UserComplianceProfile,
  UserRecord,
  UserSubscription,
  UserSubscriptionInterval,
  UserSubscriptionPlan
} from "../types/user.js";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
  profile: unknown;
  subscription_plan: UserSubscriptionPlan;
  subscription_status: "active";
  subscription_interval: UserSubscriptionInterval;
  monthly_report_limit: number | null;
  monthly_reports_used: number;
  usage_period_start: Date;
  subscription_current_period_start: Date | null;
  subscription_current_period_end: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

const DEFAULT_PROFILE: UserComplianceProfile = {
  companyName: null,
  jobTitle: null,
  country: null,
  timezone: null,
  dataClassification: null,
  primaryUseCase: null,
  complianceFrameworks: [],
  securityContactEmail: null,
  codeOwnershipConfirmed: false,
  marketingUpdatesOptIn: false,
  updatedAt: null
};

export async function createUser(input: {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRecord> {
  const result = await db.query<UserRow>(
    `
      INSERT INTO users (
        id, name, email, password_hash, profile, subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start
      )
      VALUES ($1, $2, $3, $4, $5, 'free', 'active', null, 5, 0, NOW())
      RETURNING id, name, email, password_hash, created_at, profile, subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start, subscription_current_period_start, subscription_current_period_end, stripe_customer_id, stripe_subscription_id
    `,
    [input.id, input.name, input.email.toLowerCase(), input.passwordHash, JSON.stringify(DEFAULT_PROFILE)]
  );

  return toUserRecord(result.rows[0]);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await db.query<UserRow>(
    `
      SELECT id, name, email, password_hash, created_at, profile
      , subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start, subscription_current_period_start, subscription_current_period_end, stripe_customer_id, stripe_subscription_id
      FROM users
      WHERE email = $1
    `,
    [email.toLowerCase()]
  );

  const row = result.rows[0];
  return row ? toUserRecord(row) : null;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const result = await db.query<
    Pick<
      UserRow,
      | "id"
      | "name"
      | "email"
      | "profile"
      | "subscription_plan"
      | "subscription_status"
      | "subscription_interval"
      | "monthly_report_limit"
      | "monthly_reports_used"
      | "usage_period_start"
      | "subscription_current_period_start"
      | "subscription_current_period_end"
    >
  >(
    `
      SELECT id, name, email, profile, subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start, subscription_current_period_start, subscription_current_period_end
      FROM users
      WHERE id = $1
    `,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    profile: normalizeProfile(row.profile),
    subscription: toSubscription(row)
  };
}

export async function updateUserProfile(
  userId: string,
  profile: UserComplianceProfile,
  name?: string
): Promise<PublicUser | null> {
  const result = await db.query<
    Pick<
      UserRow,
      | "id"
      | "name"
      | "email"
      | "profile"
      | "subscription_plan"
      | "subscription_status"
      | "subscription_interval"
      | "monthly_report_limit"
      | "monthly_reports_used"
      | "usage_period_start"
      | "subscription_current_period_start"
      | "subscription_current_period_end"
    >
  >(
    `
      UPDATE users
      SET
        name = COALESCE($2, name),
        profile = $3::jsonb
      WHERE id = $1
      RETURNING id, name, email, profile, subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start, subscription_current_period_start, subscription_current_period_end
    `,
    [userId, name?.trim() || null, JSON.stringify(profile)]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    profile: normalizeProfile(row.profile),
    subscription: toSubscription(row)
  };
}

export async function updateUserSubscriptionPlan(
  userId: string,
  plan: UserSubscriptionPlan,
  interval: UserSubscriptionInterval,
  stripeSubscriptionId?: string | null,
  stripeCustomerId?: string | null,
  currentPeriodStart?: Date | null,
  currentPeriodEnd?: Date | null
): Promise<PublicUser | null> {
  const monthlyReportLimit = plan === "free" ? 5 : null;
  const result = await db.query<
    Pick<
      UserRow,
      | "id"
      | "name"
      | "email"
      | "profile"
      | "subscription_plan"
      | "subscription_status"
      | "subscription_interval"
      | "monthly_report_limit"
      | "monthly_reports_used"
      | "usage_period_start"
      | "subscription_current_period_start"
      | "subscription_current_period_end"
    >
  >(
    `
      UPDATE users
      SET
        subscription_plan = $2,
        subscription_status = 'active',
        subscription_interval = $3,
        monthly_report_limit = $4,
        stripe_subscription_id = $5,
        stripe_customer_id = $6,
        subscription_current_period_start = $7,
        subscription_current_period_end = $8
      WHERE id = $1
      RETURNING id, name, email, profile, subscription_plan, subscription_status, subscription_interval, monthly_report_limit, monthly_reports_used, usage_period_start, subscription_current_period_start, subscription_current_period_end
    `,
    [
      userId,
      plan,
      interval,
      monthlyReportLimit,
      stripeSubscriptionId ?? null,
      stripeCustomerId ?? null,
      currentPeriodStart ?? null,
      currentPeriodEnd ?? null
    ]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    profile: normalizeProfile(row.profile),
    subscription: toSubscription(row)
  };
}

export async function findBillingUserById(userId: string): Promise<{
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: UserSubscriptionPlan;
} | null> {
  const result = await db.query<
    Pick<UserRow, "id" | "name" | "email" | "stripe_customer_id" | "stripe_subscription_id" | "subscription_plan">
  >(
    `
      SELECT id, name, email, stripe_customer_id, stripe_subscription_id, subscription_plan
      FROM users
      WHERE id = $1
    `,
    [userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    plan: row.subscription_plan
  };
}

export async function findUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const result = await db.query<Pick<UserRow, "id">>(
    `
      SELECT id
      FROM users
      WHERE stripe_customer_id = $1
    `,
    [customerId]
  );

  return result.rows[0]?.id ?? null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  await db.query(
    `
      UPDATE users
      SET stripe_customer_id = $2
      WHERE id = $1
    `,
    [userId, customerId]
  );
}

export async function createTeamPlanRequest(input: {
  userId: string;
  companyName: string | null;
  workEmail: string;
  seatCount: number | null;
  notes: string | null;
}): Promise<void> {
  await db.query(
    `
      INSERT INTO team_plan_requests (id, user_id, company_name, work_email, seat_count, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'new')
    `,
    [uuidv4(), input.userId, input.companyName, input.workEmail, input.seatCount, input.notes]
  );
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at.toISOString(),
    profile: normalizeProfile(row.profile),
    subscription: toSubscription(row)
  };
}

function normalizeProfile(value: unknown): UserComplianceProfile {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PROFILE };
  }

  const profile = value as Partial<UserComplianceProfile>;

  return {
    companyName: typeof profile.companyName === "string" ? profile.companyName : null,
    jobTitle: typeof profile.jobTitle === "string" ? profile.jobTitle : null,
    country: typeof profile.country === "string" ? profile.country : null,
    timezone: typeof profile.timezone === "string" ? profile.timezone : null,
    dataClassification:
      profile.dataClassification === "public" ||
      profile.dataClassification === "internal" ||
      profile.dataClassification === "confidential" ||
      profile.dataClassification === "restricted"
        ? profile.dataClassification
        : null,
    primaryUseCase: typeof profile.primaryUseCase === "string" ? profile.primaryUseCase : null,
    complianceFrameworks: Array.isArray(profile.complianceFrameworks)
      ? profile.complianceFrameworks.filter((item): item is string => typeof item === "string").slice(0, 12)
      : [],
    securityContactEmail: typeof profile.securityContactEmail === "string" ? profile.securityContactEmail : null,
    codeOwnershipConfirmed: Boolean(profile.codeOwnershipConfirmed),
    marketingUpdatesOptIn: Boolean(profile.marketingUpdatesOptIn),
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : null
  };
}

export function buildDefaultProfile(): UserComplianceProfile {
  return { ...DEFAULT_PROFILE };
}

function toSubscription(
  row: Pick<
    UserRow,
    | "subscription_plan"
    | "subscription_status"
    | "subscription_interval"
    | "monthly_report_limit"
    | "monthly_reports_used"
    | "usage_period_start"
    | "subscription_current_period_start"
    | "subscription_current_period_end"
  >
): UserSubscription {
  const periodStart = row.usage_period_start?.toISOString?.() ?? new Date().toISOString();
  const periodEnd = new Date(new Date(periodStart).getTime());
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  const remainingReports = row.monthly_report_limit == null ? null : Math.max(row.monthly_report_limit - row.monthly_reports_used, 0);

  return {
    plan: row.subscription_plan ?? "free",
    status: row.subscription_status ?? "active",
    interval: row.subscription_interval ?? null,
    monthlyReportLimit: row.monthly_report_limit ?? null,
    monthlyReportsUsed: row.monthly_reports_used ?? 0,
    usagePeriodStart: periodStart,
    usagePeriodEnd: periodEnd.toISOString(),
    currentPeriodStart: row.subscription_current_period_start?.toISOString?.() ?? null,
    currentPeriodEnd: row.subscription_current_period_end?.toISOString?.() ?? null,
    remainingReports,
    canRequestReport: remainingReports == null ? true : remainingReports > 0
  };
}
