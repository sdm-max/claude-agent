import { NextResponse } from "next/server";

// DEPRECATED: legacy fileId-keyed version history. Version history now keys
// on (projectId, relativePath) via /api/projects/[id]/versions. This route
// is kept as a 410 stub until ClaudeMdEditor + VersionHistory migrate.

export async function GET() {
  return NextResponse.json([], { status: 410 });
}

export async function POST() {
  return NextResponse.json(
    { error: "Legacy version restore disabled. Use the new versions endpoint." },
    { status: 410 },
  );
}
