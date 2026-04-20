import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { projects, appliedTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFiles } from "@/lib/templates/apply-files";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";
import os from "os";

// POST /api/templates/batch-apply
// Body: { templateIds: string[], scope, projectPath?, mode }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const templateIds = body.templateIds as string[] | undefined;
  const scope = body.scope as FileScope | undefined;
  const projectPath = body.projectPath as string | undefined;
  const mode = (body.mode ?? "merge") as "merge" | "replace";

  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return NextResponse.json({ error: "templateIds must be a non-empty array" }, { status: 400 });
  }
  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'global', 'user', 'project', or 'local'" }, { status: 400 });
  }
  if ((scope === "project" || scope === "local") && !projectPath) {
    return NextResponse.json({ error: "projectPath required for project/local scope" }, { status: 400 });
  }

  const resolvedTemplates = templateIds.map((id) => getTemplateById(id));
  const missing = templateIds.filter((_, i) => !resolvedTemplates[i]);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Templates not found: ${missing.join(", ")}` }, { status: 404 });
  }

  let projectId: string | null = null;
  if (projectPath) {
    const project = getDb().select().from(projects).where(eq(projects.path, projectPath)).get();
    projectId = project?.id ?? null;
  }

  // H2: scope가 project/local인데 projectId가 없으면 명확히 거부
  if ((scope === "project" || scope === "local") && !projectId) {
    return NextResponse.json({ error: "Project not found for the given path" }, { status: 404 });
  }

  const target = resolveSettingsPath(scope, { projectPath, projectId });
  const existingRaw = readDisk(target.absolutePath);
  let merged: ClaudeSettings = {};
  if (mode === "merge" && existingRaw) {
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

  const allExtraFiles: { path: string; content: string; description: string }[] = [];
  // merged는 loop에서 누적
  for (const tmpl of resolvedTemplates) {
    if (!tmpl) continue;
    merged = deepMergeSettings(merged, tmpl.settings);
    if (tmpl.extraFiles) allExtraFiles.push(...tmpl.extraFiles);
  }

  const configStr = JSON.stringify(merged, null, 2);

  // M8: write + DB insert 전체를 transaction으로
  getDb().transaction(() => {
    writeDiskWithSnapshot(target, configStr);
    for (const tmpl of resolvedTemplates) {
      if (!tmpl) continue;
      getDb().insert(appliedTemplates).values({
        id: nanoid(),
        scope,
        projectId,
        templateId: tmpl.id,
        templateName: tmpl.nameKo || tmpl.name,
        deltaJson: JSON.stringify(tmpl.settings),
        extraFiles: tmpl.extraFiles ? JSON.stringify(tmpl.extraFiles) : null,
        appliedAt: Date.now(),
        isActive: 1,
      }).run();
    }
  });

  let savedFiles: string[] = [];
  if (allExtraFiles.length > 0) {
    const basePath = projectPath || os.homedir();
    savedFiles = applyExtraFiles(basePath, allExtraFiles, projectId);
  }

  return NextResponse.json({
    success: true,
    scope,
    applied: templateIds.length,
    config: configStr,
    extraFiles: allExtraFiles,
    savedFiles,
  });
}
