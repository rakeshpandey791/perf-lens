import axios from "axios";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CustomSelect from "../components/CustomSelect";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../app/authSlice";
import { getProfile, updateProfile } from "../services/authService";
import { syncCheckoutSession } from "../services/billingService";
import type { DataClassification, User } from "../types/auth";

const classificationOptions = [
  { value: "none", label: "Select data classification" },
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential" },
  { value: "restricted", label: "Restricted" }
] as const;

const complianceFrameworkOptions = ["SOC 2", "ISO 27001", "GDPR", "HIPAA", "PCI DSS"] as const;

type ClassificationSelectValue = (typeof classificationOptions)[number]["value"];

export default function ProfilePage(): JSX.Element {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [classification, setClassification] = useState<ClassificationSelectValue>("none");
  const [primaryUseCase, setPrimaryUseCase] = useState("");
  const [securityContactEmail, setSecurityContactEmail] = useState("");
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [codeOwnershipConfirmed, setCodeOwnershipConfirmed] = useState(false);
  const [marketingUpdatesOptIn, setMarketingUpdatesOptIn] = useState(false);

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      try {
        setLoading(true);
        setError(null);
        const profileUser = await getProfile();
        syncForm(profileUser);
        dispatch(setUser(profileUser));
      } catch (profileError) {
        if (axios.isAxiosError(profileError)) {
          setError(profileError.response?.data?.message ?? profileError.message);
        } else {
          setError(profileError instanceof Error ? profileError.message : "Failed to load profile");
        }
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [dispatch]);

  useEffect(() => {
    const billingState = searchParams.get("billing");
    const sessionId = searchParams.get("session_id");
    if (billingState !== "success" || !user || user.subscription.plan !== "free" || !sessionId) {
      return;
    }

    let attempts = 0;
    let stopped = false;
    setSuccess("Payment received. Activating your plan...");
    setError(null);

    const syncAndRefresh = async (): Promise<void> => {
      attempts += 1;
      try {
        await syncCheckoutSession(sessionId);
      } catch {
        // Ignore transient sync errors and continue polling.
      }

      try {
        const profileUser = await getProfile();
        dispatch(setUser(profileUser));
        if (profileUser.subscription.plan !== "free") {
          setSuccess("Plan activated successfully.");
          stopped = true;
          return;
        }
      } catch {
        // Keep polling until timeout.
      }

      if (attempts >= 12) {
        setError("Payment succeeded but billing sync is delayed. Please refresh in 1 minute.");
        stopped = true;
      }
    };

    void syncAndRefresh();

    const intervalId = window.setInterval(async () => {
      if (stopped) {
        window.clearInterval(intervalId);
        return;
      }
      await syncAndRefresh();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [dispatch, searchParams, user?.id, user?.subscription.plan]);

  const complianceHint = useMemo(
    () => [
      "Helps map data handling obligations by region and framework.",
      "Keeps a security contact for incident or policy notices.",
      "Confirms you are authorized to upload and scan code."
    ],
    []
  );

  if (!user) {
    return <p className="text-sm text-slate-600">Loading session...</p>;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const updatedUser = await updateProfile({
        name: name.trim(),
        profile: {
          companyName: normalizeText(companyName),
          jobTitle: normalizeText(jobTitle),
          country: normalizeText(country),
          timezone: normalizeText(timezone),
          dataClassification: normalizeClassification(classification),
          primaryUseCase: normalizeText(primaryUseCase),
          complianceFrameworks: selectedFrameworks,
          securityContactEmail: normalizeText(securityContactEmail),
          codeOwnershipConfirmed,
          marketingUpdatesOptIn
        }
      });

      dispatch(setUser(updatedUser));
      syncForm(updatedUser);
      setSuccess("Profile changes saved.");
    } catch (profileError) {
      if (axios.isAxiosError(profileError)) {
        setError(profileError.response?.data?.message ?? profileError.message);
      } else {
        setError(profileError instanceof Error ? profileError.message : "Failed to update profile");
      }
    } finally {
      setSaving(false);
    }
  }

  function syncForm(profileUser: User): void {
    setName(profileUser.name ?? "");
    setCompanyName(profileUser.profile.companyName ?? "");
    setJobTitle(profileUser.profile.jobTitle ?? "");
    setCountry(profileUser.profile.country ?? "");
    setTimezone(profileUser.profile.timezone ?? "");
    setClassification((profileUser.profile.dataClassification ?? "none") as ClassificationSelectValue);
    setPrimaryUseCase(profileUser.profile.primaryUseCase ?? "");
    setSecurityContactEmail(profileUser.profile.securityContactEmail ?? "");
    setSelectedFrameworks(profileUser.profile.complianceFrameworks ?? []);
    setCodeOwnershipConfirmed(Boolean(profileUser.profile.codeOwnershipConfirmed));
    setMarketingUpdatesOptIn(Boolean(profileUser.profile.marketingUpdatesOptIn));
  }

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Subscription</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Current Plan Snapshot</h2>
            <p className="mt-2 text-sm text-slate-600">
              Plan:{" "}
              <span className="font-semibold capitalize text-slate-900">
                {user.subscription.plan}
                {user.subscription.interval ? ` (${user.subscription.interval})` : ""}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {user.subscription.monthlyReportLimit == null
                ? "Unlimited report requests enabled."
                : `${user.subscription.monthlyReportsUsed}/${user.subscription.monthlyReportLimit} reports used this cycle.`}
            </p>
            {user.subscription.currentPeriodStart ? (
              <p className="mt-1 text-xs text-slate-600">
                Plan started: <span className="font-medium">{formatDate(user.subscription.currentPeriodStart)}</span>
              </p>
            ) : null}
            {user.subscription.currentPeriodEnd ? (
              <p className="mt-1 text-xs text-slate-600">
                {user.subscription.plan === "free" ? "Usage cycle ends" : "Renews on"}:{" "}
                <span className="font-medium">{formatDate(user.subscription.currentPeriodEnd)}</span>
              </p>
            ) : null}
          </div>
          <Link
            to="/pricing"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Manage Plan and Billing
          </Link>
        </div>
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Account</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Profile and Compliance Settings</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage account and governance details used for access control, audit context, and compliant operational workflows.
        </p>
      </div>

      <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" onSubmit={handleSubmit}>
        {loading ? <p className="text-sm text-slate-600">Loading profile...</p> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Full name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Company name</span>
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Acme Inc"
              className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Job title</span>
            <input
              type="text"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              placeholder="Engineering Manager"
              className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Country</span>
            <input
              type="text"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              placeholder="India"
              className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Asia/Kolkata"
              className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Data classification</span>
            <CustomSelect
              value={classification}
              onChange={(value) => setClassification(value)}
              options={classificationOptions.map((option) => ({ value: option.value, label: option.label }))}
            />
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Primary use case</span>
          <textarea
            value={primaryUseCase}
            onChange={(event) => setPrimaryUseCase(event.target.value)}
            rows={3}
            placeholder="Example: CI performance regression checks for React apps."
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-semibold text-slate-700">Security / compliance contact email</span>
          <input
            type="email"
            value={securityContactEmail}
            onChange={(event) => setSecurityContactEmail(event.target.value)}
            placeholder="security@company.com"
            className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
        </label>

        <div className="mt-5">
          <p className="text-sm font-semibold text-slate-700">Applicable frameworks</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {complianceFrameworkOptions.map((framework) => {
              const active = selectedFrameworks.includes(framework);
              return (
                <button
                  key={framework}
                  type="button"
                  onClick={() =>
                    setSelectedFrameworks((current) =>
                      active ? current.filter((item) => item !== framework) : [...current, framework]
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {framework}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={codeOwnershipConfirmed}
              onChange={(event) => setCodeOwnershipConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>I confirm I am authorized to upload and analyze the repositories/codebases used in this account.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={marketingUpdatesOptIn}
              onChange={(event) => setMarketingUpdatesOptIn(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Send occasional product and security update digests.</span>
          </label>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
          <p className="text-sm font-semibold text-sky-900">Why we collect this</p>
          <ul className="mt-2 space-y-1 text-xs text-sky-800">
            {complianceHint.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Last updated: {user.profile.updatedAt ? new Date(user.profile.updatedAt).toLocaleString() : "Not set"}
          </span>
        </div>
      </form>
    </section>
  );
}

function normalizeText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeClassification(value: ClassificationSelectValue): DataClassification {
  return value === "none" ? null : value;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
