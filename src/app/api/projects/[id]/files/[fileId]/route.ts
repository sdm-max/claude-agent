import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { files, fileVersions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ id: string; fileId: string }> };

// GET /api/projects/[id]/files/[fileId]
export async function GET(_req: NextRequest, { params }: Params) {
  const { fileId } = await params;
  const db = getDb();

  const file = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(file);
}

// PUT /api/projects/[id]/files/[fileId] — update content, auto-version previous
export async function PUT(request: NextRequest, { params }: Params) {
  const { fileId } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Snapshot previous content as version
  const now = Date.now();
  db.insert(fileVersions).values({
    id: nanoid(),
    fileId,
    content: existing.content,
    createdAt: now,
  }).run();

  // Update file
  db.update(files)
    .set({
      content: body.content ?? existing.content,
      updatedAt: now,
    })
    .where(eq(files.id, fileId))
    .run();

  const updated = db.select().from(files).where(eq(files.id, fileId)).get();
  return NextResponse.json(updated);
}
