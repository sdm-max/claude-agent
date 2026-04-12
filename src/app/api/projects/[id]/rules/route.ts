import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listDirectoryFiles, writeFileContent, fileExists } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

const EXTENSION = ".md";

function rulesDir(projectPath: string) {
  return path.join(projectPath, ".claude", "rules");
}

function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n !== "." && n !== ".." && !n.includes("/") && !n.includes("..");
}

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// GET /api/projects/[id]/rules — list all rule files
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const files = listDirectoryFiles(rulesDir(project.path), EXTENSION);
  return NextResponse.json(files);
}

// POST /api/projects/[id]/rules — create a new rule file
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const dir = rulesDir(project.path);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create directory" }, { status: 500 });
  }

  const filePath = path.join(dir, name);
  if (fileExists(filePath)) {
    return NextResponse.json({ error: "File already exists" }, { status: 409 });
  }
  writeFileContent(filePath, content);

  return NextResponse.json({ name, content }, { status: 201 });
}

// PUT /api/projects/[id]/rules — update an existing rule file
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const filePath = path.join(rulesDir(project.path), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  writeFileContent(filePath, content);
  return NextResponse.json({ name, content });
}

// DELETE /api/projects/[id]/rules?name=xxx — delete a rule file
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = req.nextUrl.searchParams.get("name");
  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name query param" }, { status: 400 });
  }

  const filePath = path.join(rulesDir(project.path), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
