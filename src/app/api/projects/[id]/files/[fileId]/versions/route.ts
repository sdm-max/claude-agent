import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { fileVersions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string; fileId: string }> };

// GET /api/projects/[id]/files/[fileId]/versions
export async function GET(_req: NextRequest, { params }: Params) {
  const { fileId } = await params;
  const db = getDb();

  const versions = db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.fileId, fileId))
    .orderBy(desc(fileVersions.createdAt))
    .all();

  return NextResponse.json(versions);
}

// POST /api/projects/[id]/files/[fileId]/versions — restore a version
export async function POST(request: NextRequest, { params }: Params) {
  const { fileId } = await params;
  const body = await request.json();
  const { versionId } = body;

  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const db = getDb();
  const version = db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.id, versionId))
    .get();

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Import files table to update
  const { files } = await import("@/lib/db/schema");
  const { nanoid } = await import("nanoid");

  const existing = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!existing) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const now = Date.now();

  // Snapshot current before restore
  db.insert(fileVersions).values({
    id: nanoid(),
    fileId,
    content: existing.content,
    createdAt: now,
  }).run();

  // Restore
  db.update(files)
    .set({ content: version.content, updatedAt: now })
    .where(eq(files.id, fileId))
    .run();

  return NextResponse.json({ success: true, fileId, restoredFrom: versionId });
}
