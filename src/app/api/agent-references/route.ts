import { NextResponse } from "next/server";
import { ALL_PROFILES, GOVERNANCE_CATEGORIES, getAllCategories } from "@/lib/agent-references";

// GET /api/agent-references — 전체 프로필 목록 (카테고리별 그룹)
export async function GET() {
  const categories = getAllCategories().map((cat) => ({
    key: cat,
    ...GOVERNANCE_CATEGORIES[cat],
    profiles: ALL_PROFILES.filter((p) => p.category === cat).map((p) => ({
      id: p.id,
      name: p.name,
      nameKo: p.nameKo,
      description: p.description,
      descriptionKo: p.descriptionKo,
      category: p.category,
      riskLevel: p.riskLevel,
      costTier: p.costTier,
      model: p.frontmatter.model ?? "inherit",
      lockedFields: p.lockedFields ?? [],
    })),
  }));

  return NextResponse.json({ categories, totalCount: ALL_PROFILES.length });
}
