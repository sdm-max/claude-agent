import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appliedTemplates } from "@/lib/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { ClaudeSettings } from "@/lib/settings-schema";

// GET /api/templates/applied/trace?scope=X[&projectId=Y]
// Response: {
//   "permissions.allow": { "Edit(*)": [{ templateId, templateName }] },
//   "permissions.ask": { ... },
//   "permissions.deny": { ... }
// }
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }

  const db = getDb();
  const conditions = [eq(appliedTemplates.scope, scope), eq(appliedTemplates.isActive, 1)];
  if (projectId) conditions.push(eq(appliedTemplates.projectId, projectId));
  else conditions.push(isNull(appliedTemplates.projectId));

  const rows = db
    .select({
      templateId: appliedTemplates.templateId,
      templateName: appliedTemplates.templateName,
      deltaJson: appliedTemplates.deltaJson,
    })
    .from(appliedTemplates)
    .where(and(...conditions))
    .orderBy(desc(appliedTemplates.appliedAt))
    .all();

  type Source = { templateId: string; templateName: string };
  const trace: {
    "permissions.allow": Record<string, Source[]>;
    "permissions.ask": Record<string, Source[]>;
    "permissions.deny": Record<string, Source[]>;
  } = {
    "permissions.allow": {},
    "permissions.ask": {},
    "permissions.deny": {},
  };

  for (const row of rows) {
    let delta: ClaudeSettings = {};
    try { delta = JSON.parse(row.deltaJson); } catch { continue; }
    const src: Source = { templateId: row.templateId, templateName: row.templateName };

    for (const field of ["allow", "ask", "deny"] as const) {
      const arr = delta.permissions?.[field];
      if (!arr) continue;
      const key = `permissions.${field}` as const;
      for (const item of arr) {
        if (!trace[key][item]) trace[key][item] = [];
        trace[key][item].push(src);
      }
    }
  }

  return NextResponse.json(trace);
}
