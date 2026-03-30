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
    issues.push({
      type: "large-file",
      severity: file.sizeKB > 80 ? "high" : "medium",
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

  const suggestions = buildSuggestions(issues);
  const summary = {
    totalFiles: files.length,
    totalIssues: issues.length,
    performanceScore: computePerformanceScore(issues)
  };

  return {
    summary,
    detectedFrameworks,
    bundleInsights: {
      largeImportCount: issues.filter((item) => item.type === "large-import").length,
      largeFileCount: issues.filter((item) => item.type === "large-file").length,
      complexityHotspots: issues.filter(
        (item) => item.type === "component-complexity" || item.type === "deeply-nested-jsx"
      ).length,
      rerenderRiskCount: issues.filter(
        (item) => item.type === "inline-jsx-function" || item.type === "missing-react-memo"
      ).length
    },
    largestFiles: largestFiles.map((item) => ({
      path: item.relativePath,
      sizeBytes: item.sizeBytes,
      sizeKB: item.sizeKB
    })),
    issues,
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

function computePerformanceScore(issues: AnalyzerIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    if (issue.severity === "high") {
      score -= 8;
      continue;
    }

    if (issue.severity === "medium") {
      score -= 4;
      continue;
    }

    score -= 2;
  }

  return Math.max(score, 0);
}
