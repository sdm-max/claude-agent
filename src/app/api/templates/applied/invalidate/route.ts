import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appliedTemplates } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

// POST /api/templates/applied/invalidate
// Body: { scope: string, projectId?: string }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const scope = body.scope as string | undefined;
  const projectId = body.projectId as string | undefined;

  // M2: scope whitelist 검증
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

  // M2: changes count 반환
  const result = db.update(appliedTemplates)
    .set({ isActive: 0 })
    .where(and(...conditions))
    .run();

  return NextResponse.json({ success: true, invalidated: result.changes ?? 0 });
}
