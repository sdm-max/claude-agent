import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";

function skillsDir() {
  return path.join(os.homedir(), ".claude", "skills");
}

// Claude Code 표준: "Lowercase letters, numbers, and hyphens only (max 64 characters)"
function isValidSkillName(name: string): boolean {
  if (!name || name.length > 64) return false;
  return /^[a-z0-9-]+$/.test(name);
}

function readSkill(dir: string, name: string): { name: string; content: string; hasSupportingFiles: boolean } | null {
  const skillDir = path.join(dir, name);
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) return null;
  let content = "";
  try { content = fs.readFileSync(skillMd, "utf8"); } catch { return null; }
  // Check for supporting files (anything besides SKILL.md)
  let hasSupportingFiles = false;
  try {
    const entries = fs.readdirSync(skillDir, { withFileTypes: true });
    hasSupportingFiles = entries.some((e) => e.name !== "SKILL.md");
  } catch { /* ignore */ }
  return { name, content, hasSupportingFiles };
}

// GET /api/user/skills — list all user skills
export async function GET() {
  const dir = skillsDir();
  if (!fs.existsSync(dir)) return NextResponse.json([]);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const skills: Array<{ name: string; content: string; hasSupportingFiles: boolean }> = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const s = readSkill(dir, e.name);
      if (s) skills.push(s);
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(skills);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/user/skills — create new skill
// body: { name: string, content: string }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidSkillName(name)) {
    return NextResponse.json(
      { error: "Invalid skill name. Use lowercase letters, numbers, hyphens (max 64 chars)" },
      { status: 400 },
    );
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const dir = skillsDir();
  const skillDir = path.join(dir, name);
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
