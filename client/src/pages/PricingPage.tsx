import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setUser } from "../app/authSlice";
import {
  createBillingPortalSession,
  createCheckoutSession,
  requestTeamPlan,
  syncCheckoutSession,
  type IndividualPlanCode
} from "../services/billingService";
import { getProfile } from "../services/authService";
import type { User } from "../types/auth";

const individualPlans: Array<{ code: IndividualPlanCode; title: string; price: string; blurb: string }> = [
  {
    code: "individual-monthly",
    title: "Individual Monthly",
    price: "$19/mo",
    blurb: "Good for solo developers and short release cycles."
  },
  {
    code: "individual-quarterly",
    title: "Individual Quarterly",
    price: "$49/quarter",
    blurb: "Lower monthly effective cost for active users."
  },
  {
    code: "individual-annual",
    title: "Individual Annual",
    price: "$159/year",
    blurb: "Best value for sustained usage across the year."
  }
];

export default function PricingPage(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<IndividualPlanCode | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [teamSubmitting, setTeamSubmitting] = useState(false);
  const [billingSyncing, setBillingSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [teamCompanyName, setTeamCompanyName] = useState(user?.profile.companyName ?? "");
  const [teamWorkEmail, setTeamWorkEmail] = useState(user?.profile.securityContactEmail ?? user?.email ?? "");
  const [teamSeatCount, setTeamSeatCount] = useState("");
  const [teamNotes, setTeamNotes] = useState("");

  async function refreshUser(): Promise<User | null> {
    if (!user) {
      return null;
    }
    try {
      const updated = await getProfile();
      dispatch(setUser(updated));
      return updated;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }
    setTeamCompanyName(user.profile.companyName ?? "");
    setTeamWorkEmail(user.profile.securityContactEmail ?? user.email);
  }, [user]);

  useEffect(() => {
    const billingState = searchParams.get("billing");
    const sessionId = searchParams.get("session_id");
    if (billingState !== "success" || !user || user.subscription.plan !== "free") {
      return;
    }

    setBillingSyncing(true);
    setSuccess("Payment received. Activating your plan...");
    setError(null);

    let attempts = 0;
    let stopped = false;
    const syncAndRefresh = async (): Promise<void> => {
      attempts += 1;
      try {
        if (sessionId) {
          await syncCheckoutSession(sessionId);
        }
      } catch {
        // Ignore transient sync errors and continue polling profile.
      }

      const updatedUser = await refreshUser();
      if (updatedUser?.subscription.plan !== "free") {
        setBillingSyncing(false);
        setSuccess("Plan activated successfully.");
        stopped = true;
        return;
      }

      if (attempts >= 12) {
        setBillingSyncing(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user?.subscription.plan]);

  async function handleCheckout(plan: IndividualPlanCode): Promise<void> {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      setCheckoutLoadingPlan(plan);
      setError(null);
      setSuccess(null);
      const url = await createCheckoutSession(plan);
      window.location.href = url;
    } catch (checkoutError) {
      if (axios.isAxiosError(checkoutError)) {
        setError(checkoutError.response?.data?.message ?? checkoutError.message);
      } else {
        setError(checkoutError instanceof Error ? checkoutError.message : "Failed to start checkout");
      }
    } finally {
      setCheckoutLoadingPlan(null);
    }
  }

  async function handleOpenBillingPortal(): Promise<void> {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      setPortalLoading(true);
      setError(null);
      setSuccess(null);
      const url = await createBillingPortalSession();
      window.location.href = url;
    } catch (portalError) {
      if (axios.isAxiosError(portalError)) {
        setError(portalError.response?.data?.message ?? portalError.message);
      } else {
        setError(portalError instanceof Error ? portalError.message : "Failed to open billing portal");
      }
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleTeamRequest(): Promise<void> {
    if (!user) {
      navigate("/auth");
      return;
    }

    try {
      setTeamSubmitting(true);
      setError(null);
      setSuccess(null);
      const result = await requestTeamPlan({
        workEmail: teamWorkEmail.trim(),
        companyName: teamCompanyName.trim() || undefined,
        seatCount: teamSeatCount.trim() ? Number(teamSeatCount) : undefined,
        notes: teamNotes.trim() || undefined
      });
      setSuccess(result.message);
      setTeamSeatCount("");
      setTeamNotes("");
    } catch (teamError) {
      if (axios.isAxiosError(teamError)) {
        setError(teamError.response?.data?.message ?? teamError.message);
      } else {
        setError(teamError instanceof Error ? teamError.message : "Failed to submit team plan request");
      }
    } finally {
      setTeamSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Pricing</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Plans and Billing</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose an individual subscription or request a custom team plan.
        </p>

        {user ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              Current plan:{" "}
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
            {user.subscription.plan !== "free" ? (
              <button
                type="button"
                onClick={() => void handleOpenBillingPortal()}
                disabled={portalLoading}
                className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portalLoading ? "Opening..." : "Manage Billing"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">Sign in to subscribe and manage billing.</p>
            <Link
              to="/auth"
              className="mt-2 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign In / Create Account
            </Link>
          </div>
        )}

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p>{success}</p>
            {billingSyncing ? <p className="mt-1 text-xs text-emerald-700">Syncing billing status with Stripe...</p> : null}
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>

      {user?.subscription.plan === "free" ? (
        <section className="grid gap-4 md:grid-cols-3">
          {individualPlans.map((plan) => (
            <article key={plan.code} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{plan.title}</h2>
              <p className="mt-1 text-2xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-2 text-sm text-slate-600">{plan.blurb}</p>
              <button
                type="button"
                onClick={() => void handleCheckout(plan.code)}
                disabled={checkoutLoadingPlan !== null}
                className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutLoadingPlan === plan.code ? "Redirecting..." : "Choose Plan"}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Team Custom Plan</h2>
        <p className="mt-2 text-sm text-slate-600">
          For teams needing multi-seat pricing, procurement support, or custom controls.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={teamCompanyName}
            onChange={(event) => setTeamCompanyName(event.target.value)}
            placeholder="Company name"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
          <input
            type="email"
            value={teamWorkEmail}
            onChange={(event) => setTeamWorkEmail(event.target.value)}
            placeholder="Work email"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
          <input
            type="number"
            min={1}
            value={teamSeatCount}
            onChange={(event) => setTeamSeatCount(event.target.value)}
            placeholder="Expected seat count"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
          <input
            type="text"
            value={teamNotes}
            onChange={(event) => setTeamNotes(event.target.value)}
            placeholder="Notes (optional)"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleTeamRequest()}
          disabled={teamSubmitting}
          className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {teamSubmitting ? "Submitting..." : "Request Team Plan"}
        </button>
      </section>
    </section>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
