export type IssueSeverity = "low" | "medium" | "high";

export type IssueType =
  | "large-import"
  | "large-file"
  | "component-complexity"
  | "deeply-nested-jsx"
  | "inline-jsx-function"
  | "missing-react-memo";

export type AnalyzerIssue = {
  type: IssueType;
  severity: IssueSeverity;
  filePath: string;
  message: string;
  line?: number;
  meta?: Record<string, unknown>;
};

export type AnalyzerResult = {
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
  issues: AnalyzerIssue[];
  suggestions: string[];
};
