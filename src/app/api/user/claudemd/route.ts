import { NextRequest, NextResponse } from "next/server";
import {
  resolveMemoryPath,
  readDisk,
  writeDiskWithSnapshot,
  diskExists,
} from "@/lib/disk-files";
import { ensureAllWatchersStarted } from "@/lib/fs-watcher";

// GET /api/user/claudemd — read ~/.claude/CLAUDE.md (user-level memory)
export async function GET(_req: NextRequest) {
  await ensureAllWatchersStarted();

  const resolved = resolveMemoryPath("user");
  const content = readDisk(resolved.absolutePath);
  return NextResponse.json({
    scope: "user",
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: content !== null,
    content: content ?? "",
  });
}

// PUT /api/user/claudemd — write ~/.claude/CLAUDE.md
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const content = typeof body.content === "string" ? body.content : "";

  const resolved = resolveMemoryPath("user");
  try {
    writeDiskWithSnapshot(resolved, content);
  } catch (e) {
    return NextResponse.json(
      { error: `Failed to write: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    scope: "user",
    absolutePath: resolved.absolutePath,
    relativePath: resolved.relativePath,
    exists: diskExists(resolved.absolutePath),
    content,
  });
}
