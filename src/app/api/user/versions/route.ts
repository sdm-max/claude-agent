import { NextRequest, NextResponse } from "next/server";
import path from "path";
import os from "os";
import {
  listVersions,
  getVersion,
  writeDiskWithSnapshot,
  type ResolvedPath,
} from "@/lib/disk-files";

function resolveHomeAbsolute(relativePath: string): string | null {
  if (!relativePath.startsWith("~/")) return null;
  return path.join(os.homedir(), relativePath.slice(2));
}

// GET /api/user/versions?relativePath=~/.claude/CLAUDE.md
export async function GET(request: NextRequest) {
  const relativePath = request.nextUrl.searchParams.get("relativePath");
  if (!relativePath) {
    return NextResponse.json({ error: "relativePath is required" }, { status: 400 });
  }
  const versions = listVersions(null, relativePath);
  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      relativePath: v.relativePath,
      preview: v.content.replace(/\s+/g, " ").trim().slice(0, 80),
    })),
  );
}

// POST /api/user/versions — restore a home-scope version
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { versionId } = body;
  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const version = getVersion(versionId);
  if (!version || version.projectId !== null) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const absolutePath = resolveHomeAbsolute(version.relativePath);
  if (!absolutePath) {
    return NextResponse.json({ error: "Not a home-scope version" }, { status: 400 });
  }

  const target: ResolvedPath = {
    absolutePath,
    relativePath: version.relativePath,
    projectId: null,
  };

  writeDiskWithSnapshot(target, version.content);

  return NextResponse.json({
    success: true,
    absolutePath,
    relativePath: version.relativePath,
    content: version.content,
  });
}
