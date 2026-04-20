import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

type SyncAction = "copy-to-worktree" | "copy-to-master" | "skip";

interface SyncRequest {
  worktree?: string;
  files?: Array<{ name?: string; action?: SyncAction }>;
}

interface SyncError {
  file: string;
  error: string;
}

function rulesDir(root: string): string {
  return path.join(root, ".claude", "rules");
}

/** Reject names that could escape the rules directory. */
function isSafeRuleName(name: string): boolean {
  if (!name || !name.endsWith(".md")) return false;
  if (name.startsWith("/") || name.startsWith("\\")) return false;
  if (name.includes("..")) return false;
  if (name.includes("\0")) return false;
  const segments = name.split("/");
  for (const seg of segments) {
    if (!seg || seg === "." || seg === "..") return false;
  }
  return true;
}

function readSafe(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function writeSafe(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}

// POST /api/projects/[id]/worktrees/rules-sync
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as SyncRequest;
  const worktreePath = body.worktree;
  const entries = Array.isArray(body.files) ? body.files : [];

  if (!worktreePath || !path.isAbsolute(worktreePath)) {
    return NextResponse.json(
      { error: "worktree (absolute path) is required" },
      { status: 400 },
    );
  }

  const db = getDb();
  const project = db.select().from(projects).where(eq(projects.id, id)).get();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (worktreePath.replace(/\/+$/, "") === project.path.replace(/\/+$/, "")) {
    return NextResponse.json(
      { error: "worktree path must differ from the master project path" },
      { status: 400 },
    );
  }

  let allowedWorktrees: Set<string>;
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: project.path,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    });
    const paths = output.split(/\n\s*\n/).flatMap((block) => {
      const line = block.split("\n").find((l) => l.startsWith("worktree "));
      return line
        ? [line.slice("worktree ".length).trim().replace(/\/+$/, "")]
        : [];
    });
    allowedWorktrees = new Set(paths);
    allowedWorktrees.add(project.path.replace(/\/+$/, ""));
  } catch {
    // git failed — master-only mode: only project.path counts.
    allowedWorktrees = new Set([project.path.replace(/\/+$/, "")]);
  }

  const normalizedIncoming = worktreePath.replace(/\/+$/, "");
  if (!allowedWorktrees.has(normalizedIncoming)) {
    return NextResponse.json(
      {
        error: "worktree_not_recognized",
        detail: "worktree must be one of the project's git worktrees",
      },
      { status: 400 },
    );
  }

  const masterRules = rulesDir(project.path);
  const worktreeRules = rulesDir(worktreePath);

  let applied = 0;
  const errors: SyncError[] = [];

  for (const entry of entries) {
    const name = entry.name;
    const action = entry.action;
    if (!name || !isSafeRuleName(name)) {
      errors.push({ file: String(name ?? ""), error: "invalid file name" });
      continue;
    }
    if (action === "skip" || action === undefined) continue;
    if (action !== "copy-to-worktree" && action !== "copy-to-master") {
      errors.push({ file: name, error: `unknown action: ${action}` });
      continue;
    }

    const masterAbs = path.join(masterRules, name);
    const worktreeAbs = path.join(worktreeRules, name);

    // Path-escape guard (defence in depth, on top of isSafeRuleName)
    if (
      !masterAbs.startsWith(masterRules + path.sep) ||
      !worktreeAbs.startsWith(worktreeRules + path.sep)
    ) {
      errors.push({ file: name, error: "resolved path escapes rules dir" });
      continue;
    }

    try {
      if (action === "copy-to-worktree") {
        const masterContent = readSafe(masterAbs);
        if (masterContent === null) {
          errors.push({ file: name, error: "master file missing" });
          continue;
        }
        const existing = readSafe(worktreeAbs);
        if (existing === masterContent) continue; // no-op
        writeSafe(worktreeAbs, masterContent);
        applied += 1;
      } else {
        const worktreeContent = readSafe(worktreeAbs);
        if (worktreeContent === null) {
          errors.push({ file: name, error: "worktree file missing" });
          continue;
        }
        const existing = readSafe(masterAbs);
        if (existing === worktreeContent) continue; // no-op
        writeSafe(masterAbs, worktreeContent);
        applied += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ file: name, error: msg });
    }
  }

  return NextResponse.json({ applied, errors });
}
