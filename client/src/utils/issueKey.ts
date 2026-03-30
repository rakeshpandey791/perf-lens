import type { ReportIssue } from "../types/report";

export function getIssueKey(issue: ReportIssue): string {
  return [issue.type, issue.filePath, issue.line ?? 0, issue.message].join("|");
}
