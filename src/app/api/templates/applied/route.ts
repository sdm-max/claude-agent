import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appliedTemplates } from "@/lib/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";

// GET /api/templates/applied?scope=X[&projectId=Y]
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  const projectId = request.nextUrl.searchParams.get("projectId");

  // M1: scope whitelist 검증
  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }

  const db = getDb();
  const conditions = [eq(appliedTemplates.scope, scope), eq(appliedTemplates.isActive, 1)];
  if (projectId) {
    conditions.push(eq(appliedTemplates.projectId, projectId));
  } else {
    conditions.push(isNull(appliedTemplates.projectId));
  }

  const rows = db.select({
    id: appliedTemplates.id,
    templateId: appliedTemplates.templateId,
    templateName: appliedTemplates.templateName,
    appliedAt: appliedTemplates.appliedAt,
  }).from(appliedTemplates)
    .where(and(...conditions))
    .orderBy(desc(appliedTemplates.appliedAt))
    .all();

  return NextResponse.json(rows);
}
