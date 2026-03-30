import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env.js";
import type { PublicUser, UserComplianceProfile, UserSubscriptionInterval, UserSubscriptionPlan } from "../types/user.js";
import { buildDefaultProfile, createUser, findUserByEmail, findUserById, updateUserProfile, updateUserSubscriptionPlan } from "./userRepository.js";

const JWT_EXPIRES_IN = "7d";

export async function signup(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: PublicUser }> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new Error("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const created = await createUser({
    id: uuidv4(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash
  });

  const user: PublicUser = {
    id: created.id,
    name: created.name,
    email: created.email,
    profile: created.profile,
    subscription: created.subscription
  };

  return {
    token: createToken(user.id),
    user
  };
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ token: string; user: PublicUser }> {
  const userRecord = await findUserByEmail(input.email);
  if (!userRecord) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await bcrypt.compare(input.password, userRecord.passwordHash);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  const user: PublicUser = {
    id: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    profile: userRecord.profile,
    subscription: userRecord.subscription
  };

  return {
    token: createToken(user.id),
    user
  };
}

export async function getUserByToken(token: string): Promise<PublicUser | null> {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId: string };
    return findUserById(payload.userId);
  } catch {
    return null;
  }
}

export async function getProfile(userId: string): Promise<PublicUser | null> {
  return findUserById(userId);
}

export async function saveProfile(input: {
  userId: string;
  name: string;
  profile: UserComplianceProfile;
}): Promise<PublicUser | null> {
  return updateUserProfile(input.userId, input.profile, input.name);
}

export function getDefaultProfile(): UserComplianceProfile {
  return buildDefaultProfile();
}

export async function saveSubscriptionPlan(input: {
  userId: string;
  plan: UserSubscriptionPlan;
  interval: UserSubscriptionInterval;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}): Promise<PublicUser | null> {
  return updateUserSubscriptionPlan(
    input.userId,
    input.plan,
    input.interval,
    input.stripeSubscriptionId,
    input.stripeCustomerId,
    input.currentPeriodStart,
    input.currentPeriodEnd
  );
}

function createToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN });
}
