import { NextRequest, NextResponse } from "next/server";
import { getAllTemplates, categoryLabels } from "@/lib/templates";

// GET /api/templates?category=security|hooks|...|custom
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  const all = getAllTemplates();
  const filtered = category ? all.filter((t) => t.category === category) : all;

  return NextResponse.json({
    templates: filtered.map((t) => ({
      id: t.id,
      name: t.name,
      nameKo: t.nameKo,
      description: t.description,
      descriptionKo: t.descriptionKo,
      category: t.category,
      difficulty: t.difficulty,
      scope: t.scope,
      tags: t.tags,
      hasExtraFiles: !!t.extraFiles?.length,
      isCustom: t.isCustom ?? false,
    })),
    categories: categoryLabels,
  });
}
