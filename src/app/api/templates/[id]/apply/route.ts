import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFilesToProject } from "@/lib/templates/apply-files";
import { resolveSettingsPath, readDisk, writeDiskWithSnapshot, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

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

  const target = resolveSettingsPath(scope, { projectPath, projectId });
  const existingRaw = readDisk(target.absolutePath);
  let merged: ClaudeSettings;
  if (mode === "merge" && existingRaw) {
    try {
      merged = deepMergeSettings(JSON.parse(existingRaw) as ClaudeSettings, template.settings);
    } catch {
      merged = template.settings;
    }
  } else {
    merged = template.settings;
  }

  const configStr = JSON.stringify(merged, null, 2);
  writeDiskWithSnapshot(target, configStr);

  let savedFiles: string[] = [];
  if (projectPath && template.extraFiles) {
    savedFiles = applyExtraFilesToProject(projectPath, template.extraFiles);
  }

  return NextResponse.json({
    success: true,
    scope,
    config: configStr,
    extraFiles: template.extraFiles || [],
    savedFiles,
  });
}
