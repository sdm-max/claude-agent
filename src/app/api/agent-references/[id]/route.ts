import { NextRequest, NextResponse } from "next/server";
import { getProfileById } from "@/lib/agent-references";

// GET /api/agent-references/[id] — 단일 프로필 상세
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const profile = getProfileById(id);

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json(profile);
}
