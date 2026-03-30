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

export type UserComplianceProfile = {
  companyName: string | null;
  jobTitle: string | null;
  country: string | null;
  timezone: string | null;
  dataClassification: "public" | "internal" | "confidential" | "restricted" | null;
  primaryUseCase: string | null;
  complianceFrameworks: string[];
  securityContactEmail: string | null;
  codeOwnershipConfirmed: boolean;
  marketingUpdatesOptIn: boolean;
  updatedAt: string | null;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  profile: UserComplianceProfile;
  subscription: UserSubscription;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  profile: UserComplianceProfile;
  subscription: UserSubscription;
};
