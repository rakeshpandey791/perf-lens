import fs from "fs/promises";
import path from "path";
import * as babelParser from "@babel/parser";
import traverseModule from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type {
  ArrowFunctionExpression,
  CallExpression,
  File,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  ImportDeclaration,
  JSXAttribute,
  JSXElement,
  VariableDeclarator
} from "@babel/types";
import type { AnalyzerIssue, AnalyzerResult } from "../types/analyzer.js";

const traverseAst = (
  typeof traverseModule === "function"
    ? traverseModule
    : (traverseModule as unknown as { default: unknown }).default
) as (ast: File, visitors: Record<string, unknown>) => void;

const CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
  ".astro"
]);
const HEAVY_LIBRARIES = new Set(["lodash", "moment", "ramda", "date-fns"]);
const LARGE_FILE_LOW_KB = 50;
const LARGE_FILE_MEDIUM_KB = 90;
const LARGE_FILE_HIGH_KB = 150;

export async function analyzeProject(projectRoot: string): Promise<AnalyzerResult> {
  const files = await collectCodeFiles(projectRoot);
  const detectedFrameworks = await detectFrameworks(projectRoot, files);
  const issues: AnalyzerIssue[] = [];
  const memoSuggestionCandidates = new Set<string>();

  const fileSizes = await Promise.all(
    files.map(async (filePath) => {
      const stats = await fs.stat(filePath);
      const relativePath = path.relative(projectRoot, filePath);

      return {
        absolutePath: filePath,
        relativePath,
        sizeBytes: stats.size,
        sizeKB: Number((stats.size / 1024).toFixed(2))
      };
    })
  );

  const largestFiles = [...fileSizes].sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 10);

  for (const file of largestFiles) {
    if (file.sizeKB < LARGE_FILE_LOW_KB) {
      continue;
    }

    const severity = file.sizeKB >= LARGE_FILE_HIGH_KB ? "high" : file.sizeKB >= LARGE_FILE_MEDIUM_KB ? "medium" : "low";
    issues.push({
      type: "large-file",
      severity,
      filePath: file.relativePath,
      message: `Large file detected (${file.sizeKB} KB). Consider splitting modules.`,
      meta: { sizeKB: file.sizeKB }
    });
  }

  for (const file of files) {
    const source = await fs.readFile(file, "utf-8");
    const relativePath = path.relative(projectRoot, file);
    const extension = path.extname(file).toLowerCase();

    const parseTargets = extractScriptTargets(source, extension);
    const fileComponents: string[] = [];
    let hasMemoUsage = false;
    let hasJsxSyntax = false;
    const hasReactSignals = detectReactSignals(source);

    for (const target of parseTargets) {
      let ast: File;
      try {
        ast = babelParser.parse(target.code, {
          sourceType: "unambiguous",
          plugins: ["jsx", "typescript", "decorators-legacy", "classProperties"]
        });
      } catch {
        continue;
      }

      traverseAst(ast, {
        ImportDeclaration(pathRef: NodePath<ImportDeclaration>) {
          const lib = pathRef.node.source.value;
          if (!HEAVY_LIBRARIES.has(lib)) {
            return;
          }

          const importsWholeLibrary = pathRef.node.specifiers.some((specifier) => {
            return specifier.type === "ImportDefaultSpecifier" || specifier.type === "ImportNamespaceSpecifier";
          });

          if (importsWholeLibrary) {
            issues.push({
              type: "large-import",
              severity: "high",
              filePath: relativePath,
              message: `Full library import from ${lib}. Import only required functions.`,
              line: addLineOffset(pathRef.node.loc?.start.line, target.lineOffset),
              meta: { library: lib }
            });
          }
        },
        FunctionDeclaration(pathRef: NodePath<FunctionDeclaration>) {
          registerComponentComplexity(
            pathRef.node.id,
            pathRef.node,
            addLineOffset(pathRef.node.body.loc?.start.line, target.lineOffset)
          );
        },
        VariableDeclarator(pathRef: NodePath<VariableDeclarator>) {
          const id = pathRef.node.id;
          const init = pathRef.node.init;

          if (id.type !== "Identifier" || !init) {
            return;
          }

          if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") {
            registerComponentComplexity(id, init, addLineOffset(init.loc?.start.line, target.lineOffset));
          }
        },
        JSXElement(pathRef: NodePath<JSXElement>) {
          hasJsxSyntax = true;
          const depth = getJsxDepth(pathRef.node);
          if (depth >= 7) {
            issues.push({
              type: "deeply-nested-jsx",
              severity: depth >= 10 ? "high" : "medium",
              filePath: relativePath,
              message: `Deeply nested JSX detected (depth ${depth}). Refactor with subcomponents.`,
              line: addLineOffset(pathRef.node.loc?.start.line, target.lineOffset),
              meta: { depth }
            });
          }
        },
        JSXAttribute(pathRef: NodePath<JSXAttribute>) {
          const value = pathRef.node.value;
          if (!value || value.type !== "JSXExpressionContainer") {
            return;
          }

          const expression = value.expression;
          if (expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression") {
            issues.push({
              type: "inline-jsx-function",
              severity: "medium",
              filePath: relativePath,
              message: "Inline function in JSX can cause avoidable re-renders.",
              line: addLineOffset(pathRef.node.loc?.start.line, target.lineOffset)
            });
          }
        },
        CallExpression(pathRef: NodePath<CallExpression>) {
          if (
            (pathRef.node.callee.type === "Identifier" && pathRef.node.callee.name === "memo") ||
            (pathRef.node.callee.type === "MemberExpression" &&
              pathRef.node.callee.object.type === "Identifier" &&
              pathRef.node.callee.object.name === "React" &&
              pathRef.node.callee.property.type === "Identifier" &&
              pathRef.node.callee.property.name === "memo")
          ) {
            hasMemoUsage = true;
          }
        }
      });
    }

    for (const componentName of fileComponents) {
      if (!hasMemoUsage && hasReactSignals && hasJsxSyntax) {
        memoSuggestionCandidates.add(`${relativePath}::${componentName}`);
      }
    }

    function registerComponentComplexity(
      id: Identifier | null | undefined,
      fnNode: FunctionDeclaration | ArrowFunctionExpression | FunctionExpression,
      line: number | undefined
    ): void {
      if (!id || !/^[A-Z]/.test(id.name)) {
        return;
      }

      const startLine = fnNode.loc?.start.line ?? 0;
      const endLine = fnNode.loc?.end.line ?? startLine;
      const lines = Math.max(endLine - startLine + 1, 0);

      fileComponents.push(id.name);

      if (lines > 200) {
        issues.push({
          type: "component-complexity",
          severity: lines > 300 ? "high" : "medium",
          filePath: relativePath,
          message: `Component ${id.name} is ${lines} lines long. Consider splitting it.`,
          line,
          meta: { component: id.name, lines }
        });
      }
    }
  }

  for (const key of memoSuggestionCandidates) {
    const [filePath, component] = key.split("::");
    issues.push({
      type: "missing-react-memo",
      severity: "low",
      filePath,
      message: `Component ${component} may benefit from React.memo.`,
      meta: { component }
    });
  }

  const enrichedIssues = issues.map((issue) => enrichIssue(issue));
  const scoring = computePerformanceScore(enrichedIssues, files.length);
  const suggestions = buildSuggestions(enrichedIssues);
  const summary = {
    totalFiles: files.length,
    totalIssues: enrichedIssues.length,
    performanceScore: scoring.overall,
    issueDensity: Number(((enrichedIssues.length / Math.max(files.length, 1)) * 100).toFixed(2)),
    severityDistribution: getSeverityDistribution(enrichedIssues),
    subScores: scoring.subScores,
    methodologyVersion: "v2.0.0"
  };

  return {
    summary,
    detectedFrameworks,
    bundleInsights: {
      largeImportCount: enrichedIssues.filter((item) => item.type === "large-import").length,
      largeFileCount: enrichedIssues.filter((item) => item.type === "large-file").length,
      complexityHotspots: enrichedIssues.filter(
        (item) => item.type === "component-complexity" || item.type === "deeply-nested-jsx"
      ).length,
      rerenderRiskCount: enrichedIssues.filter(
        (item) => item.type === "inline-jsx-function" || item.type === "missing-react-memo"
      ).length
    },
    largestFiles: largestFiles.map((item) => ({
      path: item.relativePath,
      sizeBytes: item.sizeBytes,
      sizeKB: item.sizeKB
    })),
    issues: enrichedIssues,
    suggestions
  };
}

