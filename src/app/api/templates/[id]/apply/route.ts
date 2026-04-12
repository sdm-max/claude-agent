import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import { applyExtraFilesToProject } from "@/lib/templates/apply-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

// POST /api/templates/[id]/apply
// Body: { scope: "global" | "user" | "project" | "local", projectPath?: string, mode: "replace" | "merge" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = getTemplateById(id);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const body = await request.json();
  const { scope, projectPath, mode = "merge" } = body;

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

  let finalConfig: ClaudeSettings;

  if (mode === "merge" && existing) {
    const existingConfig: ClaudeSettings = JSON.parse(existing.config || "{}");
    finalConfig = deepMergeSettings(existingConfig, template.settings);
  } else {
    finalConfig = template.settings;
  }

  const configStr = JSON.stringify(finalConfig, null, 2);

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
