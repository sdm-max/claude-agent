import { NextRequest, NextResponse } from "next/server";
import { templates, categoryLabels } from "@/lib/templates";

// GET /api/templates?category=security|hooks|...
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  let filtered = templates;
  if (category) {
    filtered = templates.filter((t) => t.category === category);
  }

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
    })),
    categories: categoryLabels,
  });
}
