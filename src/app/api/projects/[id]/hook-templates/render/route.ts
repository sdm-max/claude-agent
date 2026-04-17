import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { collectProjectVariables, renderTemplate } from "@/lib/hook-templating";

type Params = { params: Promise<{ id: string }> };

async function resolveProject(id: string) {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}

// POST /api/projects/[id]/hook-templates/render
// body: { content: string }
// Returns: { rendered: string, variables: Record<string,string> }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content : "";
  const vars = collectProjectVariables(project.path);
  const rendered = renderTemplate(content, vars);
  return NextResponse.json({ rendered, variables: vars });
}

// GET /api/projects/[id]/hook-templates/render — variables only
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const project = await resolveProject(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const vars = collectProjectVariables(project.path);
  return NextResponse.json({ variables: vars });
}
