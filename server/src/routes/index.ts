import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { loginController, meController, profileController, signupController, updateProfileController } from "../controllers/auth.controller.js";
import {
  createCheckoutSessionController,
  createPortalSessionController,
  requestTeamPlanController,
  syncCheckoutSessionController
} from "../controllers/billing.controller.js";
import { getReport, listReports, updateIssueProgress } from "../controllers/report.controller.js";
import { analyzeGithubRepo, uploadProject } from "../controllers/upload.controller.js";
import { requireAuth } from "../middleware/auth.js";

const upload = multer({
  dest: env.uploadDir,
  limits: {
    fileSize: env.uploadMaxMb * 1024 * 1024
  }
});

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.post("/auth/signup", signupController);
router.post("/auth/login", loginController);
router.get("/auth/me", requireAuth, meController);
router.get("/auth/profile", requireAuth, profileController);
router.patch("/auth/profile", requireAuth, updateProfileController);

router.post("/billing/checkout-session", requireAuth, createCheckoutSessionController);
router.post("/billing/sync-checkout", requireAuth, syncCheckoutSessionController);
router.post("/billing/portal-session", requireAuth, createPortalSessionController);
router.post("/billing/team-request", requireAuth, requestTeamPlanController);

router.post("/upload", requireAuth, upload.single("projectZip"), uploadProject);
router.post("/analyze-repo", requireAuth, analyzeGithubRepo);
router.get("/report/:id", requireAuth, getReport);
router.patch("/report/:id/issue-progress", requireAuth, updateIssueProgress);
router.get("/reports", requireAuth, listReports);
