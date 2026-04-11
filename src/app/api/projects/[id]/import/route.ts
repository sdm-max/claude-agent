import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { detectClaudeFiles } from "@/lib/file-io";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/import — scan project path for Claude files
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detected = detectClaudeFiles(project.path);
  return NextResponse.json({ files: detected });
}

// PUT /api/projects/[id]/import — import selected files into DB
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const selectedFiles: { type: string; scope: string; content: string }[] = body.files;

  if (!Array.isArray(selectedFiles) || selectedFiles.length === 0) {
    return NextResponse.json({ error: "files array is required" }, { status: 400 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = Date.now();
  let imported = 0;

  for (const f of selectedFiles) {
    // Check if file already exists for this project+type+scope
    const existing = db
      .select()
      .from(files)
      .where(and(eq(files.projectId, id), eq(files.type, f.type), eq(files.scope, f.scope)))
      .get();

    if (existing) {
      // Update existing
      db.update(files)
        .set({ content: f.content, updatedAt: now })
        .where(eq(files.id, existing.id))
        .run();
    } else {
      // Insert new
      db.insert(files).values({
        id: nanoid(),
        projectId: id,
        type: f.type,
        scope: f.scope,
        content: f.content,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
    imported++;
  }

  return NextResponse.json({ imported });
}
