import { execFileSync } from "child_process";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

export interface WorktreeEntry {
  path: string;
  branch: string | null;
  head: string | null;
  isMain: boolean;
}

/**
 * Parse `git worktree list --porcelain` output.
 * Each record is separated by a blank line and contains lines like:
 *   worktree /abs/path
 *   HEAD <sha>
 *   branch refs/heads/<name>    (or "detached")
 *   bare                        (for bare main repo — skipped)
 */
function parseWorktreePorcelain(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = output.split(/\n\s*\n/);
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    let path: string | null = null;
    let head: string | null = null;
    let branch: string | null = null;
    let isBare = false;
    let isDetached = false;
    for (const line of trimmed.split("\n")) {
      if (line.startsWith("worktree ")) path = line.slice("worktree ".length).trim();
      else if (line.startsWith("HEAD ")) head = line.slice("HEAD ".length).trim();
      else if (line.startsWith("branch ")) {
        const ref = line.slice("branch ".length).trim();
        branch = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : ref;
      } else if (line === "bare") isBare = true;
      else if (line === "detached") isDetached = true;
    }
    if (!path || isBare) continue;
    if (isDetached && !branch) branch = "(detached)";
    entries.push({ path, branch, head, isMain: false });
  }
  return entries;
}

// GET /api/projects/[id]/worktrees
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Validate that the project path is a git working tree (or its root is)
  if (!fs.existsSync(project.path) || !fs.statSync(project.path).isDirectory()) {
    return NextResponse.json(
      { error: "Project path does not exist or is not a directory", worktrees: [] },
      { status: 400 },
    );
  }

  let output: string;
  try {
    output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: project.path,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Failed to run `git worktree list`. The project path may not be a git repository.",
        detail: msg,
        worktrees: [],
      },
      { status: 400 },
    );
  }

  const all = parseWorktreePorcelain(output);
  // Flag the entry whose path matches project.path (or is a parent) as "main"
  const normalizedProject = project.path.replace(/\/+$/, "");
  const marked = all.map((wt) => ({
    ...wt,
    isMain: wt.path.replace(/\/+$/, "") === normalizedProject,
  }));

  return NextResponse.json({
    projectPath: project.path,
    worktrees: marked,
  });
}
