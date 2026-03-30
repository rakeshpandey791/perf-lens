import { securityGuarantees } from "../content/lifecycleFlow";

export default function SecurityTrustSection(): JSX.Element {
  return (
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 shadow-sm sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Security and Privacy</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">Source Handling and Data Controls</h2>
      <p className="mt-2 max-w-3xl text-sm text-slate-700">
        We designed this workflow to minimize source exposure and persist only analysis outputs needed for report
        history and collaboration.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {securityGuarantees.map((item) => (
          <article key={item.title} className="rounded-2xl border border-emerald-100 bg-white/90 p-4">
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
          </article>
        ))}
      </div>

      <p className="mt-5 rounded-xl border border-emerald-200 bg-white/85 p-3 text-sm font-medium text-emerald-800">
        Current MVP posture: temporary source processing with report-only persistence and user-scoped access control.
      </p>
    </section>
  );
}
