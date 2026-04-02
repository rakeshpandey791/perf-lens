import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getReport } from "../app/reportSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import CustomSelect from "../components/CustomSelect";
import MetricCard from "../components/MetricCard";
import IssueCard from "../components/IssueCard";
import { issueTypeLabels, toPlaybooks } from "../content/reportInsights";
import { setIssueProgress } from "../services/reportService";
import type { IssueProgressStatus } from "../types/report";
import { getIssueKey } from "../utils/issueKey";

export default function ReportPage(): JSX.Element {
  const { reportId = "" } = useParams();
  const dispatch = useAppDispatch();
  const { data, loading, error } = useAppSelector((state) => state.report);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "plan" | "issues">("overview");
  const [statusFilter, setStatusFilter] = useState<"all" | IssueProgressStatus>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [sortBy, setSortBy] = useState<"priority-desc" | "priority-asc" | "status" | "type">("priority-desc");
  const [visibleIssueCount, setVisibleIssueCount] = useState(12);
  const [showAllLargestFiles, setShowAllLargestFiles] = useState(false);

  useEffect(() => {
    if (!reportId) {
      return;
    }

    dispatch(getReport(reportId));
    const interval = setInterval(() => {
      dispatch(getReport(reportId));
    }, 3000);

    return () => clearInterval(interval);
  }, [dispatch, reportId]);

  if (loading && !data) {
    return <p className="text-sm text-slate-600">Loading analysis report...</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-700">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-600">Analysis report not available.</p>;
  }

  if (data.status === "queued" || data.status === "processing") {
    const phases = [
      { title: "Queued", description: "Your analysis request is registered in the job queue." },
      { title: "Preparing Source", description: "ZIP/repository is fetched and staged for scanning." },
      { title: "AST Analysis", description: "Parsing files, detecting patterns, and building insights." },
      { title: "Report Rendering", description: "Saving results and preparing dashboard sections." }
    ];
    const activeIndex = data.status === "queued" ? 0 : 2;

    return (
      <section className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Processing</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Generating Your Performance Report</h1>
          <p className="mt-2 text-sm text-slate-700">
            Project: <span className="font-semibold">{data.projectName}</span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Status: <span className="font-semibold capitalize text-slate-800">{data.status}</span>. We auto-refresh every 3
            seconds.
          </p>

          <div className="mt-5 processing-track">
            <div className="processing-progress" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {phases.map((phase, index) => (
              <article
                key={phase.title}
                className={`rounded-2xl border p-4 transition ${
                  index <= activeIndex ? "border-brand-200 bg-brand-50/60" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${index <= activeIndex ? "processing-dot" : "bg-slate-300"}`} />
                  <p className="text-sm font-semibold text-slate-900">{phase.title}</p>
                </div>
                <p className="text-sm text-slate-600">{phase.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700">Preparing report sections...</p>
          <div className="space-y-3">
            <div className="processing-skeleton h-12 w-full rounded-xl" />
            <div className="processing-skeleton h-12 w-11/12 rounded-xl" />
            <div className="processing-skeleton h-12 w-10/12 rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  if (data.status === "failed") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        <p className="font-medium">Analysis failed</p>
        <p className="mt-1 text-sm text-rose-800">
          Project: <span className="font-semibold">{data.projectName}</span>
        </p>
        <p className="mt-1 text-sm">{data.error ?? "Please retry with a valid frontend source (ZIP upload or GitHub URL)."}</p>
      </div>
    );
  }

  const score = data.summary.performanceScore;
  const scoreTone =
    score >= 80
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : score >= 60
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-rose-700 bg-rose-50 border-rose-200";
  const scoreLabel = score >= 80 ? "Healthy" : score >= 60 ? "Needs attention" : "Critical attention";

  const issueCounts = data.issues.reduce(
    (acc, issue) => {
      acc[issue.type] = (acc[issue.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const topIssueGroups = Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const filteredIssues = data.issues.filter((issue) => {
    const issueKey = getIssueKey(issue);
    const progress = data.issueProgress[issueKey] ?? "todo";
    const statusOk = statusFilter === "all" || progress === statusFilter;
    const severityOk = severityFilter === "all" || issue.severity === severityFilter;
    return statusOk && severityOk;
  });

  const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  const priorityRank: Record<string, number> = { P0: 4, P1: 3, P2: 2, P3: 1 };
  const statusRank: Record<IssueProgressStatus, number> = { todo: 1, "in-progress": 2, completed: 3 };

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    if (sortBy === "priority-desc") {
      const aPriority = priorityRank[a.priority ?? "P3"] * 10 + severityRank[a.severity];
      const bPriority = priorityRank[b.priority ?? "P3"] * 10 + severityRank[b.severity];
      return bPriority - aPriority;
    }
    if (sortBy === "priority-asc") {
      const aPriority = priorityRank[a.priority ?? "P3"] * 10 + severityRank[a.severity];
      const bPriority = priorityRank[b.priority ?? "P3"] * 10 + severityRank[b.severity];
      return aPriority - bPriority;
    }
    if (sortBy === "status") {
      const aStatus = data.issueProgress[getIssueKey(a)] ?? "todo";
      const bStatus = data.issueProgress[getIssueKey(b)] ?? "todo";
      return statusRank[aStatus] - statusRank[bStatus];
    }
    return a.type.localeCompare(b.type);
  });

  const visibleIssues = sortedIssues.slice(0, visibleIssueCount);
  const shownIssueCount = Math.min(visibleIssueCount, sortedIssues.length);
  const playbooks = toPlaybooks(data.suggestions, data.issues);
  const largestFilesToShow = showAllLargestFiles ? data.largestFiles : data.largestFiles.slice(0, 6);
  const tabItems = [
    { key: "overview", label: "Overview", helper: "Distribution + files", badge: topIssueGroups.length },
    { key: "plan", label: "Action Plan", helper: "Recommendations", badge: playbooks.length },
    { key: "issues", label: "Issues Board", helper: "Track execution", badge: sortedIssues.length }
  ] as const;

  async function handleProgressChange(issueKey: string, status: IssueProgressStatus): Promise<void> {
    if (!reportId) {
      return;
    }

    try {
      setProgressError(null);
      await setIssueProgress({ reportId, issueKey, status });
      await dispatch(getReport(reportId));
    } catch (progressUpdateError) {
      if (axios.isAxiosError(progressUpdateError)) {
        setProgressError(progressUpdateError.response?.data?.message ?? progressUpdateError.message);
      } else {
        setProgressError(progressUpdateError instanceof Error ? progressUpdateError.message : "Failed to update issue status");
      }
    }
  }

  return (
    <section className="space-y-7">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">Performance Report</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Analysis Summary</h1>
            <p className="mt-2 text-base font-semibold text-slate-900">Project: {data.projectName}</p>
            <p className="mt-2 text-sm text-slate-600">
              This report highlights where bundle size, component complexity, and render patterns are most likely
              slowing your app.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Detected Framework
              </span>
              {data.detectedFrameworks.map((framework) => (
                <span
                  key={framework}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {framework}
                </span>
              ))}
            </div>
          </div>
          <Link className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" to="/">
            Start New Analysis
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Total Files" value={data.summary.totalFiles} />
          <MetricCard label="Issues Found" value={data.summary.totalIssues} />
          <MetricCard label="Large Imports" value={data.bundleInsights.largeImportCount} />
          <MetricCard label="Complexity Hotspots" value={data.bundleInsights.complexityHotspots} />
          <MetricCard label="Re-render Risks" value={data.bundleInsights.rerenderRiskCount} />
        </div>

        {data.summary.subScores ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Bundle Score" value={`${data.summary.subScores.bundle}/100`} />
            <MetricCard label="Rendering Score" value={`${data.summary.subScores.rendering}/100`} />
            <MetricCard label="Complexity Score" value={`${data.summary.subScores.complexity}/100`} />
            <MetricCard label="Maintainability Score" value={`${data.summary.subScores.maintainability}/100`} />
          </div>
        ) : null}

        <div className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${scoreTone}`}>
          <span>Performance Score: {score}/100</span>
          <span className="opacity-70">|</span>
          <span>{scoreLabel}</span>
        </div>
        {typeof data.summary.issueDensity === "number" ? (
          <p className="mt-2 text-xs text-slate-500">
            Issue density: {data.summary.issueDensity} per 100 files
            {data.summary.methodologyVersion ? ` · Scoring ${data.summary.methodologyVersion}` : ""}
          </p>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 pt-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Report Navigator</h2>
          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto pb-1" aria-label="Report tabs">
            {tabItems.map((tab) => {
              const selected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.key)}
                  className={`min-w-[170px] rounded-t-xl border border-b-0 px-3 py-2 text-left transition ${
                    selected
                      ? "border-slate-300 bg-white text-slate-900 shadow-[0_-1px_0_0_#fff]"
                      : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selected ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-700"}`}>
                      {tab.badge}
                    </span>
                  </div>
                  <p className={`mt-1 text-xs ${selected ? "text-brand-700/90" : "text-slate-500"}`}>{tab.helper}</p>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="px-4 py-4 sm:px-6">
          <p className="text-sm text-slate-600">
            {activeTab === "overview"
              ? "Review issue concentration and largest files before execution planning."
              : activeTab === "plan"
                ? "Use these recommendations as a practical optimization playbook."
                : "Filter, sort, and update issue workflow states in one board."}
          </p>
        </div>

        {activeTab === "overview" ? (
          <div className="grid gap-6 px-4 pb-4 sm:px-6 sm:pb-6 xl:grid-cols-[1fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
              <h2 className="text-lg font-semibold text-slate-900">Issue Distribution</h2>
              <div className="mt-4 space-y-2">
                {topIssueGroups.length === 0 ? (
                  <p className="text-sm text-slate-600">No issues detected in this scan.</p>
                ) : (
                  topIssueGroups.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <span className="text-sm text-slate-700">{issueTypeLabels[type] ?? type}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Largest Files</h2>
                {data.largestFiles.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllLargestFiles((v) => !v)}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-600"
                  >
                    {showAllLargestFiles ? "View fewer files" : "View all files"}
                  </button>
                ) : null}
              </div>
              <ul className="space-y-2">
                {largestFilesToShow.map((file) => (
                  <li key={file.path} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="truncate pr-4 text-slate-700">{file.path}</span>
                    <span className="font-semibold text-slate-900">{file.sizeKB} KB</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {activeTab === "plan" ? (
          <section className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <h2 className="text-xl font-semibold text-slate-900">Action Plan</h2>
            <p className="mt-2 text-sm text-slate-600">
              Start from high-priority recommendations first to get visible wins in user experience.
            </p>
            <div className="mt-5 space-y-3">
              {playbooks.map((playbook) => (
                <article key={playbook.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">{playbook.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {playbook.priority} priority
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">Why:</span> {playbook.why}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">Do this:</span> {playbook.action}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">Expected impact:</span> {playbook.impact}
                  </p>
                </article>
              ))}
            </div>
            </div>
          </section>
        ) : null}

        {activeTab === "issues" ? (
          <section className="px-4 pb-4 sm:px-6 sm:pb-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-slate-900">Prioritized Issues</h2>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                  Showing {shownIssueCount} of {sortedIssues.length} issues
                </span>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Workflow board</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                <CustomSelect
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value as "all" | IssueProgressStatus);
                    setVisibleIssueCount(12);
                  }}
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "todo", label: "To Do" },
                    { value: "in-progress", label: "In Progress" },
                    { value: "completed", label: "Completed" }
                  ]}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</p>
                <CustomSelect
                  value={severityFilter}
                  onChange={(value) => {
                    setSeverityFilter(value as "all" | "high" | "medium" | "low");
                    setVisibleIssueCount(12);
                  }}
                  options={[
                    { value: "all", label: "All Priorities" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" }
                  ]}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sort by</p>
                <CustomSelect
                  value={sortBy}
                  onChange={(value) => setSortBy(value as "priority-desc" | "priority-asc" | "status" | "type")}
                  options={[
                    { value: "priority-desc", label: "Priority (High to Low)" },
                    { value: "priority-asc", label: "Priority (Low to High)" },
                    { value: "status", label: "Workflow Status" },
                    { value: "type", label: "Issue Type" }
                  ]}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setSeverityFilter("all");
                    setSortBy("priority-desc");
                    setVisibleIssueCount(12);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              </div>

            </div>

            {progressError ? <p className="mt-3 text-sm text-rose-700">{progressError}</p> : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {visibleIssues.map((issue, index) => (
                <IssueCard
                  key={`${issue.filePath}-${issue.type}-${index}`}
                  issue={issue}
                  progress={data.issueProgress[getIssueKey(issue)] ?? "todo"}
                  onProgressChange={(status) => handleProgressChange(getIssueKey(issue), status)}
                />
              ))}
            </div>

            {sortedIssues.length > visibleIssueCount ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setVisibleIssueCount((count) => count + 12)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Load 12 more
                </button>
              </div>
            ) : null}
            </div>
          </section>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        All existing report information is preserved and organized into tabs to reduce long-scroll fatigue.
      </section>
    </section>
  );
}
