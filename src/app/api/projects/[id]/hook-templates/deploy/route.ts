import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { collectProjectVariables, listHookTemplates, deployTemplate } from "@/lib/hook-templating";

type Params = { params: Promise<{ id: string }> };

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// POST /api/projects/[id]/hook-templates/deploy
// Deploys all *.tpl under .claude/hooks/ by rendering and writing to sibling files.
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const vars = collectProjectVariables(project.path);
  const templates = listHookTemplates(project.path);
  const deployed: string[] = [];
  const failed: string[] = [];
  for (const t of templates) {
    try {
      const r = deployTemplate(project.path, t, vars);
      if (r) deployed.push(`${t} → ${r.output}`);
    } catch {
      failed.push(t);
    }
  }
  return NextResponse.json({
    templates: templates.length,
    deployed: deployed.length,
    failed: failed.length,
    deployedList: deployed,
    failedList: failed,
    variables: vars,
  });
}

// GET — list templates + current variables for preview
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const templates = listHookTemplates(project.path);
  const vars = collectProjectVariables(project.path);
  return NextResponse.json({ templates, variables: vars });
}
