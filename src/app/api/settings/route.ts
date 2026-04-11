import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

// GET /api/settings?scope=global|user
export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (!scope || !["global", "user"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'global' or 'user'" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), isNull(settings.projectPath)))
    .get();

  if (!row) {
    return NextResponse.json({ id: null, scope, config: "{}", projectPath: null });
  }

  return NextResponse.json(row);
}

// PUT /api/settings?scope=global|user
export async function PUT(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  if (!scope || !["global", "user"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'global' or 'user'" }, { status: 400 });
  }

  const body = await request.json();
  const config = typeof body.config === "string" ? body.config : JSON.stringify(body.config);
  const db = getDb();
  const now = Date.now();

  const existing = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), isNull(settings.projectPath)))
    .get();

  if (existing) {
    db.update(settings)
      .set({ config, updatedAt: now })
      .where(eq(settings.id, existing.id))
      .run();
  } else {
    db.insert(settings)
      .values({ scope, projectPath: null, config, createdAt: now, updatedAt: now })
      .run();
  }

  const updated = db
    .select()
    .from(settings)
    .where(and(eq(settings.scope, scope), isNull(settings.projectPath)))
    .get();

  return NextResponse.json(updated);
}
