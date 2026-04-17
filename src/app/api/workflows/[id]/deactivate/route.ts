import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { workflows, projects, appliedTemplates } from "@/lib/db/schema";
import { and, eq, ne, isNull, desc } from "drizzle-orm";
import { subtractSettings } from "@/lib/templates/subtract";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

// POST /api/workflows/[id]/deactivate — undo all applied items in reverse order
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const wf = db.select().from(workflows).where(eq(workflows.id, id)).get();
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  // Get active applies tied to this workflow, reverse order (newest first)
  const activeApplies = db.select()
    .from(appliedTemplates)
    .where(and(eq(appliedTemplates.workflowId, id), eq(appliedTemplates.isActive, 1)))
    .orderBy(desc(appliedTemplates.appliedAt))
    .all();

  if (activeApplies.length === 0) {
    return NextResponse.json({ error: "No active applies for this workflow" }, { status: 400 });
  }

  // Resolve project path (if any)
  let projectPath: string | undefined;
  if (wf.projectId) {
    const p = db.select().from(projects).where(eq(projects.id, wf.projectId)).get();
    if (p) projectPath = p.path;
  }

  const scope = wf.scope as FileScope;
  const target = resolveSettingsPath(scope, { projectPath, projectId: wf.projectId });

  let undoneCount = 0;
  // Undo one by one in reverse order — each time re-compute otherActives EXCLUDING current
  for (const record of activeApplies) {
    // Other active deltas in same scope (excluding this record, still active)
    const otherConditions = [
      eq(appliedTemplates.scope, scope),
      eq(appliedTemplates.isActive, 1),
      ne(appliedTemplates.id, record.id),
    ];
    if (wf.projectId) otherConditions.push(eq(appliedTemplates.projectId, wf.projectId));
    else otherConditions.push(isNull(appliedTemplates.projectId));

    const others = db.select({ deltaJson: appliedTemplates.deltaJson })
      .from(appliedTemplates)
      .where(and(...otherConditions))
      .all();
    const otherDeltas: ClaudeSettings[] = others.map((r) => {
      try { return JSON.parse(r.deltaJson); } catch { return {}; }
    });

    const currentRaw = readDisk(target.absolutePath);
    let current: ClaudeSettings = {};
    if (currentRaw) {
      try { current = JSON.parse(currentRaw); } catch { /* ignore */ }
    }

    const delta: ClaudeSettings = (() => {
      try { return JSON.parse(record.deltaJson); } catch { return {}; }
    })();

    const next = subtractSettings(current, delta, otherDeltas);
    const nextStr = JSON.stringify(next, null, 2);
    writeDiskWithSnapshot(target, nextStr);

    db.update(appliedTemplates).set({ isActive: 0 }).where(eq(appliedTemplates.id, record.id)).run();
    undoneCount++;
  }

  return NextResponse.json({ success: true, undoneCount });
}
