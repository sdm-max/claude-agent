import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string; fileId: string }> };

// DEPRECATED: legacy DB-backed files endpoint. Scheduled for removal once
// CLAUDE.md / Settings tabs migrate to disk-direct routes. Keeps GET/DELETE
// for in-flight cleanup; PUT returns 410 so writes flow through the new
// disk-direct endpoints only.

export async function GET(_req: NextRequest, { params }: Params) {
  const { fileId } = await params;
  const db = getDb();
  const file = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(file);
}

export async function PUT() {
  return NextResponse.json(
    { error: "Legacy DB-backed PUT disabled. Use disk-direct endpoints." },
    { status: 410 },
  );
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, fileId } = await params;
  const db = getDb();

  const file = db.select().from(files).where(eq(files.id, fileId)).get();
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (file.projectId !== id) {
    return NextResponse.json({ error: "File does not belong to this project" }, { status: 403 });
  }

  db.delete(files).where(eq(files.id, fileId)).run();
  return NextResponse.json({ success: true });
}
