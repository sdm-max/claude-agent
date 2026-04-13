import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects, files } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { registerWatcher } from "@/lib/fs-watcher";

// GET /api/projects — list all projects with file counts
export async function GET() {
  const db = getDb();
  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      path: projects.path,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      fileCount: sql<number>`(SELECT COUNT(*) FROM files WHERE files.project_id = ${projects.id})`,
    })
    .from(projects)
    .orderBy(projects.updatedAt)
    .all();

  return NextResponse.json(rows);
}

// POST /api/projects — create project
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, path: rawPath, description } = body;

  if (!name || !rawPath) {
    return NextResponse.json({ error: "name and path are required" }, { status: 400 });
  }

  const projectPath = rawPath.trim().replace(/\/+$/, "");

  const db = getDb();

  const existing = db.select().from(projects).where(eq(projects.path, projectPath)).get();
  if (existing) {
    return NextResponse.json({ error: "A project with this path already exists" }, { status: 409 });
  }

  const now = Date.now();
  const id = nanoid();

  db.insert(projects).values({
    id,
    name,
    path: projectPath,
    description: description || "",
    createdAt: now,
    updatedAt: now,
  }).run();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  try {
    registerWatcher(id, projectPath);
  } catch (e) {
    console.warn("[projects.POST] watcher register failed:", e);
  }
  return NextResponse.json(project, { status: 201 });
}
