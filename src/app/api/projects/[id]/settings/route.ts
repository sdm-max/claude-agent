import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/settings?scope=project|local
export async function GET(request: NextRequest, { params }: Params) {
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

  if (!row) {
    return NextResponse.json({ id: null, scope, config: "{}", projectPath: project.path });
  }

  return NextResponse.json(row);
}

// PUT /api/projects/[id]/settings?scope=project|local
export async function PUT(request: NextRequest, { params }: Params) {
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

  const body = await request.json();
  const config = typeof body.config === "string" ? body.config : JSON.stringify(body.config);
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

  const updated = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), eq(settings.projectPath, project.path)))
    .get();

  return NextResponse.json(updated);
}
