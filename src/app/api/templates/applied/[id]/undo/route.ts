import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { appliedTemplates, projects } from "@/lib/db/schema";
import { and, eq, ne, isNull } from "drizzle-orm";
import { subtractSettings } from "@/lib/templates/subtract";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

// POST /api/templates/applied/[id]/undo
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const record = db.select().from(appliedTemplates).where(eq(appliedTemplates.id, id)).get();
  if (!record) {
    return NextResponse.json({ error: "Apply record not found" }, { status: 404 });
  }
  if (record.isActive === 0) {
    return NextResponse.json({ error: "Already undone" }, { status: 400 });
  }

  // Resolve project path (project/local scope)
  let projectPath: string | undefined;
  if (record.projectId) {
    const p = db.select().from(projects).where(eq(projects.id, record.projectId)).get();
    if (!p) {
      // H3/H4: 프로젝트가 사라진 경우 — 레코드 자동 비활성화 + 410 Gone
      db.update(appliedTemplates).set({ isActive: 0 }).where(eq(appliedTemplates.id, id)).run();
      return NextResponse.json({ error: "Project no longer exists; record invalidated" }, { status: 410 });
    }
    projectPath = p.path;
  }

  // Collect other active template deltas
  const otherConditions = [
    eq(appliedTemplates.scope, record.scope),
    eq(appliedTemplates.isActive, 1),
    ne(appliedTemplates.id, id),
  ];
  if (record.projectId) {
    otherConditions.push(eq(appliedTemplates.projectId, record.projectId));
  } else {
    otherConditions.push(isNull(appliedTemplates.projectId));
  }
  const others = db.select({ deltaJson: appliedTemplates.deltaJson })
    .from(appliedTemplates)
    .where(and(...otherConditions))
    .all();
  const otherDeltas: ClaudeSettings[] = others.map((r) => {
    try { return JSON.parse(r.deltaJson); } catch { return {}; }
  });

  // Read current settings and subtract
  let target;
  try {
    target = resolveSettingsPath(record.scope as FileScope, { projectPath, projectId: record.projectId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "path error" }, { status: 400 });
  }

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

  // Deactivate record
  db.update(appliedTemplates)
    .set({ isActive: 0 })
    .where(eq(appliedTemplates.id, id))
    .run();

  return NextResponse.json({ success: true, config: nextStr });
}
