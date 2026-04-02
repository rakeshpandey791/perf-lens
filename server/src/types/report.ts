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
    issueDensity?: number;
    severityDistribution?: {
      high: number;
      medium: number;
      low: number;
    };
    subScores?: {
      bundle: number;
      rendering: number;
      complexity: number;
      maintainability: number;
    };
    methodologyVersion?: string;
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
    priority?: "P0" | "P1" | "P2" | "P3";
    confidence?: number;
    estimatedEffort?: "S" | "M" | "L";
    probableSolution?: string;
    weightedImpact?: number;
    reach?: "limited" | "module" | "critical-path";
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
