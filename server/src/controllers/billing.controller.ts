import { Request, Response } from "express";
import {
  createBillingPortalSession,
  createCheckoutSession,
  createTeamPlanRequest,
  handleStripeWebhook,
  syncCheckoutSession
} from "../services/billingService.js";

export async function createCheckoutSessionController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const plan = typeof req.body?.plan === "string" ? req.body.plan : "";
  if (!["individual-monthly", "individual-quarterly", "individual-annual"].includes(plan)) {
    res.status(400).json({ message: "Valid individual plan is required" });
    return;
  }

  try {
    const url = await createCheckoutSession({
      userId: req.user.id,
      plan: plan as "individual-monthly" | "individual-quarterly" | "individual-annual"
    });
    res.status(200).json({ url });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create checkout session" });
  }
}

export async function createPortalSessionController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const url = await createBillingPortalSession(req.user.id);
    res.status(200).json({ url });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to create billing portal session" });
  }
}

export async function requestTeamPlanController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const workEmail = typeof req.body?.workEmail === "string" ? req.body.workEmail.trim() : req.user.email;
  const companyName = typeof req.body?.companyName === "string" ? req.body.companyName.trim() : req.user.profile.companyName;
  const seatCount = typeof req.body?.seatCount === "number" && req.body.seatCount > 0 ? Math.floor(req.body.seatCount) : null;
  const notes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 1500) : null;

  if (!workEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    res.status(400).json({ message: "Valid workEmail is required" });
    return;
  }

  try {
    await createTeamPlanRequest({
      userId: req.user.id,
      companyName: companyName || null,
      workEmail,
      seatCount,
      notes
    });

    res.status(202).json({ message: "Team plan request submitted. Our sales team will reach out shortly." });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to submit team plan request" });
  }
}

export async function syncCheckoutSessionController(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    res.status(400).json({ message: "sessionId is required" });
    return;
  }

  try {
    await syncCheckoutSession({ userId: req.user.id, sessionId });
    res.status(200).json({ synced: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Failed to sync checkout session" });
  }
}

export async function stripeWebhookController(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ message: "Missing Stripe signature" });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ message: "Invalid webhook payload" });
    return;
  }

  try {
    await handleStripeWebhook(req.body, signature);
    res.status(200).json({ received: true });
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : "Webhook handling failed" });
  }
}
