import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFilesToProject } from "@/lib/templates/apply-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

// POST /api/templates/batch-apply
// Body: { templateIds: string[], scope, projectPath?, mode }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { templateIds, scope, projectPath, mode = "merge" } = body;

  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return NextResponse.json(
      { error: "templateIds must be a non-empty array" },
      { status: 400 }
    );
  }

  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json(
      { error: "scope must be 'global', 'user', 'project', or 'local'" },
      { status: 400 }
    );
  }

  if ((scope === "project" || scope === "local") && !projectPath) {
    return NextResponse.json(
      { error: "projectPath required for project/local scope" },
      { status: 400 }
    );
  }

  // Resolve all templates
  const resolvedTemplates = templateIds.map((id: string) => getTemplateById(id));
  const missing = templateIds.filter((_: string, i: number) => !resolvedTemplates[i]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Templates not found: ${missing.join(", ")}` },
      { status: 404 }
    );
  }

  const db = getDb();
  const now = Date.now();

  const isGlobalOrUser = scope === "global" || scope === "user";
  const existing = isGlobalOrUser
    ? db
        .select()
        .from(settings)
        .where(and(eq(settings.scope, scope), isNull(settings.projectPath)))
        .get()
    : db
        .select()
        .from(settings)
        .where(
          and(eq(settings.scope, scope), eq(settings.projectPath, projectPath!))
        )
        .get();

  // Start from existing settings or empty
  let merged: ClaudeSettings =
    mode === "merge" && existing
      ? JSON.parse(existing.config || "{}")
      : {};

  // Apply each template in order
  const allExtraFiles: { path: string; content: string; description: string }[] = [];
  for (const tmpl of resolvedTemplates) {
    if (!tmpl) continue;
    merged = deepMergeSettings(merged, tmpl.settings);
    if (tmpl.extraFiles) {
      allExtraFiles.push(...tmpl.extraFiles);
    }
  }

  const configStr = JSON.stringify(merged, null, 2);

  if (existing) {
    db.update(settings)
      .set({ config: configStr, updatedAt: now })
      .where(eq(settings.id, existing.id))
      .run();
  } else {
    db.insert(settings)
      .values({
        scope,
        projectPath: isGlobalOrUser ? null : projectPath!,
        config: configStr,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  // Apply CLAUDE.md extraFiles to project DB if project scope
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
