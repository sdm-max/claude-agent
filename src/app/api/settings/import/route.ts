import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { resolveFilePath, readFileContent } from "@/lib/file-io";

// POST /api/settings/import?scope=global|user
// Reads settings.json from disk and imports into DB
export async function POST(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");

  if (!scope || !["global", "user"].includes(scope)) {
    return NextResponse.json({ error: "scope must be 'global' or 'user'" }, { status: 400 });
  }

  const filePath = resolveFilePath("", "settings", scope as "global" | "user");
  const content = readFileContent(filePath);

  if (content === null) {
    return NextResponse.json({ error: `File not found: ${filePath}` }, { status: 404 });
  }

  // Strict JSON validation — reject trailing data like {}{...}
  let validConfig: string;
  try {
    const parsed = JSON.parse(content);
    validConfig = JSON.stringify(parsed, null, 2);
  } catch {
    return NextResponse.json({ error: "File contains invalid JSON" }, { status: 400 });
  }
  const config = validConfig;

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

  return NextResponse.json({
    success: true,
    path: filePath,
    scope,
  });
}
