import { db } from "../config/db.js";
import type { IssueProgressStatus, ReportRecord, ReportStatus } from "../types/report.js";

type ReportRow = {
  job_id: string;
  user_id: string;
  status: ReportStatus;
  summary: unknown;
  detected_frameworks: unknown;
  bundle_insights: unknown;
  largest_files: unknown;
  issues: unknown;
  suggestions: unknown;
  issue_progress: unknown;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

const defaultSummary = { totalFiles: 0, totalIssues: 0, performanceScore: 100 };
const defaultDetectedFrameworks = ["Generic JS/TS"];
const defaultBundleInsights = {
  largeImportCount: 0,
  largeFileCount: 0,
  complexityHotspots: 0,
  rerenderRiskCount: 0
};

export async function createQueuedReportForUser(jobId: string, userId: string): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query<{
      subscription_plan: "free" | "individual" | "team";
      monthly_report_limit: number | null;
      monthly_reports_used: number;
      usage_period_start: Date;
    }>(
      `
        SELECT subscription_plan, monthly_report_limit, monthly_reports_used, usage_period_start
        FROM users
        WHERE id = $1
        FOR UPDATE
      `,
      [userId]
    );

    const userRow = userResult.rows[0];
    if (!userRow) {
      throw new Error("User not found");
    }

    const now = new Date();
    const usagePeriodStart = new Date(userRow.usage_period_start);
    const usagePeriodEnd = new Date(usagePeriodStart.getTime());
    usagePeriodEnd.setUTCMonth(usagePeriodEnd.getUTCMonth() + 1);

    let monthlyReportsUsed = userRow.monthly_reports_used;
    let updatedPeriodStart = usagePeriodStart;

    if (now >= usagePeriodEnd) {
      monthlyReportsUsed = 0;
      updatedPeriodStart = now;
    }

    const monthlyReportLimit = userRow.subscription_plan === "free" ? 5 : null;
    if (monthlyReportLimit != null && monthlyReportsUsed >= monthlyReportLimit) {
      const error = new Error("FREE_PLAN_LIMIT_REACHED");
      error.name = "FREE_PLAN_LIMIT_REACHED";
      throw error;
    }

    await client.query(
      `
        UPDATE users
        SET
          monthly_report_limit = $2,
          monthly_reports_used = $3,
          usage_period_start = $4
        WHERE id = $1
      `,
      [userId, monthlyReportLimit, monthlyReportsUsed + 1, updatedPeriodStart.toISOString()]
    );

    await client.query(
      `
        INSERT INTO reports (job_id, user_id, status, summary, bundle_insights, largest_files, issues, suggestions)
        VALUES ($1, $2, 'queued', $3::jsonb, $4::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
      `,
      [jobId, userId, JSON.stringify(defaultSummary), JSON.stringify(defaultBundleInsights)]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findReportByJobIdForUser(jobId: string, userId: string): Promise<ReportRecord | null> {
  const result = await db.query<ReportRow>(
    `
      SELECT job_id, user_id, status, summary, detected_frameworks, bundle_insights, largest_files, issues, suggestions, issue_progress, error, created_at, updated_at
      FROM reports
      WHERE job_id = $1 AND user_id = $2
    `,
    [jobId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return toReportRecord(row);
}

export async function listReportsForUser(userId: string): Promise<ReportRecord[]> {
  const result = await db.query<ReportRow>(
    `
      SELECT job_id, user_id, status, summary, detected_frameworks, bundle_insights, largest_files, issues, suggestions, issue_progress, error, created_at, updated_at
      FROM reports
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId]
  );

  return result.rows.map(toReportRecord);
}

export async function updateIssueProgressForUser(
  jobId: string,
  userId: string,
  issueKey: string,
  status: IssueProgressStatus
): Promise<boolean> {
  const result = await db.query(
    `
      UPDATE reports
      SET
        issue_progress = jsonb_set(COALESCE(issue_progress, '{}'::jsonb), ARRAY[$3]::text[], to_jsonb($4::text), true),
        updated_at = NOW()
      WHERE job_id = $1 AND user_id = $2
    `,
    [jobId, userId, issueKey, status]
  );

  return (result.rowCount ?? 0) > 0;
}

function toReportRecord(row: ReportRow): ReportRecord {
  return {
    jobId: row.job_id,
    userId: row.user_id,
    status: row.status,
    summary: (row.summary as ReportRecord["summary"]) ?? defaultSummary,
    detectedFrameworks: normalizeDetectedFrameworks(row.detected_frameworks),
    bundleInsights: (row.bundle_insights as ReportRecord["bundleInsights"]) ?? defaultBundleInsights,
    largestFiles: (row.largest_files as ReportRecord["largestFiles"]) ?? [],
    issues: (row.issues as ReportRecord["issues"]) ?? [],
    suggestions: (row.suggestions as string[]) ?? [],
    issueProgress: (row.issue_progress as ReportRecord["issueProgress"]) ?? {},
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function normalizeDetectedFrameworks(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return defaultDetectedFrameworks;
  }

  const frameworks = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return frameworks.length > 0 ? frameworks : defaultDetectedFrameworks;
}
