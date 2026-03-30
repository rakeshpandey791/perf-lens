import { Request, Response } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { analysisQueue } from "../queue/analysisQueue.js";
import { createQueuedReportForUser } from "../services/reportRepository.js";

export async function uploadProject(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: "ZIP file is required" });
    return;
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  if (extension !== ".zip") {
    res.status(400).json({ message: "Only .zip files are supported" });
    return;
  }

  const reportId = uuidv4();

  try {
    await createQueuedReportForUser(reportId, req.user.id);
  } catch (error) {
    if (error instanceof Error && error.name === "FREE_PLAN_LIMIT_REACHED") {
      res.status(402).json({
        message: "Free plan monthly limit reached (5 reports). Upgrade to an Individual plan for higher limits."
      });
      return;
    }
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to queue analysis request" });
    return;
  }

  await analysisQueue.add("analyze-project", {
    reportId,
    zipPath: path.resolve(req.file.path)
  });

  res.status(202).json({
    reportId,
    status: "queued",
    message: "Project uploaded. Analysis started."
  });
}

export async function analyzeGithubRepo(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const repoUrl = typeof req.body?.repoUrl === "string" ? req.body.repoUrl.trim() : "";

  if (!repoUrl) {
    res.status(400).json({ message: "repoUrl is required" });
    return;
  }

  if (!isValidGithubUrl(repoUrl)) {
    res.status(400).json({ message: "Only valid GitHub repository URLs are supported" });
    return;
  }

  const reportId = uuidv4();
  try {
    await createQueuedReportForUser(reportId, req.user.id);
  } catch (error) {
    if (error instanceof Error && error.name === "FREE_PLAN_LIMIT_REACHED") {
      res.status(402).json({
        message: "Free plan monthly limit reached (5 reports). Upgrade to an Individual plan for higher limits."
      });
      return;
    }
    res.status(500).json({ message: error instanceof Error ? error.message : "Failed to queue analysis request" });
    return;
  }

  await analysisQueue.add("analyze-github-repo", {
    reportId,
    repoUrl
  });

  res.status(202).json({
    reportId,
    status: "queued",
    message: "GitHub repository queued for analysis."
  });
}

function isValidGithubUrl(url: string): boolean {
  return /^https:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?\/?$/i.test(url);
}
