import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { customTemplates } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import type { ClaudeSettings } from "@/lib/settings-schema";

// 위험한 extraFiles 경로 차단 (apply-files.ts와 동일)
function validateExtraFilePath(path: string): boolean {
  if (path.includes("..")) return false;
  // 절대경로는 ~/ prefix만 허용
  if (path.startsWith("/") && !path.startsWith("~/")) return false;
  return true;
}

// prototype pollution 방지 — own-key walker (T-F2.7)
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_SANITIZE_DEPTH = 32;

function containsForbiddenKey(value: unknown, depth: number): boolean {
  if (depth > MAX_SANITIZE_DEPTH) {
    throw new Error("depth_exceeded");
  }
  if (!value || typeof value !== "object") return false;
  // Arrays: recurse into elements but don't treat indices as keys
  if (Array.isArray(value)) {
    for (const el of value) {
      if (containsForbiddenKey(el, depth + 1)) return true;
    }
    return false;
  }
  // Plain object: check own keys + recurse into values
  const obj = value as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(k)) return true;
    if (containsForbiddenKey(obj[k], depth + 1)) return true;
  }
  return false;
}

function sanitizeSettings(obj: unknown): ClaudeSettings {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error("settings must be an object");
  }
  if (containsForbiddenKey(obj, 0)) {
    throw new Error("settings contains forbidden keys");
  }
  // Round-trip via JSON to strip functions/symbols (parity with prior behavior)
  return JSON.parse(JSON.stringify(obj)) as ClaudeSettings;
}

// GET /api/custom-templates — 목록 조회
export async function GET() {
  const db = getDb();
  const rows = db.select().from(customTemplates).orderBy(desc(customTemplates.updatedAt)).all();
  return NextResponse.json(rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameKo: r.nameKo || r.name,
    description: r.description || "",
    descriptionKo: r.descriptionKo || "",
    category: r.category,
    difficulty: r.difficulty,
    scope: r.scope,
    tags: r.tags ? JSON.parse(r.tags) : [],
    hasExtraFiles: !!r.extraFiles,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })));
}

// POST /api/custom-templates — 생성
// body: { name, nameKo?, description?, descriptionKo?, category, difficulty?, scope?, tags?, settings, extraFiles? }
export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 검증
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100) {
    return NextResponse.json({ error: "name is required (1-100 chars)" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 500) {
    return NextResponse.json({ error: "description too long (max 500 chars)" }, { status: 400 });
  }

  const category = typeof body.category === "string" ? body.category : "custom";
  const VALID_CATEGORIES = [
    "security", "permissions", "hooks", "skills", "mcp", "claude-md",
    "cicd", "agents", "model", "env", "ui", "optimization", "custom",
  ];
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  let settings: ClaudeSettings;
  try {
    settings = sanitizeSettings(body.settings);
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid settings";
    const code =
      message === "depth_exceeded" ? "depth_exceeded" :
      message === "settings contains forbidden keys" ? "forbidden_keys" :
      "invalid_settings";
    return NextResponse.json({ error: message, code, detail: message }, { status: 400 });
  }

  // extraFiles 검증
  let extraFilesJson: string | null = null;
  if (body.extraFiles !== undefined && body.extraFiles !== null) {
    if (!Array.isArray(body.extraFiles)) {
      return NextResponse.json({ error: "extraFiles must be an array" }, { status: 400 });
    }
    for (const ef of body.extraFiles) {
      if (!ef || typeof ef !== "object" || typeof ef.path !== "string" || typeof ef.content !== "string") {
        return NextResponse.json({ error: "invalid extraFile shape" }, { status: 400 });
      }
      if (!validateExtraFilePath(ef.path)) {
        return NextResponse.json({ error: `invalid extraFile path: ${ef.path}` }, { status: 400 });
      }
    }
    extraFilesJson = JSON.stringify(body.extraFiles);
  }

  const id = `custom-${nanoid(8)}`;
  const now = Date.now();
  const difficulty = typeof body.difficulty === "number" && [1, 2, 3].includes(body.difficulty) ? body.difficulty : 1;
  const scope = typeof body.scope === "string" && ["global", "user", "project", "local", "both"].includes(body.scope) ? body.scope : "project";
  const tagsJson = Array.isArray(body.tags) ? JSON.stringify(body.tags) : null;

  const db = getDb();
  db.insert(customTemplates).values({
    id,
    name,
    nameKo: typeof body.nameKo === "string" ? body.nameKo.trim() : null,
    description,
    descriptionKo: typeof body.descriptionKo === "string" ? body.descriptionKo.trim() : "",
    category,
    difficulty,
    scope,
    tags: tagsJson,
    settings: JSON.stringify(settings),
    extraFiles: extraFilesJson,
    createdAt: now,
    updatedAt: now,
  }).run();

  return NextResponse.json({ id, success: true }, { status: 201 });
}
