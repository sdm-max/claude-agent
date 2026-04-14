import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveSettingsPath,
  readDisk,
} from "@/lib/disk-files";

type Params = { params: Promise<{ id: string }> };

function parseJsonSafe(content: string | null): Record<string, unknown> {
  if (!content) return {};
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();

  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scopes = ["global", "user", "project", "local"] as const;
  const sources: Record<string, Record<string, unknown>> = {};
  for (const scope of scopes) {
    const resolved = resolveSettingsPath(scope, {
      projectId: id,
      projectPath: project.path,
    });
    sources[scope] = parseJsonSafe(readDisk(resolved.absolutePath));
  }

  // Top-level key merge: later scopes override earlier.
  const merged: Record<string, unknown> = {
    ...sources.global,
    ...sources.user,
    ...sources.project,
    ...sources.local,
  };

  // Permissions arrays are concatenated + deduped across scopes.
  const getPerm = (s: Record<string, unknown>, k: "allow" | "deny"): string[] => {
    const p = s.permissions as { allow?: unknown; deny?: unknown } | undefined;
    const v = p?.[k];
    return Array.isArray(v) ? (v as string[]) : [];
  };

  const allow = [
    ...getPerm(sources.global, "allow"),
    ...getPerm(sources.user, "allow"),
    ...getPerm(sources.project, "allow"),
    ...getPerm(sources.local, "allow"),
  ];
  const deny = [
    ...getPerm(sources.global, "deny"),
    ...getPerm(sources.user, "deny"),
    ...getPerm(sources.project, "deny"),
    ...getPerm(sources.local, "deny"),
  ];
  if (allow.length > 0 || deny.length > 0) {
    const permissions: { allow?: string[]; deny?: string[] } = {};
    if (allow.length > 0) permissions.allow = [...new Set(allow)];
    if (deny.length > 0) permissions.deny = [...new Set(deny)];
    merged.permissions = permissions;
  }

  return NextResponse.json({ merged, sources });
}
