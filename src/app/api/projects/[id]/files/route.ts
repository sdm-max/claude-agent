import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { files, fileVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

type Params = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/files?type=claude-md&scope=project
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const url = request.nextUrl;
  const type = url.searchParams.get("type");
  const scope = url.searchParams.get("scope");

  let conditions = [eq(files.projectId, id)];
  if (type) conditions.push(eq(files.type, type));
  if (scope) conditions.push(eq(files.scope, scope));

  const rows = db.select().from(files).where(and(...conditions)).all();
  return NextResponse.json(rows);
}

// POST /api/projects/[id]/files — create file
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { type, scope, content } = body;

  if (!type || !scope) {
    return NextResponse.json({ error: "type and scope are required" }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();
  const fileId = nanoid();

  db.insert(files).values({
    id: fileId,
    projectId: id,
    type,
    scope,
    content: content || "",
    createdAt: now,
    updatedAt: now,
  }).run();

  const file = db.select().from(files).where(eq(files.id, fileId)).get();
  return NextResponse.json(file, { status: 201 });
}
