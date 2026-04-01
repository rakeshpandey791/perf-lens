export type IssueSeverity = "low" | "medium" | "high";
export type IssueProgressStatus = "todo" | "in-progress" | "completed";

export type ReportIssue = {
  type: string;
  severity: IssueSeverity;
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
