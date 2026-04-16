import fs from "fs";
import path from "path";
import os from "os";
import { NextRequest, NextResponse } from "next/server";
import { listDirectoryFiles, writeFileContent, fileExists } from "@/lib/file-io";

const EXTENSION = ".sh";

function hooksDir() {
  return path.join(os.homedir(), ".claude", "hooks");
}

function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n !== "." && n !== ".."
    && !n.includes("/") && !n.includes("\\") && !n.includes("\0") && !n.includes("..")
    && n.endsWith(EXTENSION);
}

// GET /api/user/hooks — list all user-level hook scripts
export async function GET() {
  const files = listDirectoryFiles(hooksDir(), EXTENSION);
  return NextResponse.json(files);
}

// POST /api/user/hooks — create a new hook script
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const dir = hooksDir();
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

// PUT /api/user/hooks — update an existing hook script
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { name, content } = body as { name?: string; content?: string };

  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name" }, { status: 400 });
  }
  if (content === undefined || content === null) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const filePath = path.join(hooksDir(), name);
  if (!fileExists(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  writeFileContent(filePath, content);
  return NextResponse.json({ name, content });
}

// DELETE /api/user/hooks?name=xxx — delete a hook script
export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name || !isValidName(name)) {
    return NextResponse.json({ error: "Invalid or missing name query param" }, { status: 400 });
  }

  const filePath = path.join(hooksDir(), name);
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
