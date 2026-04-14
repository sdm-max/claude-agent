import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveMemoryPath,
  readDisk,
  writeDiskWithSnapshot,
  diskExists,
  type FileScope,
} from "@/lib/disk-files";
import { registerWatcher } from "@/lib/fs-watcher";

type Params = { params: Promise<{ id: string }> };

const VALID_SCOPES = ["user", "project", "local"] as const;

function parseScope(raw: string | null): FileScope | null {
  if (!raw) return null;
  return (VALID_SCOPES as readonly string[]).includes(raw) ? (raw as FileScope) : null;
}

// GET /api/projects/[id]/claudemd?scope=user|project|local
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  if (!scope) {
    return NextResponse.json({ error: "scope must be 'user', 'project', or 'local'" }, { status: 400 });
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

  const resolved = resolveMemoryPath(scope, {
    projectId: id,
    projectPath: project.path,
  });

  const content = readDisk(resolved.absolutePath);
  return NextResponse.json({
    scope,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: content !== null,
    content: content ?? "",
  });
}

// PUT /api/projects/[id]/claudemd?scope=user|project|local
export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  if (!scope) {
    return NextResponse.json({ error: "scope must be 'user', 'project', or 'local'" }, { status: 400 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content : "";

  const resolved = resolveMemoryPath(scope, {
    projectId: id,
    projectPath: project.path,
  });

  try {
    writeDiskWithSnapshot(resolved, content);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scope,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: diskExists(resolved.absolutePath),
    content,
  });
}
