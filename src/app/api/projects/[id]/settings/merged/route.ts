import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings, projects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load all 4 scopes
  const globalRow = db.select().from(settings).where(and(eq(settings.scope, "global"), isNull(settings.projectPath))).get();
  const userRow = db.select().from(settings).where(and(eq(settings.scope, "user"), isNull(settings.projectPath))).get();
  const projectRow = db.select().from(settings).where(and(eq(settings.scope, "project"), eq(settings.projectPath, project.path))).get();
  const localRow = db.select().from(settings).where(and(eq(settings.scope, "local"), eq(settings.projectPath, project.path))).get();

  const parse = (row: any) => {
    try { return row ? JSON.parse(row.config) : {}; } catch { return {}; }
  };

  // Deep merge: later scopes override earlier ones (key by key at top level)
  const merged = {
    ...parse(globalRow),
    ...parse(userRow),
    ...parse(projectRow),
    ...parse(localRow),
  };

  // For permissions, merge arrays
  const allPermissions = {
    allow: [
      ...(parse(globalRow).permissions?.allow || []),
      ...(parse(userRow).permissions?.allow || []),
      ...(parse(projectRow).permissions?.allow || []),
      ...(parse(localRow).permissions?.allow || []),
    ],
    deny: [
      ...(parse(globalRow).permissions?.deny || []),
      ...(parse(userRow).permissions?.deny || []),
      ...(parse(projectRow).permissions?.deny || []),
      ...(parse(localRow).permissions?.deny || []),
    ],
  };
  if (allPermissions.allow.length > 0 || allPermissions.deny.length > 0) {
    merged.permissions = {};
    if (allPermissions.allow.length > 0) merged.permissions.allow = [...new Set(allPermissions.allow)];
    if (allPermissions.deny.length > 0) merged.permissions.deny = [...new Set(allPermissions.deny)];
  }

  return NextResponse.json({
    merged,
    sources: {
      global: parse(globalRow),
      user: parse(userRow),
      project: parse(projectRow),
      local: parse(localRow),
    }
  });
}
