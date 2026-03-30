import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Report } from "../types/report";
import { fetchMyReports } from "../services/reportService";

export default function ReportsPage(): JSX.Element {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const data = await fetchMyReports();
        setReports(data);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">History</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">All Analysis Reports</h1>
        <p className="mt-2 text-sm text-slate-600">Review previous analyses, compare scores, and reopen reports anytime.</p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-600">Loading report history...</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-slate-600">No reports yet. Start your first analysis from the home page.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <Link
                key={report.jobId}
                to={`/report/${report.jobId}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-300 hover:bg-brand-50/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Report {report.jobId.slice(0, 8)}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-slate-700">{report.status}</span>
                </div>
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
    </section>
  );
}
