import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

const HEADER_FILE = "_agent-header.md";

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

function headerPath(projectPath: string) {
  return path.join(projectPath, ".claude", HEADER_FILE);
}

// GET /api/projects/[id]/agent-header
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = headerPath(project.path);
  if (!fs.existsSync(p)) {
    return NextResponse.json({ exists: false, content: "" });
  }
  try {
    const content = fs.readFileSync(p, "utf8");
    return NextResponse.json({ exists: true, content });
  } catch {
    return NextResponse.json({ error: "Failed to read header" }, { status: 500 });
  }
}

// PUT /api/projects/[id]/agent-header — body: { content: string }
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const p = headerPath(project.path);
  const dir = path.dirname(p);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, content, "utf8");
  } catch {
    return NextResponse.json({ error: "Failed to write header" }, { status: 500 });
  }
  return NextResponse.json({ exists: true, content });
}

// DELETE — header 파일 삭제 (후속 에이전트 생성 시 주입 안 됨)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const p = headerPath(project.path);
  if (!fs.existsSync(p)) return NextResponse.json({ success: true });
  try {
    fs.unlinkSync(p);
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
