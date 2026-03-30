import { NextFunction, Request, Response } from "express";
import { getUserByToken } from "../services/authService.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const user = await getUserByToken(token);
  if (!user) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}
