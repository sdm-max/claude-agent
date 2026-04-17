import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listDirectoryFiles, readFileContent, writeFileContent, fileExists } from "@/lib/file-io";

type Params = { params: Promise<{ id: string }> };

const EXTENSION = ".md";

// ── Pinned project memory files ────────────────────────────────────────
// Key = stable identifier sent by client; Value = resolver + display name
type MemoryKey = "root" | "claude-dir" | "local";
const MEMORY_REGISTRY: Record<
  MemoryKey,
  { displayName: string; label: string; resolve: (projectPath: string) => string }
> = {
  root: {
    displayName: "CLAUDE.md",
    label: "Project memory (root)",
    resolve: (p) => path.join(p, "CLAUDE.md"),
  },
  "claude-dir": {
    displayName: ".claude/CLAUDE.md",
    label: "Project memory (.claude/)",
    resolve: (p) => path.join(p, ".claude", "CLAUDE.md"),
  },
  local: {
    displayName: "CLAUDE.local.md",
    label: "Local memory (git-ignored)",
    resolve: (p) => path.join(p, "CLAUDE.local.md"),
  },
};
const MEMORY_KEYS = Object.keys(MEMORY_REGISTRY) as MemoryKey[];
const DISPLAY_TO_KEY = new Map<string, MemoryKey>(
  MEMORY_KEYS.map((k) => [MEMORY_REGISTRY[k].displayName, k]),
);

function isMemoryKey(v: unknown): v is MemoryKey {
  return typeof v === "string" && MEMORY_KEYS.includes(v as MemoryKey);
}

function rulesDir(projectPath: string) {
  return path.join(projectPath, ".claude", "rules");
}

function isValidRegularName(name: string): boolean {
  const n = name.trim();
  if (!n || !n.endsWith(EXTENSION)) return false;
  if (n.startsWith("/")) return false;
  if (n.includes("\\") || n.includes("\0")) return false;
  if (n.includes("//")) return false;
  const segments = n.split("/");
  if (segments.length > 4) return false;
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") return false;
  }
  return true;
}

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// GET — pinned memory files first, then .claude/rules/*.md
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pinnedEntries: Array<{
    name: string;
    content: string;
    pinned: true;
    memoryKey: MemoryKey;
    label: string;
  }> = [];
  for (const key of MEMORY_KEYS) {
    const reg = MEMORY_REGISTRY[key];
    const filePath = reg.resolve(project.path);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    const content = readFileContent(filePath);
    if (content === null) continue;
    pinnedEntries.push({
      name: reg.displayName,
      content,
      pinned: true,
      memoryKey: key,
      label: reg.label,
    });
  }

  const rulesList = listDirectoryFiles(rulesDir(project.path), EXTENSION, { recursive: true });

  // Warn on filename collision between pinned and rules/
  for (const p of pinnedEntries) {
    if (rulesList.some((f) => f.name === p.name)) {
      console.warn(
        `[rules] pinned ${p.name} and .claude/rules/${p.name} both exist — showing pinned only`,
      );
    }
  }
  const pinnedNames = new Set(pinnedEntries.map((p) => p.name));
  const combined = [...pinnedEntries, ...rulesList.filter((f) => !pinnedNames.has(f.name))];

  return NextResponse.json(combined);
}

// POST — create a new rule file (or pinned memory file)
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, content, pinned, memoryKey } = body as {
    name?: string;
    content?: string;
    pinned?: boolean;
    memoryKey?: string;
  };

  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Pinned memory write path — identified by memoryKey (preferred) or display name
  if (pinned === true) {
    const key: MemoryKey | undefined = isMemoryKey(memoryKey)
      ? memoryKey
      : name
      ? DISPLAY_TO_KEY.get(name)
      : undefined;
    if (!key) {
      return NextResponse.json({ error: "Unknown pinned memory key" }, { status: 400 });
    }
    const reg = MEMORY_REGISTRY[key];
    const filePath = reg.resolve(project.path);
    if (fileExists(filePath)) {
      return NextResponse.json({ error: `${reg.displayName} already exists` }, { status: 409 });
    }
    writeFileContent(filePath, content);
    return NextResponse.json(
      { name: reg.displayName, content, pinned: true, memoryKey: key, label: reg.label },
      { status: 201 },
    );
  }

  // Auto-route: "CLAUDE.md" / "CLAUDE.local.md" typed in New dialog → pinned create
  if (name && DISPLAY_TO_KEY.has(name)) {
    const key = DISPLAY_TO_KEY.get(name)!;
    const reg = MEMORY_REGISTRY[key];
    const filePath = reg.resolve(project.path);
    if (fileExists(filePath)) {
      return NextResponse.json({ error: `${reg.displayName} already exists` }, { status: 409 });
    }
    writeFileContent(filePath, content);
    return NextResponse.json(
      { name: reg.displayName, content, pinned: true, memoryKey: key, label: reg.label },
      { status: 201 },
    );
  }

  if (!name || !isValidRegularName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
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

// PUT — update an existing file (regular or pinned)
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name, content, pinned, memoryKey } = body as {
    name?: string;
    content?: string;
    pinned?: boolean;
    memoryKey?: string;
  };

  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (pinned === true) {
    const key: MemoryKey | undefined = isMemoryKey(memoryKey)
      ? memoryKey
      : name
      ? DISPLAY_TO_KEY.get(name)
      : undefined;
    if (!key) {
      return NextResponse.json({ error: "Unknown pinned memory key" }, { status: 400 });
    }
    const reg = MEMORY_REGISTRY[key];
    const filePath = reg.resolve(project.path);
    if (!fileExists(filePath)) {
      return NextResponse.json({ error: `${reg.displayName} not found` }, { status: 404 });
    }
    writeFileContent(filePath, content);
    return NextResponse.json({
      name: reg.displayName,
      content,
      pinned: true,
      memoryKey: key,
      label: reg.label,
    });
  }

  if (!name || !isValidRegularName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }

  const filePath = path.join(rulesDir(project.path), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  writeFileContent(filePath, content);
  return NextResponse.json({ name, content });
}

// DELETE — regular rules only; pinned memory files are protected
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const name = req.nextUrl.searchParams.get("name");
  const pinnedParam = req.nextUrl.searchParams.get("pinned") === "true";
  if (!name || !isValidRegularName(name)) {
    return NextResponse.json({ error: "Invalid or missing name query param" }, { status: 400 });
  }

  if (pinnedParam || DISPLAY_TO_KEY.has(name)) {
    return NextResponse.json(
      { error: "Project memory files cannot be deleted from the UI" },
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
