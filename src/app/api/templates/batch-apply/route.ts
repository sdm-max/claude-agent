import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFilesToProject } from "@/lib/templates/apply-files";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

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

  const target = resolveSettingsPath(scope, { projectPath, projectId });
  const existingRaw = readDisk(target.absolutePath);
  let merged: ClaudeSettings = {};
  if (mode === "merge" && existingRaw) {
    try { merged = JSON.parse(existingRaw) as ClaudeSettings; } catch { merged = {}; }
  }

  const allExtraFiles: { path: string; content: string; description: string }[] = [];
  for (const tmpl of resolvedTemplates) {
    if (!tmpl) continue;
    merged = deepMergeSettings(merged, tmpl.settings);
    if (tmpl.extraFiles) allExtraFiles.push(...tmpl.extraFiles);
  }

  const configStr = JSON.stringify(merged, null, 2);
  writeDiskWithSnapshot(target, configStr);

  let savedFiles: string[] = [];
  if (projectPath && allExtraFiles.length > 0) {
    savedFiles = applyExtraFilesToProject(projectPath, allExtraFiles);
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
