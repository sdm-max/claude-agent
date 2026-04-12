import { NextRequest, NextResponse } from "next/server";
import { getProfileById } from "@/lib/agent-references";
import { renderAgentMd, renderEmptyAgentMd } from "@/lib/agent-references/renderer";
import { validateAgentName, validateFrontmatter, checkLockedFieldChanges } from "@/lib/agent-references/validator";
import type { AgentFrontmatter } from "@/lib/agent-references/types";

// POST /api/agent-references/[id]/render — 프로필 + 이름 → .md 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { agentName, overrides } = body as {
    agentName: string;
    overrides?: Partial<AgentFrontmatter>;
  };

  // 이름 검증
  const nameErrors = validateAgentName(agentName);
  if (nameErrors.some((e) => e.severity === "error")) {
    return NextResponse.json({ errors: nameErrors }, { status: 400 });
  }

  // "none" 프로필 — 빈 템플릿
  if (id === "none") {
    return NextResponse.json({
      md: renderEmptyAgentMd(agentName),
      warnings: [],
    });
  }

  const profile = getProfileById(id);
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // frontmatter 검증
  const merged: AgentFrontmatter = {
    ...profile.frontmatter,
    ...overrides,
    name: agentName,
  };
  const fmErrors = validateFrontmatter(merged);
  const hardErrors = fmErrors.filter((e) => e.severity === "error");
  if (hardErrors.length > 0) {
    return NextResponse.json({ errors: hardErrors }, { status: 400 });
  }

  // 잠금 필드 경고
  const lockedWarnings = overrides ? checkLockedFieldChanges(profile, overrides) : [];

  // 렌더링
  const md = renderAgentMd(profile, agentName, overrides);

  return NextResponse.json({
    md,
    warnings: [...fmErrors.filter((e) => e.severity === "warning"), ...lockedWarnings],
    companionSettings: profile.companionSettings ?? null,
  });
}
