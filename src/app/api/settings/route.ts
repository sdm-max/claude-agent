import { NextRequest, NextResponse } from "next/server";
import {
  resolveSettingsPath,
  readDisk,
  writeDiskWithSnapshot,
  diskExists,
  type FileScope,
} from "@/lib/disk-files";
import { ensureAllWatchersStarted } from "@/lib/fs-watcher";

function parseScope(raw: string | null): FileScope | null {
  if (!raw) return null;
  if (raw === "global" || raw === "user") return raw;
  return null;
}

// GET /api/settings?scope=global|user
export async function GET(request: NextRequest) {
  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  if (!scope) {
    return NextResponse.json({ error: "scope must be 'global' or 'user'" }, { status: 400 });
  }

  await ensureAllWatchersStarted();

  const resolved = resolveSettingsPath(scope);
  const content = readDisk(resolved.absolutePath);
  return NextResponse.json({
    scope,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: content !== null,
    config: content ?? "{}",
  });
}

// PUT /api/settings?scope=global|user
export async function PUT(request: NextRequest) {
  const scope = parseScope(request.nextUrl.searchParams.get("scope"));
  if (!scope) {
    return NextResponse.json({ error: "scope must be 'global' or 'user'" }, { status: 400 });
  }

  const body = await request.json();
  const config = typeof body.config === "string" ? body.config : JSON.stringify(body.config, null, 2);

  try {
    JSON.parse(config);
  } catch {
    return NextResponse.json({ error: "Invalid JSON in config" }, { status: 400 });
  }

  const resolved = resolveSettingsPath(scope);

  try {
    writeDiskWithSnapshot(resolved, config);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write settings: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scope,
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: diskExists(resolved.absolutePath),
    config,
  });
}
