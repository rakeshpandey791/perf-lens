import { db } from "../config/db.js";
import type { AnalyzerResult } from "../types/analyzer.js";

export async function markProcessing(jobId: string): Promise<void> {
  await db.query(
    `
      UPDATE reports
      SET status = 'processing', updated_at = NOW()
      WHERE job_id = $1
    `,
    [jobId]
  );
}

export async function markCompleted(jobId: string, result: AnalyzerResult): Promise<void> {
  await db.query(
    `
      UPDATE reports
      SET
        status = 'completed',
        summary = $2::jsonb,
        detected_frameworks = $3::jsonb,
        bundle_insights = $4::jsonb,
        largest_files = $5::jsonb,
        issues = $6::jsonb,
        suggestions = $7::jsonb,
        error = NULL,
        updated_at = NOW()
      WHERE job_id = $1
    `,
    [
      jobId,
      JSON.stringify(result.summary),
      JSON.stringify(result.detectedFrameworks),
      JSON.stringify(result.bundleInsights),
      JSON.stringify(result.largestFiles),
      JSON.stringify(result.issues),
      JSON.stringify(result.suggestions)
    ]
  );
}

export async function markFailed(jobId: string, errorMessage: string): Promise<void> {
  await db.query(
    `
      UPDATE reports
      SET
        status = 'failed',
        error = $2,
        updated_at = NOW()
      WHERE job_id = $1
    `,
    [jobId, errorMessage]
  );
}
