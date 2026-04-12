import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveFilePath, readFileContent } from "@/lib/file-io";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/import-claudemd?scope=user|project|local
// Reads CLAUDE.md from disk and imports into DB
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = request.nextUrl.searchParams.get("scope") || "project";

  if (!["user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'user', 'project' or 'local'" }, { status: 400 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const filePath = resolveFilePath(project.path, "claude-md", scope as "user" | "project" | "local");
  const content = readFileContent(filePath);

  if (content === null) {
    return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 });
  }

  const now = Date.now();

  // Check if file record already exists
  const existing = db
    .select()
    .from(files)
    .where(and(eq(files.projectId, id), eq(files.type, "claude-md"), eq(files.scope, scope)))
    .get();

  if (existing) {
    db.update(files)
      .set({ content, updatedAt: now })
      .where(eq(files.id, existing.id))
      .run();
  } else {
    db.insert(files).values({
      id: nanoid(),
      projectId: id,
      type: "claude-md",
      scope,
      content,
      createdAt: now,
      updatedAt: now,
    }).run();
  }

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
