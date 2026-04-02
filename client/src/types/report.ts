export type IssueSeverity = "low" | "medium" | "high";
export type IssueProgressStatus = "todo" | "in-progress" | "completed";

export type ReportIssue = {
  type: string;
  severity: IssueSeverity;
  priority?: "P0" | "P1" | "P2" | "P3";
  confidence?: number;
  estimatedEffort?: "S" | "M" | "L";
  probableSolution?: string;
  weightedImpact?: number;
  reach?: "limited" | "module" | "critical-path";
  filePath: string;
  message: string;
  line?: number;
};

export type Report = {
  jobId: string;
  userId: string;
  projectName: string;
  status: "queued" | "processing" | "completed" | "failed";
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
  issues: ReportIssue[];
  suggestions: string[];
  issueProgress: Record<string, IssueProgressStatus>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};
