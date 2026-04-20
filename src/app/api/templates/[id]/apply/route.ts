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

// POST /api/templates/[id]/apply
// Body: { scope: "global" | "user" | "project" | "local", projectPath?: string, mode: "replace" | "merge" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = getTemplateById(id);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const scope = body.scope as FileScope | undefined;
  const projectPath = body.projectPath as string | undefined;
  const mode = (body.mode ?? "merge") as "merge" | "replace";
  const excludeKeys = (body.excludeTopLevelKeys as string[] | undefined) || [];
  const excludeExtraFiles = (body.excludeExtraFiles as string[] | undefined) || [];

  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'global', 'user', 'project', or 'local'" }, { status: 400 });
  }
  if ((scope === "project" || scope === "local") && !projectPath) {
    return NextResponse.json({ error: "projectPath required for project/local scope" }, { status: 400 });
  }

  let projectId: string | null = null;
  if (projectPath) {
    const project = getDb().select().from(projects).where(eq(projects.path, projectPath)).get();
    projectId = project?.id ?? null;
  }

  // H1: scope가 project/local인데 projectId가 없으면 명확히 거부
  if ((scope === "project" || scope === "local") && !projectId) {
    return NextResponse.json({ error: "Project not found for the given path" }, { status: 404 });
  }

  const target = resolveSettingsPath(scope, { projectPath, projectId });
  const existingRaw = readDisk(target.absolutePath);

  // Phase 2-1: filter out excluded top-level keys from template.settings before merge
  const filteredSettings: ClaudeSettings = { ...template.settings };
  for (const key of excludeKeys) {
    delete (filteredSettings as Record<string, unknown>)[key];
  }

  let merged: ClaudeSettings;
  if (mode === "merge" && existingRaw) {
    try {
      merged = deepMergeSettings(JSON.parse(existingRaw) as ClaudeSettings, filteredSettings);
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
  } else {
    merged = filteredSettings;
  }

  const configStr = JSON.stringify(merged, null, 2);

  // Phase 2-1: filter extraFiles before applying/persisting
  const filteredExtraFiles = (template.extraFiles || []).filter(
    (f) => !excludeExtraFiles.includes(f.path),
  );

  // M8: writeDisk + DB insert를 transaction으로 묶기 (DB 실패시 파일은 남지만 snapshot 존재, 재실행 안전)
  const appliedId = nanoid();
  getDb().transaction(() => {
    writeDiskWithSnapshot(target, configStr);
    getDb().insert(appliedTemplates).values({
      id: appliedId,
      scope,
      projectId,
      templateId: template.id,
      templateName: template.nameKo || template.name,
      deltaJson: JSON.stringify(filteredSettings),
      extraFiles: filteredExtraFiles.length > 0 ? JSON.stringify(filteredExtraFiles) : null,
      appliedAt: Date.now(),
      isActive: 1,
    }).run();
  });

  let savedFiles: string[] = [];
  if (filteredExtraFiles.length > 0) {
    const basePath = projectPath || os.homedir();
    savedFiles = applyExtraFiles(basePath, filteredExtraFiles, projectId);
  }

  return NextResponse.json({
    success: true,
    appliedId,
    scope,
    config: configStr,
    extraFiles: filteredExtraFiles,
    savedFiles,
  });
}
