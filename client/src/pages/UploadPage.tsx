import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import LifecycleFlowSection from "../components/LifecycleFlowSection";
import SecurityTrustSection from "../components/SecurityTrustSection";
import { useAppSelector } from "../app/hooks";
import { paidValuePoints } from "../content/lifecycleFlow";
import { type Report } from "../types/report";
import { analyzeRepoUrl, fetchMyReports, uploadZip } from "../services/reportService";

export default function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [sourceMode, setSourceMode] = useState<"zip" | "repo">("zip");
  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    async function loadReports(): Promise<void> {
      if (!user) {
        setReports([]);
        return;
      }

      try {
        setReportsLoading(true);
        const list = await fetchMyReports();
        setReports(list.slice(0, 3));
      } catch {
        setReports([]);
      } finally {
        setReportsLoading(false);
      }
    }

    void loadReports();
  }, [user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!file) {
      setError("Please choose a ZIP file");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await uploadZip(file);
      navigate(`/report/${response.reportId}`);
    } catch (uploadError) {
      if (axios.isAxiosError(uploadError)) {
        setError(uploadError.response?.data?.message ?? uploadError.message);
      } else {
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRepoSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!repoUrl.trim()) {
      setError("Please enter a GitHub repository URL");
      return;
    }

    try {
      setRepoLoading(true);
      setError(null);
      const response = await analyzeRepoUrl(repoUrl.trim());
      navigate(`/report/${response.reportId}`);
    } catch (repoError) {
      if (axios.isAxiosError(repoError)) {
        setError(repoError.response?.data?.message ?? repoError.message);
      } else {
        setError(repoError instanceof Error ? repoError.message : "Repository analysis failed");
      }
    } finally {
      setRepoLoading(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-7 sm:p-10 lg:p-12">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Performance Intelligence</p>
              <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                Analyze Your Frontend Codebase
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Upload a ZIP or connect a GitHub repo to generate a framework-aware performance report with file-size
                hotspots, complexity risk, render-risk indicators, and prioritized next actions.
              </p>
            </div>

            <div className="mt-7 inline-flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setSourceMode("zip");
                  setError(null);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  sourceMode === "zip" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                ZIP File
              </button>
              <button
                type="button"
                onClick={() => {
                  setSourceMode("repo");
                  setError(null);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  sourceMode === "repo" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
              >
                GitHub Repository
              </button>
            </div>

            {sourceMode === "zip" ? (
              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-5">
                  <p className="text-sm font-semibold text-slate-800">Upload ZIP File</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Best for private/local repositories. Max file size is controlled by your server settings.
                  </p>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                    }}
                    className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  />
                  {file ? <p className="mt-2 text-xs font-medium text-emerald-700">Selected: {file.name}</p> : null}
                </label>

                {error ? <p className="text-sm text-rose-700">{error}</p> : null}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Uploading..." : "Start Analysis"}
                  </button>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    Asynchronous analysis + live report polling
                  </span>
                  {!user ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      Sign in required to start analysis
                    </span>
                  ) : user.subscription.monthlyReportLimit != null ? (
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                      Remaining this cycle: {user.subscription.remainingReports ?? 0}
                    </span>
                  ) : null}
                </div>
              </form>
            ) : (
              <form className="mt-8 space-y-5" onSubmit={handleRepoSubmit}>
                <label className="block text-sm font-medium text-slate-700">GitHub repository URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/owner/repo"
                  value={repoUrl}
                  onChange={(event) => {
                    setRepoUrl(event.target.value);
                  }}
                  className="block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm"
                />
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={repoLoading}
                  className="rounded-xl border border-brand-200 bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {repoLoading ? "Submitting Repository..." : "Start Analysis"}
                </button>
                {user?.subscription.monthlyReportLimit != null ? (
                  <p className="text-xs text-sky-700">
                    Free plan remaining this cycle: {user.subscription.remainingReports ?? 0}. Upgrade in Profile for higher limits.
                  </p>
                ) : null}
              </form>
            )}

            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Framework Coverage</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Astro"].map((framework) => (
                  <span
                    key={framework}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    {framework}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                We analyze JS/TS modules plus script sections in framework files to generate one unified performance report.
              </p>
            </div>
          </div>

          <aside className="relative bg-gradient-to-br from-brand-50 via-sky-50 to-white p-7 sm:p-10 lg:p-12">
            <div className="absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand-200/40 blur-2xl" />
            <div className="relative space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Why teams pay for this</h2>
              <p className="text-sm text-slate-600">
                It converts analysis output into execution-ready decisions for engineering, architecture, and release planning.
              </p>

              <ul className="pt-2 space-y-3">
                {paidValuePoints.map((point) => (
                  <li key={point} className="rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-700">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <LifecycleFlowSection />
      <SecurityTrustSection />

      {user ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">History</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Latest Reports</h2>
            </div>
            <Link to="/reports" className="text-sm font-semibold text-brand-700 hover:text-brand-600">
              View all reports
            </Link>
          </div>

          {reportsLoading ? (
            <p className="text-sm text-slate-600">Loading report history...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-slate-600">No reports yet. Start your first analysis above.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {reports.map((report) => (
                <Link
                  key={report.jobId}
                  to={`/report/${report.jobId}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{report.projectName}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700">
                    {report.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Report ID: {report.jobId.slice(0, 8)}</p>
                <p className="mt-2 text-sm text-slate-600">
                  Score {report.summary.performanceScore}/100 · Issues {report.summary.totalIssues}
                </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {report.detectedFrameworks.slice(0, 2).map((framework) => (
                      <span
                        key={`${report.jobId}-${framework}`}
                        className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700"
                      >
                        {framework}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{new Date(report.createdAt).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
