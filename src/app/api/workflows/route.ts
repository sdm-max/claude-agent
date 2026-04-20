import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { isValidItem, type WorkflowItem } from "@/lib/workflows/validate";

// Temporary re-export shim — keeps `../route` import in [id]/route.ts working until D-3b migrates it.
export { isValidItem, type WorkflowItem };

const VALID_SCOPES = ["global", "user", "project", "local"];

// GET /api/workflows?scope=X&projectId=Y
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  const projectId = req.nextUrl.searchParams.get("projectId");

  const db = getDb();
  const conditions = [];
  if (scope && VALID_SCOPES.includes(scope)) {
    conditions.push(eq(workflows.scope, scope));
  }
  if (projectId) {
    conditions.push(eq(workflows.projectId, projectId));
  } else if (scope && (scope === "global" || scope === "user")) {
    conditions.push(isNull(workflows.projectId));
  }

  const rows = conditions.length
    ? db.select().from(workflows).where(and(...conditions)).orderBy(desc(workflows.updatedAt)).all()
    : db.select().from(workflows).orderBy(desc(workflows.updatedAt)).all();

  return NextResponse.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameKo: r.nameKo || r.name,
    description: r.description || "",
    descriptionKo: r.descriptionKo || "",
    scope: r.scope,
    projectId: r.projectId,
    items: r.items ? JSON.parse(r.items) : [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })));
}

// POST /api/workflows
// body: { name, nameKo?, description?, descriptionKo?, scope, projectId?, items[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, nameKo, description, descriptionKo, scope, projectId, items } = body as {
    name?: string; nameKo?: string; description?: string; descriptionKo?: string;
    scope?: string; projectId?: string; items?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
    return NextResponse.json({ error: "name is required (1-100 chars)" }, { status: 400 });
  }
  if (!scope || !VALID_SCOPES.includes(scope)) {
    return NextResponse.json({ error: "invalid scope" }, { status: 400 });
  }
  if ((scope === "project" || scope === "local") && !projectId) {
    return NextResponse.json({ error: "projectId required for project/local scope" }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] required (at least one)" }, { status: 400 });
  }
  for (const it of items) {
    if (!isValidItem(it)) {
      return NextResponse.json({ error: "invalid item shape" }, { status: 400 });
    }
  }

  const id = `wf-${nanoid(8)}`;
  const now = Date.now();
  const db = getDb();

  db.insert(workflows).values({
    id,
    name: name.trim(),
    nameKo: typeof nameKo === "string" ? nameKo.trim() : null,
    description: typeof description === "string" ? description.trim() : "",
    descriptionKo: typeof descriptionKo === "string" ? descriptionKo.trim() : "",
    scope,
    projectId: (scope === "project" || scope === "local") ? projectId! : null,
    items: JSON.stringify(items),
    createdAt: now,
    updatedAt: now,
  }).run();

  return NextResponse.json({ id, success: true }, { status: 201 });
}
