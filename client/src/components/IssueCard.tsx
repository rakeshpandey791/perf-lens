import { issueTypeLabels } from "../content/reportInsights";
import CustomSelect from "./CustomSelect";
import type { IssueProgressStatus, ReportIssue } from "../types/report";

type IssueCardProps = {
  issue: ReportIssue;
  progress: IssueProgressStatus;
  onProgressChange: (next: IssueProgressStatus) => void;
};

const severityStyles: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200"
};
const priorityStyles: Record<string, string> = {
  P0: "bg-rose-100 text-rose-800 border-rose-200",
  P1: "bg-amber-100 text-amber-800 border-amber-200",
  P2: "bg-sky-100 text-sky-800 border-sky-200",
  P3: "bg-slate-100 text-slate-700 border-slate-200"
};

const progressStyles: Record<IssueProgressStatus, string> = {
  todo: "bg-slate-100 text-slate-700",
  "in-progress": "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700"
};

const cardToneByProgress: Record<IssueProgressStatus, string> = {
  todo: "border-slate-200 bg-white",
  "in-progress": "border-amber-200 bg-amber-50/30",
  completed: "border-emerald-200 bg-emerald-50/30"
};

export default function IssueCard({ issue, progress, onProgressChange }: IssueCardProps): JSX.Element {
  const issueLabel = issueTypeLabels[issue.type] ?? issue.type;
  const severityLabel = issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1);
  const progressLabel = progress === "todo" ? "To Do" : progress === "in-progress" ? "In Progress" : "Completed";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm transition ${cardToneByProgress[progress]}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{issueLabel}</p>
        <div className="flex items-center gap-1.5">
          {issue.priority ? (
            <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${priorityStyles[issue.priority]}`}>
              {issue.priority}
            </span>
          ) : null}
          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${severityStyles[issue.severity]}`}>
            {severityLabel}
          </span>
        </div>
      </div>
      <p className="text-sm text-slate-700">{issue.message}</p>
      {issue.probableSolution ? (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Probable Solution</p>
          <p className="mt-1 text-sm text-sky-900">{issue.probableSolution}</p>
        </div>
      ) : null}
      {(issue.estimatedEffort || issue.confidence || issue.reach) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {issue.estimatedEffort ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Effort {issue.estimatedEffort}
            </span>
          ) : null}
          {typeof issue.confidence === "number" ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Confidence {Math.round(issue.confidence * 100)}%
            </span>
          ) : null}
          {issue.reach ? (
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Reach {issue.reach.replace("-", " ")}
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">Location</p>
      <p className="mt-1 text-xs text-slate-500">
        {issue.filePath}
        {issue.line ? `:${issue.line}` : ""}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${progressStyles[progress]}`}>{progressLabel}</span>
        <CustomSelect
          value={progress}
          onChange={onProgressChange}
          widthClassName="w-40"
          options={[
            { value: "todo", label: "To Do" },
            { value: "in-progress", label: "In Progress" },
            { value: "completed", label: "Completed" }
          ]}
        />
      </div>
    </article>
  );
}
