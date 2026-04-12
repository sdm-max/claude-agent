import { NextResponse } from "next/server";
import { GOVERNANCE_POLICIES } from "@/lib/agent-references/policies";

// GET /api/agent-references/policies — 거버넌스 정책 목록
export async function GET() {
  const policies = GOVERNANCE_POLICIES.map((p) => ({
    id: p.id,
    name: p.name,
    nameKo: p.nameKo,
    description: p.description,
    descriptionKo: p.descriptionKo,
    settings: p.settings,
  }));

  return NextResponse.json({ policies, totalCount: policies.length });
}
