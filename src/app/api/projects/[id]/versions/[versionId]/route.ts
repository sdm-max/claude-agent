import { NextRequest, NextResponse } from "next/server";
import { getVersion } from "@/lib/disk-files";

type Params = { params: Promise<{ id: string; versionId: string }> };

// GET /api/projects/[id]/versions/[versionId] — fetch a single version's content
export async function GET(_req: NextRequest, { params }: Params) {
  const { versionId } = await params;
  const version = getVersion(versionId);
  if (!version) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(version);
}
