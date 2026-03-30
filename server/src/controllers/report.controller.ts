import { Request, Response } from "express";
import { findReportByJobIdForUser, listReportsForUser, updateIssueProgressForUser } from "../services/reportRepository.js";
import type { IssueProgressStatus } from "../types/report.js";

export async function getReport(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const { id } = req.params;

  const report = await findReportByJobIdForUser(id, req.user.id);
  if (!report) {
    res.status(404).json({ message: "Report not found" });
    return;
  }

  res.json(report);
}

export async function listReports(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const reports = await listReportsForUser(req.user.id);
  res.json({ reports });
}

export async function updateIssueProgress(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const { id } = req.params;
  const issueKey = typeof req.body?.issueKey === "string" ? req.body.issueKey.trim() : "";
  const status = typeof req.body?.status === "string" ? (req.body.status as IssueProgressStatus) : null;

  if (!issueKey || !status || !["todo", "in-progress", "completed"].includes(status)) {
    res.status(400).json({ message: "Valid issueKey and status are required" });
    return;
  }

  const ok = await updateIssueProgressForUser(id, req.user.id, issueKey, status);
  if (!ok) {
    res.status(404).json({ message: "Report not found" });
    return;
  }

  res.json({ success: true });
}
