import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { workflows, appliedTemplates } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { isValidItem } from "@/lib/workflows/validate";

type Params = { params: Promise<{ id: string }> };

const VALID_SCOPES = ["global", "user", "project", "local"];

// GET
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const row = db.select().from(workflows).where(eq(workflows.id, id)).get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Active apply count (이 워크플로우로부터 apply 되어 아직 active 인 것)
  const activeCount = db.select()
    .from(appliedTemplates)
    .where(and(eq(appliedTemplates.workflowId, id), eq(appliedTemplates.isActive, 1)))
    .all().length;

  return NextResponse.json({
    id: row.id,
    name: row.name,
    nameKo: row.nameKo || row.name,
    description: row.description || "",
    descriptionKo: row.descriptionKo || "",
    scope: row.scope,
    projectId: row.projectId,
    items: row.items ? JSON.parse(row.items) : [],
    isActive: activeCount > 0,
    activeCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

// PATCH — name/description/items 수정
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: Date.now() };

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (!n || n.length > 100) return NextResponse.json({ error: "name 1-100 chars" }, { status: 400 });
    patch.name = n;
  }
  if (typeof body.nameKo === "string") patch.nameKo = body.nameKo.trim() || null;
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.descriptionKo === "string") patch.descriptionKo = body.descriptionKo.trim();
  if (Array.isArray(body.items)) {
    for (const it of body.items) {
      if (!isValidItem(it)) {
        return NextResponse.json({ error: "invalid item shape" }, { status: 400 });
      }
    }
    patch.items = JSON.stringify(body.items);
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const db = getDb();
  const result = db.update(workflows).set(patch).where(eq(workflows.id, id)).run();
  if (result.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

// DELETE — active 면 먼저 에러 (명시적 deactivate 유도)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const activeCount = db.select()
    .from(appliedTemplates)
    .where(and(eq(appliedTemplates.workflowId, id), eq(appliedTemplates.isActive, 1)))
    .all().length;

  if (activeCount > 0) {
    return NextResponse.json(
      { error: `Workflow is active (${activeCount} applies). Deactivate first.` },
      { status: 409 },
    );
  }

  const result = db.delete(workflows).where(eq(workflows.id, id)).run();
  if (result.changes === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
