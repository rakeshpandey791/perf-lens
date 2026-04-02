export type IssueSeverity = "low" | "medium" | "high";
export type IssuePriority = "P0" | "P1" | "P2" | "P3";
export type IssueEffort = "S" | "M" | "L";

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
  priority?: IssuePriority;
  confidence?: number;
  estimatedEffort?: IssueEffort;
  probableSolution?: string;
  weightedImpact?: number;
  reach?: "limited" | "module" | "critical-path";
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
    issueDensity: number;
    severityDistribution: {
      high: number;
      medium: number;
      low: number;
    };
    subScores: {
      bundle: number;
      rendering: number;
      complexity: number;
      maintainability: number;
    };
    methodologyVersion: string;
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
