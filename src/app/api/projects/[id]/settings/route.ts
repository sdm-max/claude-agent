import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveSettingsPath,
  readDisk,
  writeDiskWithSnapshot,
  diskExists,
} from "@/lib/disk-files";
import { registerWatcher } from "@/lib/fs-watcher";

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

  try {
    registerWatcher(id, project.path);
  } catch {
    // best-effort
  }

  const resolved = resolveSettingsPath(scope as "project" | "local", {
    projectId: id,
    projectPath: project.path,
  });

  const content = readDisk(resolved.absolutePath);
  return NextResponse.json({
    scope,
    projectPath: project.path,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: content !== null,
    config: content ?? "{}",
  });
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
  const config = typeof body.config === "string" ? body.config : JSON.stringify(body.config, null, 2);

  try {
    JSON.parse(config);
  } catch {
    return NextResponse.json({ error: "Invalid JSON in config" }, { status: 400 });
  }

  const resolved = resolveSettingsPath(scope as "project" | "local", {
    projectId: id,
    projectPath: project.path,
  });

  try {
    writeDiskWithSnapshot(resolved, config);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scope,
    projectPath: project.path,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: diskExists(resolved.absolutePath),
    config,
  });
}
