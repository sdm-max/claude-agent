import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listDirectoryFiles, readFileContent, writeFileContent, fileExists } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

const EXTENSION = ".md";
const ROOT_MEMORY_NAME = "CLAUDE.md";

function rulesDir(projectPath: string) {
  return path.join(projectPath, ".claude", "rules");
}

function rootClaudeMd(projectPath: string) {
  return path.join(projectPath, ROOT_MEMORY_NAME);
}

function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n !== "." && n !== ".." && !n.includes("/") && !n.includes("..");
}

function isRootMemoryRequest(name: string, pinned: unknown): boolean {
  return name === ROOT_MEMORY_NAME && pinned === true;
}

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// GET /api/projects/[id]/rules — list all rule files (root CLAUDE.md pinned first)
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rulesList = listDirectoryFiles(rulesDir(project.path), EXTENSION);

  const rootPath = rootClaudeMd(project.path);
  let pinned: { name: string; content: string; pinned: true } | null = null;
  if (fs.existsSync(rootPath) && fs.statSync(rootPath).isFile()) {
    const content = readFileContent(rootPath);
    if (content !== null) {
      pinned = { name: ROOT_MEMORY_NAME, content, pinned: true };
    }
  }

  if (pinned && rulesList.some((f) => f.name === ROOT_MEMORY_NAME)) {
    console.warn(
      `[rules] both ${rootPath} and .claude/rules/${ROOT_MEMORY_NAME} exist — showing root only`,
    );
  }

  const combined = pinned
    ? [pinned, ...rulesList.filter((f) => f.name !== ROOT_MEMORY_NAME)]
    : rulesList;

  return NextResponse.json(combined);
}

// POST /api/projects/[id]/rules — create a new rule file
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, content, pinned } = body as { name?: string; content?: string; pinned?: boolean };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Root CLAUDE.md path: create at project root
  if (name === ROOT_MEMORY_NAME && (pinned === true || !fs.existsSync(rulesDir(project.path)))) {
    const rootPath = rootClaudeMd(project.path);
    if (fileExists(rootPath)) {
      return NextResponse.json({ error: "Root CLAUDE.md already exists" }, { status: 409 });
    }
    writeFileContent(rootPath, content);
    return NextResponse.json({ name, content, pinned: true }, { status: 201 });
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
  const { name, content, pinned } = body as { name?: string; content?: string; pinned?: boolean };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Pinned root CLAUDE.md → project root
  if (isRootMemoryRequest(name, pinned)) {
    const rootPath = rootClaudeMd(project.path);
    if (!fileExists(rootPath)) {
      return NextResponse.json({ error: "Root CLAUDE.md not found" }, { status: 404 });
    }
    writeFileContent(rootPath, content);
    return NextResponse.json({ name, content, pinned: true });
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
  const pinnedParam = req.nextUrl.searchParams.get("pinned") === "true";
  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name query param" }, { status: 400 });
  }

  if (isRootMemoryRequest(name, pinnedParam)) {
    return NextResponse.json(
      { error: "Root CLAUDE.md cannot be deleted from the UI — it is the project memory file" },
      { status: 403 },
    );
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
