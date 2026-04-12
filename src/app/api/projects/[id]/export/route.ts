import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveFilePath, writeFileContent } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/export?scope=project|local
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = request.nextUrl.searchParams.get("scope") || "project";

  if (!["project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'project' or 'local'" }, { status: 400 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const row = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), eq(settings.projectPath, project.path)))
    .get();

  if (!row || row.config.trim() === "{}") {
    return NextResponse.json({ error: "No settings to export (empty)" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = JSON.parse(row.config);
  } catch {
    return NextResponse.json({ error: "DB contains invalid JSON — cannot export" }, { status: 500 });
  }
  const content = JSON.stringify(parsed, null, 2);

  const filePath = resolveFilePath(
    project.path,
    "settings",
    scope as "project" | "local"
  );

  writeFileContent(filePath, content);

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
