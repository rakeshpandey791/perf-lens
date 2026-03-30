import { Request, Response } from "express";
import { getDefaultProfile, getProfile, login, saveProfile, signup } from "../services/authService.js";
import type { UserComplianceProfile } from "../types/user.js";

export async function signupController(req: Request, res: Response): Promise<void> {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!name || !email || !password) {
    res.status(400).json({ message: "name, email and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }

  try {
    const result = await signup({ name, email, password });
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Signup failed" });
  }
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    res.status(400).json({ message: "email and password are required" });
    return;
  }

  try {
    const result = await login({ email, password });
    res.status(200).json(result);
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Login failed" });
  }
}

export async function meController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  res.json({ user: req.user });
}

export async function profileController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const user = await getProfile(req.user.id);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
}

export async function updateProfileController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : req.user.name;
  if (!name) {
    res.status(400).json({ message: "name is required" });
    return;
  }

  if (name.length > 100) {
    res.status(400).json({ message: "name must be at most 100 characters" });
    return;
  }

  const defaultProfile = getDefaultProfile();
  const profileInput = (req.body?.profile ?? {}) as Partial<UserComplianceProfile>;

  const complianceFrameworks = Array.isArray(profileInput.complianceFrameworks)
    ? profileInput.complianceFrameworks
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12)
    : defaultProfile.complianceFrameworks;

  const dataClassification = normalizeDataClassification(profileInput.dataClassification);
  const securityContactEmail = sanitizeString(profileInput.securityContactEmail, 150);

  if (securityContactEmail && !isValidEmail(securityContactEmail)) {
    res.status(400).json({ message: "securityContactEmail must be a valid email" });
    return;
  }

  const profile: UserComplianceProfile = {
    companyName: sanitizeString(profileInput.companyName, 120),
    jobTitle: sanitizeString(profileInput.jobTitle, 120),
    country: sanitizeString(profileInput.country, 80),
    timezone: sanitizeString(profileInput.timezone, 80),
    dataClassification,
    primaryUseCase: sanitizeString(profileInput.primaryUseCase, 240),
    complianceFrameworks,
    securityContactEmail,
    codeOwnershipConfirmed: Boolean(profileInput.codeOwnershipConfirmed),
    marketingUpdatesOptIn: Boolean(profileInput.marketingUpdatesOptIn),
    updatedAt: new Date().toISOString()
  };

  try {
    const user = await saveProfile({
      userId: req.user.id,
      name,
      profile
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to update profile" });
  }
}

function sanitizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeDataClassification(
  value: unknown
): "public" | "internal" | "confidential" | "restricted" | null {
  if (value === "public" || value === "internal" || value === "confidential" || value === "restricted") {
    return value;
  }

  return null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
