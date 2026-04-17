import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";
import { listDirectoryFiles, writeFileContent, fileExists } from "@/lib/file-io";

const EXTENSION = ".md";

function rulesDir() {
  return path.join(os.homedir(), ".claude", "rules");
}

function isValidName(name: string): boolean {
  const n = name.trim();
  if (!n || !n.endsWith(EXTENSION)) return false;
  if (n.startsWith("/")) return false;
  if (n.includes("\\") || n.includes("\0")) return false;
  if (n.includes("//")) return false;
  const segments = n.split("/");
  if (segments.length > 4) return false;
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") return false;
  }
  return true;
}

// GET /api/user/rules — list all user-level rule files
export async function GET() {
  const files = listDirectoryFiles(rulesDir(), EXTENSION, { recursive: true });
  return NextResponse.json(files);
}

// POST /api/user/rules — create a new rule file
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const dir = rulesDir();
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    return NextResponse.json({ error: "Failed to create directory" }, { status: 500 });
  }

  const filePath = path.join(dir, name);
  if (fileExists(filePath)) {
    return NextResponse.json({ error: "File already exists" }, { status: 409 });
  }
  writeFileContent(filePath, content);

  return NextResponse.json({ name, content }, { status: 201 });
}

// PUT /api/user/rules — update an existing rule file
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const filePath = path.join(rulesDir(), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  writeFileContent(filePath, content);
  return NextResponse.json({ name, content });
}

// DELETE /api/user/rules?name=xxx — delete a rule file
export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name query param" }, { status: 400 });
  }

  const filePath = path.join(rulesDir(), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    fs.unlinkSync(filePath);
  } catch {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
