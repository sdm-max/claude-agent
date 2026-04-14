import { NextRequest, NextResponse } from "next/server";
import { getVersion } from "@/lib/disk-files";

type Params = { params: Promise<{ versionId: string }> };

// GET /api/user/versions/[versionId]
export async function GET(_req: NextRequest, { params }: Params) {
  const { versionId } = await params;
  const version = getVersion(versionId);
  if (!version || version.projectId !== null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(version);
}
