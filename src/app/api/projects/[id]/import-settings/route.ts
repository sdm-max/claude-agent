import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, settings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveFilePath, readFileContent } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

// POST /api/projects/[id]/import-settings?scope=project|local
// Reads settings.json from project disk and imports into DB
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

  const filePath = resolveFilePath(project.path, "settings", scope as "project" | "local");
  const content = readFileContent(filePath);

  if (content === null) {
    // 다른 scope 파일이 존재하는지 힌트 제공
    const otherScope = scope === "project" ? "local" : "project";
    const otherPath = resolveFilePath(project.path, "settings", otherScope as "project" | "local");
    const otherExists = readFileContent(otherPath) !== null;
    const hint = otherExists ? ` (${otherScope} scope 파일은 존재합니다: ${otherPath})` : "";
    return NextResponse.json({ error: `File not found: ${filePath}${hint}` }, { status: 404 });
  }

  // Strict JSON validation — reject trailing data like {}{...}
  let validConfig: string;
  try {
    const parsed = JSON.parse(content);
    validConfig = JSON.stringify(parsed, null, 2);
  } catch {
    return NextResponse.json({ error: "File contains invalid JSON" }, { status: 400 });
  }
  const config = validConfig;

  const now = Date.now();

  const existing = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), eq(settings.projectPath, project.path)))
    .get();

  if (existing) {
    db.update(settings)
      .set({ config, updatedAt: now })
      .where(eq(settings.id, existing.id))
      .run();
  } else {
    db.insert(settings)
      .values({ scope, projectPath: project.path, config, createdAt: now, updatedAt: now })
      .run();
  }

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
