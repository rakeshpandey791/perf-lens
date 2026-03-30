export type DataClassification = "public" | "internal" | "confidential" | "restricted" | null;

export type UserComplianceProfile = {
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
  updatedAt: string | null;
};

export type UserSubscriptionPlan = "free" | "individual" | "team";
export type UserSubscriptionInterval = "monthly" | "quarterly" | "annual" | "custom" | null;

export type UserSubscription = {
  plan: UserSubscriptionPlan;
  status: "active";
  interval: UserSubscriptionInterval;
  monthlyReportLimit: number | null;
  monthlyReportsUsed: number;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  remainingReports: number | null;
  canRequestReport: boolean;
};

export type User = {
  id: string;
  name: string;
  email: string;
  profile: UserComplianceProfile;
  subscription: UserSubscription;
};

export type AuthResponse = {
  token: string;
  user: User;
};
