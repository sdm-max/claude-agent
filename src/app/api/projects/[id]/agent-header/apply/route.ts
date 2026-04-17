import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { injectAgentHeader, stripAgentHeader } from "@/lib/agent-header-inject";

type Params = { params: Promise<{ id: string }> };

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// POST /api/projects/[id]/agent-header/apply
// body: { mode: "inject" | "strip" }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const mode = (body?.mode as string) || "inject";
  if (mode !== "inject" && mode !== "strip") {
    return NextResponse.json({ error: "mode must be inject or strip" }, { status: 400 });
  }

  const agentsDir = path.join(project.path, ".claude", "agents");
  if (!fs.existsSync(agentsDir)) {
    return NextResponse.json({ updated: 0, total: 0, files: [] });
  }

  let headerContent = "";
  if (mode === "inject") {
    const hp = path.join(project.path, ".claude", "_agent-header.md");
    if (!fs.existsSync(hp)) {
      return NextResponse.json(
        { error: "Header file does not exist. Save a header first." },
        { status: 400 },
      );
    }
    try { headerContent = fs.readFileSync(hp, "utf8"); }
    catch { return NextResponse.json({ error: "Failed to read header" }, { status: 500 }); }
  }

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);

  const updated: string[] = [];
  for (const name of entries) {
    const full = path.join(agentsDir, name);
    let original: string;
    try { original = fs.readFileSync(full, "utf8"); }
    catch { continue; }
    const next = mode === "inject" ? injectAgentHeader(original, headerContent) : stripAgentHeader(original);
    if (next !== original) {
      try { fs.writeFileSync(full, next, "utf8"); updated.push(name); }
      catch { /* ignore per-file error */ }
    }
  }

  return NextResponse.json({
    updated: updated.length,
    total: entries.length,
    files: updated,
    mode,
  });
}
