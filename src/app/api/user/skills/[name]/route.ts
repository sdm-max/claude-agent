import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";

type Params = { params: Promise<{ name: string }> };

function skillsDir() {
  return path.join(os.homedir(), ".claude", "skills");
}

function isValidSkillName(name: string): boolean {
  if (!name || name.length > 64) return false;
  return /^[a-z0-9-]+$/.test(name);
}

// GET — single skill detail + supporting files list
export async function GET(_req: NextRequest, { params }: Params) {
  const { name } = await params;
  if (!isValidSkillName(name)) {
    return NextResponse.json({ error: "Invalid skill name" }, { status: 400 });
  }
  const skillDir = path.join(skillsDir(), name);
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  let content = "";
  try { content = fs.readFileSync(skillMd, "utf8"); } catch { /* ignore */ }

  let supportingFiles: string[] = [];
  try {
    const walk = (dir: string, rel: string, depth: number) => {
      if (depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "SKILL.md" && !rel) continue; // exclude root SKILL.md
        const entryRel = rel ? `${rel}/${e.name}` : e.name;
        const entryAbs = path.join(dir, e.name);
        if (e.isFile()) {
          supportingFiles.push(entryRel);
        } else if (e.isDirectory()) {
          walk(entryAbs, entryRel, depth + 1);
        }
      }
    };
    walk(skillDir, "", 0);
  } catch { /* ignore */ }

  return NextResponse.json({ name, content, supportingFiles });
}

// PATCH — update SKILL.md content
export async function PATCH(req: NextRequest, { params }: Params) {
  const { name } = await params;
  if (!isValidSkillName(name)) {
    return NextResponse.json({ error: "Invalid skill name" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const skillMd = path.join(skillsDir(), name, "SKILL.md");
  if (!fs.existsSync(skillMd)) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  try { fs.writeFileSync(skillMd, content, "utf8"); }
  catch { return NextResponse.json({ error: "Failed to write" }, { status: 500 }); }
  return NextResponse.json({ name, content });
}

// DELETE — remove entire skill directory
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { name } = await params;
  if (!isValidSkillName(name)) {
    return NextResponse.json({ error: "Invalid skill name" }, { status: 400 });
  }
  const skillDir = path.join(skillsDir(), name);
  if (!fs.existsSync(skillDir)) {
    return NextResponse.json({ error: "Skill not found" }, { status: 404 });
  }
  try { fs.rmSync(skillDir, { recursive: true, force: true }); }
  catch { return NextResponse.json({ error: "Failed to delete" }, { status: 500 }); }
  return NextResponse.json({ success: true });
}
