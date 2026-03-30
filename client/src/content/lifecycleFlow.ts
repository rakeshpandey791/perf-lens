export type LifecycleStep = {
  id: string;
  title: string;
  description: string;
  owner: string;
  output: string;
  timing: string;
  emphasis: string;
};

export const lifecycleSteps: LifecycleStep[] = [
  {
    id: "upload",
    title: "Source Submitted",
    description: "User submits a frontend project via ZIP or GitHub repository URL.",
    owner: "Client -> API",
    output: "Validated source + reportId",
    timing: "2-5 sec",
    emphasis: "Access control + validation"
  },
  {
    id: "queue",
    title: "Job Queued",
    description: "API creates a queued report record and pushes a BullMQ job.",
    owner: "Server + Redis",
    output: "analysis-jobs queue task",
    timing: "<1 sec",
    emphasis: "Reliable async orchestration"
  },
  {
    id: "analyze",
    title: "Framework-Aware AST Analysis",
    description:
      "Worker scans framework source files and analyzes JS/TS script logic for large imports, complexity, and render risks.",
    owner: "Worker",
    output: "Insights + issues + score",
    timing: "depends on repo size",
    emphasis: "React, Vue, Svelte, Angular, Next.js, Nuxt, Astro"
  },
  {
    id: "persist",
    title: "Report Persisted",
    description: "Worker writes completed report payload to PostgreSQL.",
    owner: "Worker + Postgres",
    output: "Status: completed",
    timing: "<1 sec",
    emphasis: "User-scoped report storage"
  },
  {
    id: "render",
    title: "Live Report",
    description: "Dashboard polls report endpoint and renders findings instantly.",
    owner: "Client",
    output: "Actionable UI cards",
    timing: "live",
    emphasis: "Prioritized action board"
  }
];

export const paidValuePoints: string[] = [
  "Framework-aware analysis across modern frontend stacks",
  "Prioritized issue workflow for engineering triage and ownership",
  "Performance score and risk signals for release-readiness reviews",
  "Actionable recommendations mapped to observed code patterns",
  "Asynchronous architecture designed for higher analysis throughput"
];

export const frameworkAwarenessPoints: string[] = [
  "Supports modern frontend stacks using JS/TS source: React, Next.js, Vue, Nuxt, Angular, Svelte, Astro, and mixed repos.",
  "Analyzes script logic in framework files (for example .vue/.svelte/.astro script sections) and standard JS/TS modules.",
  "Keeps one normalized report format to help teams compare risk and progress consistently across projects."
];

export const securityGuarantees: Array<{ title: string; detail: string }> = [
  {
    title: "Temporary source processing",
    detail: "Uploaded or cloned source is used for analysis and cleaned up from temporary storage after job completion."
  },
  {
    title: "Controlled processing boundary",
    detail: "In this MVP deployment, analysis runs within your app environment and does not rely on third-party code indexing services."
  },
  {
    title: "Report metadata persistence",
    detail: "The platform stores report outputs (issues, metrics, scores, progress state), not raw source files."
  },
  {
    title: "Queue-isolated execution",
    detail: "Analysis runs asynchronously via worker jobs, reducing impact on interactive API requests."
  }
];