async function collectCodeFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectCodeFiles(absolutePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function getJsxDepth(node: JSXElement): number {
  let maxChildDepth = 0;

  for (const child of node.children) {
    if (child.type === "JSXElement") {
      const childDepth = getJsxDepth(child);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
  }

  return maxChildDepth + 1;
}

function buildSuggestions(issues: AnalyzerIssue[]): string[] {
  const suggestions = new Set<string>();

  for (const issue of issues) {
    if (issue.type === "large-import") {
      suggestions.add("Use lodash-es or direct function imports instead of full lodash imports.");
    }

    if (issue.type === "component-complexity" || issue.type === "deeply-nested-jsx") {
      suggestions.add("Split large components into focused smaller components.");
    }

    if (issue.type === "inline-jsx-function") {
      suggestions.add("Avoid inline arrow functions in JSX. Use useCallback or pre-bound handlers.");
    }

    if (issue.type === "missing-react-memo") {
      suggestions.add("For React components, use React.memo for stable presentational components.");
    }
  }

  if (suggestions.size === 0) {
    suggestions.add("Great job. No major optimization opportunities detected in this scan.");
  }

  return Array.from(suggestions);
}

type ScriptTarget = {
  code: string;
  lineOffset: number;
};

function extractScriptTargets(source: string, extension: string): ScriptTarget[] {
  if (extension !== ".vue" && extension !== ".svelte" && extension !== ".astro") {
    return [{ code: source, lineOffset: 0 }];
  }

  const targets: ScriptTarget[] = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(source)) !== null) {
    const matchStart = match.index;
    const beforeMatch = source.slice(0, matchStart);
    const lineOffset = beforeMatch.split("\n").length - 1;
    targets.push({
      code: match[1],
      lineOffset
    });
  }

  if (extension === ".astro") {
    const frontmatterMatch = source.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const lineOffset = 1;
      targets.push({
        code: frontmatterMatch[1],
        lineOffset
      });
    }
  }

  return targets.length > 0 ? targets : [{ code: source, lineOffset: 0 }];
}

