import { NextResponse } from "next/server";
import { MATCHER_PRESETS, HOOK_EVENTS } from "@/lib/hook-matcher-presets";

// GET /api/hook-presets — 모든 matcher preset 및 이벤트 목록
export async function GET() {
  return NextResponse.json({
    presets: MATCHER_PRESETS,
    events: HOOK_EVENTS,
  });
}
