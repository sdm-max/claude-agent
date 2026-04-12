import { NextRequest, NextResponse } from "next/server";
import { getTemplateById } from "@/lib/templates";
import { annotateSettingsJson } from "@/lib/templates/annotate";

// GET /api/templates/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = getTemplateById(id);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...template,
    settingsJson: annotateSettingsJson(template.settings as Record<string, unknown>),
  });
}
