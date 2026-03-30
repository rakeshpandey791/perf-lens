import type { ReportIssue } from "../types/report";

export type SuggestionPlaybook = {
  id: string;
  title: string;
  why: string;
  action: string;
  impact: string;
  priority: "High" | "Medium" | "Low";
};

export const issueTypeLabels: Record<string, string> = {
  "large-import": "Large import",
  "large-file": "Large file",
  "component-complexity": "Component complexity",
  "deeply-nested-jsx": "Nested JSX",
  "inline-jsx-function": "Inline JSX function",
  "missing-react-memo": "Missing React.memo"
};

export function toPlaybooks(suggestions: string[], issues: ReportIssue[]): SuggestionPlaybook[] {
  const cards: SuggestionPlaybook[] = [];
  const hasType = (type: string): boolean => issues.some((issue) => issue.type === type);

  if (hasType("large-import") || suggestions.some((s) => s.toLowerCase().includes("lodash-es"))) {
    cards.push({
      id: "imports",
      title: "Optimize heavy imports",
      why: "Full-library imports increase shipped JS and delay first load.",
      action: "Replace default or namespace imports with function-level imports or lighter ESM alternatives.",
      impact: "Lower bundle weight and faster first paint.",
      priority: "High"
    });
  }

  if (hasType("component-complexity") || hasType("deeply-nested-jsx")) {
    cards.push({
      id: "component-split",
      title: "Break down complex components",
      why: "Large deeply nested components are harder to maintain and render less predictably.",
      action: "Split long components into smaller feature blocks and extract nested UI regions into children.",
      impact: "Faster iteration speed and fewer rendering bottlenecks.",
      priority: "High"
    });
  }

  if (hasType("inline-jsx-function")) {
    cards.push({
      id: "inline-handlers",
      title: "Stabilize event handlers",
      why: "Inline function props create new references every render and can trigger child re-renders.",
      action: "Move handlers out of JSX and wrap shared handlers with useCallback where beneficial.",
      impact: "Reduced avoidable re-renders in interactive screens.",
      priority: "Medium"
    });
  }

  if (hasType("missing-react-memo")) {
    cards.push({
      id: "memo",
      title: "Memoize stable presentation components",
      why: "Components with stable props can skip unnecessary reconciliation work.",
      action: "Use React.memo selectively on presentational components with predictable inputs.",
      impact: "Smoother updates in list-heavy or parent-heavy pages.",
      priority: "Medium"
    });
  }

  if (cards.length === 0) {
    cards.push({
      id: "clean",
      title: "Keep current architecture discipline",
      why: "Current scan found no major high-risk anti-pattern clusters.",
      action: "Track this score over releases and rerun analysis before major UI changes.",
      impact: "Preserves performance health over time.",
      priority: "Low"
    });
  }

  return cards;
}
