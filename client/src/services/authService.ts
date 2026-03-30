import { api } from "./api";
import type { AuthResponse, DataClassification, User } from "../types/auth";

export async function signup(input: { name: string; email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/signup", input);
  return data;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", input);
  return data;
}

export async function me(): Promise<User> {
  const { data } = await api.get<{ user: User }>("/auth/me");
  return data.user;
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get<{ user: User }>("/auth/profile");
  return data.user;
}

export async function updateProfile(input: {
  name: string;
  profile: {
    companyName: string | null;
    jobTitle: string | null;
    country: string | null;
    timezone: string | null;
    dataClassification: DataClassification;
    primaryUseCase: string | null;
    complianceFrameworks: string[];
    securityContactEmail: string | null;
    codeOwnershipConfirmed: boolean;
    marketingUpdatesOptIn: boolean;
  };
}): Promise<User> {
  const { data } = await api.patch<{ user: User }>("/auth/profile", input);
  return data.user;
}
