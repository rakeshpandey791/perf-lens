import { api } from "./api";
import type { IssueProgressStatus, Report } from "../types/report";

export async function uploadZip(file: File): Promise<{ reportId: string; status: string }> {
  const formData = new FormData();
  formData.append("projectZip", file);

  const { data } = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });

  return data;
}

export async function analyzeRepoUrl(repoUrl: string): Promise<{ reportId: string; status: string }> {
  const { data } = await api.post("/analyze-repo", { repoUrl });
  return data;
}

export async function fetchReport(reportId: string): Promise<Report> {
  const { data } = await api.get<Report>(`/report/${reportId}`);
  return data;
}

export async function fetchMyReports(): Promise<Report[]> {
  const { data } = await api.get<{ reports: Report[] }>("/reports");
  return data.reports;
}

export async function setIssueProgress(input: {
  reportId: string;
  issueKey: string;
  status: IssueProgressStatus;
}): Promise<void> {
  await api.patch(`/report/${input.reportId}/issue-progress`, {
    issueKey: input.issueKey,
    status: input.status
  });
}
