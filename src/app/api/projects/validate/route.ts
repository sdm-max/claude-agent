import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// POST /api/projects/validate — validate a project path
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { path: projectPath } = body;

  if (!projectPath || typeof projectPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const exists = fs.existsSync(projectPath);
  let isDirectory = false;
  let hasClaudeDir = false;

  if (exists) {
    try {
      isDirectory = fs.statSync(projectPath).isDirectory();
      if (isDirectory) {
        hasClaudeDir = fs.existsSync(path.join(projectPath, ".claude"));
      }
    } catch {
      // ignore stat errors
    }
  }

  return NextResponse.json({
    path: projectPath,
    exists,
    isDirectory,
    hasClaudeDir,
  });
}
