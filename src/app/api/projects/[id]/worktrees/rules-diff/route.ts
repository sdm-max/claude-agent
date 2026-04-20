import crypto from "crypto";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

type DiffStatus = "only-in-master" | "only-in-worktree" | "same" | "differ";

interface RuleDiffEntry {
  name: string;
  status: DiffStatus;
  masterSha: string | null;
  worktreeSha: string | null;
  masterContent?: string;
  worktreeContent?: string;
}

function sha1(content: string): string {
  return crypto.createHash("sha1").update(content, "utf-8").digest("hex");
}

function rulesDir(root: string): string {
  return path.join(root, ".claude", "rules");
}

function listRuleFiles(dir: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return result;
  const maxDepth = 4;
  const walk = (current: string, relative: string, depth: number) => {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(current, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isFile() && entry.name.endsWith(".md")) {
        result.set(rel, abs);
      } else if (entry.isDirectory() && depth < maxDepth) {
        walk(abs, rel, depth + 1);
      }
    }
  };
  walk(dir, "", 0);
  return result;
}

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

// GET /api/projects/[id]/worktrees/rules-diff?worktree=<abs>&includeContent=1
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const worktreePath = req.nextUrl.searchParams.get("worktree");
  const includeContent = req.nextUrl.searchParams.get("includeContent") === "1";

  if (!worktreePath || !path.isAbsolute(worktreePath)) {
    return NextResponse.json(
      { error: "worktree query param (absolute path) is required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const normalizedProject = project.path.replace(/\/+$/, "");
  const normalizedWorktree = worktreePath.replace(/\/+$/, "");

  const masterFiles = listRuleFiles(rulesDir(project.path));
  const worktreeFiles = listRuleFiles(rulesDir(worktreePath));

  const names = new Set<string>([...masterFiles.keys(), ...worktreeFiles.keys()]);
  const files: RuleDiffEntry[] = [];

  for (const name of [...names].sort()) {
    const masterAbs = masterFiles.get(name) ?? null;
    const worktreeAbs = worktreeFiles.get(name) ?? null;
    const masterContent = masterAbs ? safeRead(masterAbs) : null;
    const worktreeContent = worktreeAbs ? safeRead(worktreeAbs) : null;
    const masterSha = masterContent !== null ? sha1(masterContent) : null;
    const worktreeSha = worktreeContent !== null ? sha1(worktreeContent) : null;

    let status: DiffStatus;
    if (masterSha && !worktreeSha) status = "only-in-master";
    else if (!masterSha && worktreeSha) status = "only-in-worktree";
    else if (masterSha === worktreeSha) status = "same";
    else status = "differ";

    const entry: RuleDiffEntry = { name, status, masterSha, worktreeSha };
    if (includeContent) {
      if (masterContent !== null) entry.masterContent = masterContent;
      if (worktreeContent !== null) entry.worktreeContent = worktreeContent;
    }
    files.push(entry);
  }

  return NextResponse.json({
    masterPath: normalizedProject,
    worktreePath: normalizedWorktree,
    files,
  });
}
