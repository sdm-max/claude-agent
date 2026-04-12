import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveFilePath, writeFileContent } from "@/lib/file-io";

// POST /api/settings/export?scope=global|user
export async function POST(request: NextRequest) {
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

  if (!row || row.config.trim() === "{}") {
    return NextResponse.json({ error: "No settings to export (empty)" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = JSON.parse(row.config);
  } catch {
    return NextResponse.json({ error: "DB contains invalid JSON — cannot export" }, { status: 500 });
  }
  const content = JSON.stringify(parsed, null, 2);

  const filePath = resolveFilePath("", "settings", scope as "global" | "user");

  writeFileContent(filePath, content);

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
