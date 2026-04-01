export type ReportStatus = "queued" | "processing" | "completed" | "failed";
export type IssueProgressStatus = "todo" | "in-progress" | "completed";

export type ReportRecord = {
  jobId: string;
  userId: string;
  projectName: string;
  status: ReportStatus;
  summary: {
    totalFiles: number;
    totalIssues: number;
    performanceScore: number;
  };
  detectedFrameworks: string[];
  bundleInsights: {
    largeImportCount: number;
    largeFileCount: number;
    complexityHotspots: number;
    rerenderRiskCount: number;
  };
  largestFiles: Array<{
    path: string;
    sizeBytes: number;
    sizeKB: number;
  }>;
  issues: Array<{
    type: string;
    severity: string;
    filePath: string;
    message: string;
    line?: number;
    meta?: Record<string, unknown>;
  }>;
  suggestions: string[];
  issueProgress: Record<string, IssueProgressStatus>;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};
