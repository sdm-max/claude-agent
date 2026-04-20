import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { workflows, projects, appliedTemplates } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFiles } from "@/lib/templates/apply-files";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";
import os from "os";

// POST /api/workflows/[id]/activate
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const wf = db.select().from(workflows).where(eq(workflows.id, id)).get();
  if (!wf) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  // Check already active
  const existing = db.select().from(appliedTemplates)
    .where(and(eq(appliedTemplates.workflowId, id), eq(appliedTemplates.isActive, 1)))
    .all();
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `Already active (${existing.length} applied). Deactivate first.` },
      { status: 409 },
    );
  }

  const scope = wf.scope as FileScope;
  let projectPath: string | undefined;
  if (wf.projectId) {
    const p = db.select().from(projects).where(eq(projects.id, wf.projectId)).get();
    if (!p) return NextResponse.json({ error: "Project no longer exists" }, { status: 410 });
    projectPath = p.path;
  }

  const items = JSON.parse(wf.items || "[]") as Array<{
    templateId: string; excludeTopLevelKeys?: string[]; excludeExtraFiles?: string[];
  }>;
  if (items.length === 0) {
    return NextResponse.json({ error: "Workflow has no items" }, { status: 400 });
  }

  const target = resolveSettingsPath(scope, { projectPath, projectId: wf.projectId });
  const applied: string[] = [];
  const now = Date.now();

  // Pre-parse existing settings ONCE — fail fast on bad JSON (no disk/DB writes on parse failure)
  const existingRaw = readDisk(target.absolutePath);
  let merged: ClaudeSettings = {};
  if (existingRaw) {
    try {
      merged = JSON.parse(existingRaw) as ClaudeSettings;
    } catch (e) {
      return NextResponse.json(
        {
          error: "settings_parse_failed",
          path: target.absolutePath,
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 409 },
      );
    }
  }

  for (const item of items) {
    const template = getTemplateById(item.templateId);
    if (!template) continue;

    // Filter settings by excludes
    const filteredSettings: ClaudeSettings = { ...template.settings };
    const excludeKeys = item.excludeTopLevelKeys || [];
    for (const key of excludeKeys) {
      delete (filteredSettings as Record<string, unknown>)[key];
    }

    // Merge into running in-memory settings (start = parsed existing OR {})
    merged = deepMergeSettings(merged, filteredSettings);
    const configStr = JSON.stringify(merged, null, 2);

    // Filter extraFiles
    const filteredExtraFiles = (template.extraFiles || []).filter(
      (f) => !(item.excludeExtraFiles || []).includes(f.path),
    );

    const applyId = nanoid();
    db.transaction(() => {
      writeDiskWithSnapshot(target, configStr);
      db.insert(appliedTemplates).values({
        id: applyId,
        scope,
        projectId: wf.projectId,
        templateId: template.id,
        templateName: template.nameKo || template.name,
        deltaJson: JSON.stringify(filteredSettings),
        extraFiles: filteredExtraFiles.length > 0 ? JSON.stringify(filteredExtraFiles) : null,
        appliedAt: now,
        isActive: 1,
        workflowId: id,
      }).run();
    });

    if (filteredExtraFiles.length > 0) {
      const basePath = projectPath || os.homedir();
      applyExtraFiles(basePath, filteredExtraFiles, wf.projectId);
    }

    applied.push(template.id);
  }

  return NextResponse.json({ success: true, appliedCount: applied.length, appliedTemplateIds: applied });
}
