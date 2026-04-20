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

  // Step 1: dry-run — produce (name, original, next) for each file, collecting errors
  type Plan = { name: string; full: string; original: string; next: string; changed: boolean };
  const plans: Plan[] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const name of entries) {
    const full = path.join(agentsDir, name);
    let original: string;
    try { original = fs.readFileSync(full, "utf8"); }
    catch (e) {
      skipped.push({ path: name, reason: `read_failed: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    let next: string;
    try {
      next = mode === "inject" ? injectAgentHeader(original, headerContent) : stripAgentHeader(original);
    } catch (e) {
      skipped.push({ path: name, reason: `transform_failed: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    plans.push({ name, full, original, next, changed: next !== original });
  }

  // Step 2: commit only if ALL planning succeeded — any skipped means zero writes
  const applied: string[] = [];
  const rolledBack: string[] = [];
  const rollbackFailed: { path: string; reason: string }[] = [];

  if (skipped.length === 0) {
    for (const p of plans) {
      if (!p.changed) continue;
      try {
        fs.writeFileSync(p.full, p.next, "utf8");
        applied.push(p.name);
      } catch (e) {
        skipped.push({ path: p.name, reason: `write_failed: ${e instanceof Error ? e.message : String(e)}` });
        // Best-effort rollback: reverse-order restore of already-written files
        for (let j = applied.length - 1; j >= 0; j--) {
          const rb = plans.find((pp) => pp.name === applied[j]);
          if (!rb) continue;
          try {
            fs.writeFileSync(rb.full, rb.original, "utf8");
            rolledBack.push(rb.name);
          } catch (re) {
            rollbackFailed.push({ path: rb.name, reason: re instanceof Error ? re.message : String(re) });
          }
        }
        // Clear applied since we attempted to undo them
        applied.length = 0;
        break;
      }
    }
  }

  return NextResponse.json({
    updated: applied.length,
    total: entries.length,
    files: applied,
    applied,
    skipped,
    mode,
    rolledBack,
    rollbackFailed,
  });
}
