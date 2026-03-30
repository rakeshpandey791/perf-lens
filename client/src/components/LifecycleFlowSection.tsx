import { lifecycleSteps } from "../content/lifecycleFlow";

export default function LifecycleFlowSection(): JSX.Element {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Lifecycle Animation</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Full Tool Flow</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            This animated pipeline is rendered from one config file. Update the processing flow once, and this section
            stays in sync automatically.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          Source: lifecycleFlow.ts
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="lifecycle-track">
          <div className="lifecycle-progress" />
          <div className="lifecycle-scan" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Client</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">API + Queue</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Worker</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Postgres</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">Dashboard</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {lifecycleSteps.map((step, index) => (
          <article
            key={step.id}
            className="lifecycle-step rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="lifecycle-pulse inline-block h-2.5 w-2.5 rounded-full bg-brand-500" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step {index + 1}</p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {step.timing}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{step.description}</p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{step.owner}</p>
              <p className="mt-2 text-xs text-slate-500">{step.output}</p>
              <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                {step.emphasis}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
