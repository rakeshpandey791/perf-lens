import { api } from "./api";

export type IndividualPlanCode = "individual-monthly" | "individual-quarterly" | "individual-annual";

export async function createCheckoutSession(plan: IndividualPlanCode): Promise<string> {
  const { data } = await api.post<{ url: string }>("/billing/checkout-session", { plan });
  return data.url;
}

export async function syncCheckoutSession(sessionId: string): Promise<void> {
  await api.post("/billing/sync-checkout", { sessionId });
}

export async function createBillingPortalSession(): Promise<string> {
  const { data } = await api.post<{ url: string }>("/billing/portal-session");
  return data.url;
}

export async function requestTeamPlan(input: {
  workEmail: string;
  companyName?: string;
  seatCount?: number;
  notes?: string;
}): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/billing/team-request", input);
  return data;
}
