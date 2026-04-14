import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  listVersions,
  getVersion,
  readDisk,
  writeDiskWithSnapshot,
  resolveMemoryPath,
  resolveSettingsPath,
  type FileScope,
  type ResolvedPath,
} from "@/lib/disk-files";
import path from "path";

type Params = { params: Promise<{ id: string }> };

// Resolve absolutePath back from a stored (projectId, relativePath) pair.
function resolveAbsoluteFromKey(
  projectId: string | null,
  relativePath: string,
  projectPath: string | null,
): string | null {
  if (relativePath.startsWith("~/")) {
    const home = require("os").homedir();
    return path.join(home, relativePath.slice(2));
  }
  if (!projectPath) return null;
  return path.join(projectPath, relativePath);
}

// GET /api/projects/[id]/versions?relativePath=CLAUDE.md
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const relativePath = request.nextUrl.searchParams.get("relativePath");
  const homeScope = request.nextUrl.searchParams.get("home") === "1";

  if (!relativePath) {
    return NextResponse.json({ error: "relativePath is required" }, { status: 400 });
  }

  const versions = listVersions(homeScope ? null : id, relativePath);
  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      relativePath: v.relativePath,
    })),
  );
}

// POST /api/projects/[id]/versions — restore a version
// body: { versionId }
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { versionId } = body;
  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const version = getVersion(versionId);
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const absolutePath = resolveAbsoluteFromKey(
    version.projectId,
    version.relativePath,
    project.path,
  );
  if (!absolutePath) {
    return NextResponse.json({ error: "Cannot resolve version path" }, { status: 500 });
  }

  const target: ResolvedPath = {
    absolutePath,
    relativePath: version.relativePath,
    projectId: version.projectId,
  };

  writeDiskWithSnapshot(target, version.content);

  return NextResponse.json({
    success: true,
    absolutePath,
    relativePath: version.relativePath,
    content: version.content,
  });
}

// GET individual version content
// /api/projects/[id]/versions/[versionId] — exposed via subroute file
