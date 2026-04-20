// Workflow item shape validation — shared by POST /api/workflows and PATCH /api/workflows/[id].
// Kept in src/lib to avoid route-to-route import coupling (see D-3 rationale).

export interface WorkflowItem {
  templateId: string;
  excludeTopLevelKeys?: string[];
  excludeExtraFiles?: string[];
}

export function isValidItem(x: unknown): x is WorkflowItem {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.templateId !== "string" || o.templateId.length === 0) return false;
  if (o.excludeTopLevelKeys !== undefined && !Array.isArray(o.excludeTopLevelKeys)) return false;
  if (o.excludeExtraFiles !== undefined && !Array.isArray(o.excludeExtraFiles)) return false;
  return true;
}
