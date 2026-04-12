import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveFilePath, writeFileContent } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/export-claudemd?scope=user|project|local
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = request.nextUrl.searchParams.get("scope") || "project";

  if (!["user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'user', 'project', or 'local'" }, { status: 400 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const file = db
    .select()
    .from(files)
    .where(
      and(
        eq(files.projectId, id),
        eq(files.type, "claude-md"),
        eq(files.scope, scope)
      )
    )
    .get();

  if (!file) {
    return NextResponse.json({ error: "No CLAUDE.md to export" }, { status: 404 });
  }

  const filePath = resolveFilePath(
    project.path,
    "claude-md",
    scope as "user" | "project" | "local"
  );

  writeFileContent(filePath, file.content);

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
