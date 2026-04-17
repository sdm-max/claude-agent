import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { customTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/custom-templates/[id] — 상세
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const row = db.select().from(customTemplates).where(eq(customTemplates.id, id)).get();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...row,
    nameKo: row.nameKo || row.name,
    description: row.description || "",
    descriptionKo: row.descriptionKo || "",
    tags: row.tags ? JSON.parse(row.tags) : [],
    settings: JSON.parse(row.settings),
    extraFiles: row.extraFiles ? JSON.parse(row.extraFiles) : null,
  });
}

// PATCH /api/custom-templates/[id] — 이름/설명/카테고리 수정 (settings 수정 금지)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: Date.now() };

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "name 1-100 chars" }, { status: 400 });
    }
    patch.name = name;
  }
  if (typeof body.nameKo === "string") patch.nameKo = body.nameKo.trim() || null;
  if (typeof body.description === "string") {
    if (body.description.length > 500) return NextResponse.json({ error: "description too long" }, { status: 400 });
    patch.description = body.description.trim();
  }
  if (typeof body.descriptionKo === "string") patch.descriptionKo = body.descriptionKo.trim();
  if (typeof body.category === "string") {
    const VALID = ["security", "permissions", "hooks", "skills", "mcp", "claude-md", "cicd", "agents", "model", "env", "ui", "optimization", "custom"];
    if (!VALID.includes(body.category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });
    patch.category = body.category;
  }
  if (Array.isArray(body.tags)) patch.tags = JSON.stringify(body.tags);

  if (Object.keys(patch).length === 1) {
    // updatedAt만 있음
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const db = getDb();
  const result = db.update(customTemplates).set(patch).where(eq(customTemplates.id, id)).run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

// DELETE /api/custom-templates/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();
  const result = db.delete(customTemplates).where(eq(customTemplates.id, id)).run();
  if (result.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // 주의: applied_templates의 deltaJson은 자기완결적이라 그대로 유지 (undo 가능)
  return NextResponse.json({ success: true });
}
