import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getTemplateById } from "@/lib/templates";
import { deepMergeSettings } from "@/lib/templates/merge";
import {
  detectInternalConflicts,
  detectOrderDependencies,
} from "@/lib/templates/conflict-detector";
import { resolveSettingsPath, readDisk, type FileScope } from "@/lib/disk-files";
import type { ClaudeSettings } from "@/lib/settings-schema";

// POST /api/templates/preview-conflicts
// Body: { templateIds: string[], scope, projectPath? }
export async function POST(request: NextRequest) {
  const body = await request.json();
  const templateIds = body.templateIds as string[] | undefined;
  const scope = body.scope as FileScope | undefined;
  const projectPath = body.projectPath as string | undefined;

  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return NextResponse.json({ error: "templateIds required" }, { status: 400 });
  }
  if (!scope || !["global", "user", "project", "local"].includes(scope)) {
    return NextResponse.json({ error: "scope invalid" }, { status: 400 });
  }
  if ((scope === "project" || scope === "local") && !projectPath) {
    return NextResponse.json({ error: "projectPath required for project/local" }, { status: 400 });
  }

  let projectId: string | null = null;
  if (projectPath) {
    const p = getDb().select().from(projects).where(eq(projects.path, projectPath)).get();
    projectId = p?.id ?? null;
    if ((scope === "project" || scope === "local") && !projectId) {
      return NextResponse.json({ error: "Project not found for the given path" }, { status: 404 });
    }
  }

  let target;
  try {
    target = resolveSettingsPath(scope, { projectPath, projectId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "path resolve failed" }, { status: 400 });
  }
  const existingRaw = readDisk(target.absolutePath);
  let current: ClaudeSettings = {};
  if (existingRaw) {
    try { current = JSON.parse(existingRaw) as ClaudeSettings; } catch { /* ignore */ }
  }

  // 선택된 템플릿들을 순차 머지한 incoming
  let incoming: ClaudeSettings = {};
  for (const id of templateIds) {
    const tmpl = getTemplateById(id);
    if (!tmpl) continue;
    incoming = deepMergeSettings(incoming, tmpl.settings);
  }

  // 머지 예상 결과의 내부 충돌
  const merged = deepMergeSettings(current, incoming);
  const report = detectInternalConflicts(merged);

  // Phase 2-4: 순서 의존 감지
  const resolvedForOrder = templateIds
    .map((id) => {
      const t = getTemplateById(id);
      return t ? { id: t.id, name: t.nameKo || t.name, settings: t.settings } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const orderReport = detectOrderDependencies(resolvedForOrder);

  return NextResponse.json({
    ...report,
    orderDependencies: orderReport.conflicts,
    orderSummary: orderReport.summary,
  });
}