function addLineOffset(line: number | undefined, lineOffset: number): number | undefined {
  if (!line) {
    return undefined;
  }

  return line + lineOffset;
}

function detectReactSignals(source: string): boolean {
  return (
    /from\s+["']react(?:\/jsx-runtime)?["']/.test(source) ||
    /require\(["']react["']\)/.test(source) ||
    /\bReact\./.test(source)
  );
}

async function detectFrameworks(projectRoot: string, files: string[]): Promise<string[]> {
  const detected = new Set<string>();
  const relativeFiles = files.map((filePath) => path.relative(projectRoot, filePath).replace(/\\/g, "/"));
  const fileSet = new Set(relativeFiles);

  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = await readJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    packageJsonPath
  );
  const dependencies = new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {})
  ]);

  if (dependencies.has("next") || hasFilePrefix(fileSet, "next.config.")) {
    detected.add("Next.js");
  }

  if (dependencies.has("nuxt") || dependencies.has("nuxt3") || hasFilePrefix(fileSet, "nuxt.config.")) {
    detected.add("Nuxt");
  }

  if (dependencies.has("@angular/core") || fileSet.has("angular.json")) {
    detected.add("Angular");
  }

  if (dependencies.has("vue") || relativeFiles.some((filePath) => filePath.endsWith(".vue"))) {
    detected.add("Vue");
  }

  if (dependencies.has("svelte") || relativeFiles.some((filePath) => filePath.endsWith(".svelte"))) {
    detected.add("Svelte");
  }

  if (dependencies.has("astro") || hasFilePrefix(fileSet, "astro.config.")) {
    detected.add("Astro");
  }

  if (dependencies.has("remix") || dependencies.has("@remix-run/react") || hasFilePrefix(fileSet, "remix.config.")) {
    detected.add("Remix");
  }

  if (dependencies.has("gatsby")) {
    detected.add("Gatsby");
  }

  if (dependencies.has("solid-js")) {
    detected.add("SolidJS");
  }

  if (dependencies.has("preact")) {
    detected.add("Preact");
  }

  if (
    dependencies.has("react") ||
    dependencies.has("react-dom") ||
    relativeFiles.some((filePath) => filePath.endsWith(".jsx") || filePath.endsWith(".tsx"))
  ) {
    detected.add("React");
  }

  if (detected.size === 0) {
    detected.add("Generic JS/TS");
  }

  const priority = [
    "Next.js",
    "Nuxt",
    "Angular",
    "Vue",
    "Svelte",
    "Astro",
    "Remix",
    "Gatsby",
    "SolidJS",
    "Preact",
    "React",
    "Generic JS/TS"
  ];

  return Array.from(detected).sort((a, b) => priority.indexOf(a) - priority.indexOf(b));
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function hasFilePrefix(files: Set<string>, prefix: string): boolean {
  for (const filePath of files) {
    if (filePath.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

function computePerformanceScore(
  issues: AnalyzerIssue[],
  totalFiles: number
): {
  overall: number;
  subScores: {
    bundle: number;
    rendering: number;
    complexity: number;
    maintainability: number;
  };
} {
  if (issues.length === 0) {
    return {
      overall: 100,
      subScores: { bundle: 100, rendering: 100, complexity: 100, maintainability: 100 }
    };
  }

  const weightedByCategory = {
    bundle: 0,
    rendering: 0,
    complexity: 0,
    maintainability: 0
  };

  for (const issue of issues) {
    const impact = issue.weightedImpact ?? computeIssueWeightedImpact(issue);
    const category = mapIssueTypeToCategory(issue.type);
    weightedByCategory[category] += impact;
    weightedByCategory.maintainability += impact * 0.35;
  }

  const repoScale = clamp(Math.sqrt(Math.max(totalFiles, 1) / 20), 0.85, 1.9);

  const categoryCaps = {
    bundle: 55,
    rendering: 48,
    complexity: 52,
    maintainability: 40
  };

  const bundlePenalty = Math.min(weightedByCategory.bundle / repoScale, categoryCaps.bundle);
  const renderingPenalty = Math.min(weightedByCategory.rendering / repoScale, categoryCaps.rendering);
  const complexityPenalty = Math.min(weightedByCategory.complexity / repoScale, categoryCaps.complexity);
  const maintainabilityPenalty = Math.min(weightedByCategory.maintainability / repoScale, categoryCaps.maintainability);

  const subScores = {
    bundle: clamp(Math.round(100 - bundlePenalty), 0, 100),
    rendering: clamp(Math.round(100 - renderingPenalty), 0, 100),
    complexity: clamp(Math.round(100 - complexityPenalty), 0, 100),
    maintainability: clamp(Math.round(100 - maintainabilityPenalty), 0, 100)
  };

  const overall =
    subScores.bundle * 0.35 +
    subScores.rendering * 0.25 +
    subScores.complexity * 0.25 +
    subScores.maintainability * 0.15;

  return {
    overall: clamp(Math.round(overall), 0, 100),
    subScores
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function enrichIssue(issue: AnalyzerIssue): AnalyzerIssue {
  const impact = computeIssueWeightedImpact(issue);
  const confidence = computeConfidence(issue);
  const reach = computeReach(issue.filePath);
  const estimatedEffort = estimateEffort(issue.type);
  const priority = derivePriority(impact, confidence, reach, estimatedEffort);
  const probableSolution = getProbableSolution(issue);

  return {
    ...issue,
    priority,
    confidence,
    estimatedEffort,
    probableSolution,
    weightedImpact: Number(impact.toFixed(2)),
    reach
  };
}

function computeIssueWeightedImpact(issue: AnalyzerIssue): number {
  const impactByType: Record<string, number> = {
    "large-import": 9,
    "component-complexity": 7.5,
    "large-file": 6,
    "deeply-nested-jsx": 6.2,
    "inline-jsx-function": 4.2,
    "missing-react-memo": 3.4
  };
  const likelihoodByType: Record<string, number> = {
    "large-import": 0.95,
    "component-complexity": 0.85,
    "large-file": 0.8,
    "deeply-nested-jsx": 0.75,
    "inline-jsx-function": 0.72,
    "missing-react-memo": 0.6
  };
  const severityFactor: Record<string, number> = { high: 1.35, medium: 1, low: 0.75 };
  const reachFactor: Record<string, number> = { "critical-path": 1.2, module: 1, limited: 0.82 };

  const impact = impactByType[issue.type] ?? 4;
  const likelihood = likelihoodByType[issue.type] ?? 0.65;
  const severity = severityFactor[issue.severity] ?? 1;
  const reach = reachFactor[computeReach(issue.filePath)];
  const confidence = computeConfidence(issue);

  return impact * likelihood * severity * reach * confidence;
}

function computeConfidence(issue: AnalyzerIssue): number {
  const byType: Record<string, number> = {
    "large-import": 0.96,
    "large-file": 0.93,
    "component-complexity": 0.88,
    "deeply-nested-jsx": 0.86,
    "inline-jsx-function": 0.8,
    "missing-react-memo": 0.65
  };
  return byType[issue.type] ?? 0.75;
}

function computeReach(filePath: string): "limited" | "module" | "critical-path" {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  if (
    normalized.includes("/pages/") ||
    normalized.includes("/routes/") ||
    normalized.includes("/app/") ||
    normalized.includes("/src/app/")
  ) {
    return "critical-path";
  }
  if (normalized.includes("/components/") || normalized.includes("/shared/") || normalized.includes("/layouts/")) {
    return "module";
  }
  return "limited";
}

function estimateEffort(type: AnalyzerIssue["type"]): "S" | "M" | "L" {
  const effortByType: Record<string, "S" | "M" | "L"> = {
    "large-import": "S",
    "inline-jsx-function": "S",
    "missing-react-memo": "S",
    "large-file": "M",
    "deeply-nested-jsx": "M",
    "component-complexity": "L"
  };
  return effortByType[type] ?? "M";
}

function derivePriority(
  impact: number,
  confidence: number,
  reach: "limited" | "module" | "critical-path",
  effort: "S" | "M" | "L"
): "P0" | "P1" | "P2" | "P3" {
  const reachBoost = reach === "critical-path" ? 1.1 : reach === "module" ? 1.03 : 0.94;
  const effortBoost = effort === "S" ? 1.05 : effort === "L" ? 0.95 : 1;
  const prioritySignal = impact * confidence * reachBoost * effortBoost;

  if (prioritySignal >= 8.3) {
    return "P0";
  }
  if (prioritySignal >= 5.6) {
    return "P1";
  }
  if (prioritySignal >= 3.2) {
    return "P2";
  }
  return "P3";
}

function mapIssueTypeToCategory(type: AnalyzerIssue["type"]): "bundle" | "rendering" | "complexity" {
  if (type === "large-import" || type === "large-file") {
    return "bundle";
  }
  if (type === "inline-jsx-function" || type === "missing-react-memo") {
    return "rendering";
  }
  return "complexity";
}

function getSeverityDistribution(issues: AnalyzerIssue[]): { high: number; medium: number; low: number } {
  return issues.reduce(
    (acc, issue) => {
      if (issue.severity === "high") {
        acc.high += 1;
      } else if (issue.severity === "medium") {
        acc.medium += 1;
      } else {
        acc.low += 1;
      }
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
}

function getProbableSolution(issue: AnalyzerIssue): string {
  if (issue.type === "large-import") {
    const library = typeof issue.meta?.library === "string" ? issue.meta.library : "this library";
    return `Replace full ${library} import with direct function imports (or a tree-shakable variant) to reduce bundle weight.`;
  }

  if (issue.type === "large-file") {
    return "Split this file by responsibility, move shared utilities/hooks out, and lazy-load non-critical sections.";
  }

  if (issue.type === "component-complexity") {
    return "Extract subcomponents and custom hooks, then keep this component focused on orchestration and rendering.";
  }

  if (issue.type === "deeply-nested-jsx") {
    return "Flatten JSX by extracting repeated/conditional blocks into child components and simplify wrapper hierarchy.";
  }

  if (issue.type === "inline-jsx-function") {
    return "Move inline handlers to stable functions and memoize with useCallback where prop identity matters.";
  }

  if (issue.type === "missing-react-memo") {
    return "Wrap stable presentational components with React.memo after verifying props are immutable and predictable.";
  }

  return "Address this issue in the nearest module boundary and verify impact with a follow-up analysis.";
}
