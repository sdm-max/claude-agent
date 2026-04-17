import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

function isValidSkillName(name: string): boolean {
  if (!name || name.length > 64) return false;
  return /^[a-z0-9-]+$/.test(name);
}

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

function skillsDir(projectPath: string) {
  return path.join(projectPath, ".claude", "skills");
}

// GET — list project skills
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dir = skillsDir(project.path);
  if (!fs.existsSync(dir)) return NextResponse.json([]);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const skills: Array<{ name: string; content: string; hasSupportingFiles: boolean }> = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillMd = path.join(dir, e.name, "SKILL.md");
      if (!fs.existsSync(skillMd)) continue;
      let content = "";
      try { content = fs.readFileSync(skillMd, "utf8"); } catch { continue; }
      let hasSupportingFiles = false;
      try {
        const sub = fs.readdirSync(path.join(dir, e.name), { withFileTypes: true });
        hasSupportingFiles = sub.some((s) => s.name !== "SKILL.md");
      } catch { /* ignore */ }
      skills.push({ name: e.name, content, hasSupportingFiles });
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(skills);
  } catch { return NextResponse.json([]); }
}

// POST — create
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const { name, content } = body as { name?: string; content?: string };
  if (!name || !isValidSkillName(name)) {
    return NextResponse.json({ error: "Invalid skill name" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const skillDir = path.join(skillsDir(project.path), name);
  const skillMd = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(skillMd)) {
    return NextResponse.json({ error: "Skill already exists" }, { status: 409 });
  }
  try {
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillMd, content, "utf8");
  } catch {
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
  return NextResponse.json({ name, content, hasSupportingFiles: false }, { status: 201 });
}
