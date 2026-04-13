import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { registerWatcher, unregisterWatcher } from "@/lib/fs-watcher";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectFiles = db.select().from(files).where(eq(files.projectId, id)).all();
  return NextResponse.json({ ...project, files: projectFiles });
}

// PUT /api/projects/[id]
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.update(projects)
    .set({
      name: body.name ?? existing.name,
      path: body.path ? body.path.trim().replace(/\/+$/, "") : existing.path,
      description: body.description ?? existing.description,
      updatedAt: Date.now(),
    })
    .where(eq(projects.id, id))
    .run();

  const updated = db.select().from(projects).where(eq(projects.id, id)).get();
  if (updated) {
    try {
      registerWatcher(id, updated.path);
    } catch (e) {
      console.warn("[projects.PUT] watcher register failed:", e);
    }
  }
  return NextResponse.json(updated);
}

// DELETE /api/projects/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const existing = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  db.delete(projects).where(eq(projects.id, id)).run();
  try {
    unregisterWatcher(id);
  } catch (e) {
    console.warn("[projects.DELETE] watcher unregister failed:", e);
  }
  return NextResponse.json({ success: true });
}
