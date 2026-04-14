import fs from "fs";
import path from "path";
import os from "os";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";
import { fileVersions } from "@/lib/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────
// disk-files — single source of truth for reading/writing Claude config
// files on disk, with automatic pre-write version snapshots into the
// `file_versions` table keyed by (projectId, relativePath).
//
// projectId is NULL for home-scoped files (~/.claude/*). relativePath is
// the canonical string used as the version key:
//   - project/local: path.relative(projectPath, absolutePath)
//   - home: "~/.claude/<filename>"
// ────────────────────────────────────────────────────────────────────────

const HOME = os.homedir();

export type FileScope = "global" | "user" | "project" | "local";
export type FileKind = "claude-md" | "settings";

export interface ResolvedPath {
  absolutePath: string;
  /** Canonical key for version history. null projectId implies home scope. */
  relativePath: string;
  projectId: string | null;
}

// ── Path resolvers ──────────────────────────────────────────────────────

/**
 * Resolve the on-disk path for a CLAUDE.md file at a given scope.
 * - global / user: ~/.claude/CLAUDE.md
 *   (both map to the same physical path; Claude Code has one user-level
 *   memory file, but we keep "global" as an alias for UI symmetry)
 * - project: <projectPath>/CLAUDE.md
 * - local:   <projectPath>/CLAUDE.local.md
 */
export function resolveMemoryPath(
  scope: FileScope,
  params: { projectId?: string | null; projectPath?: string | null } = {},
): ResolvedPath {
  if (scope === "global" || scope === "user") {
    return {
      absolutePath: path.join(HOME, ".claude", "CLAUDE.md"),
      relativePath: "~/.claude/CLAUDE.md",
      projectId: null,
    };
  }
  if (!params.projectPath || !params.projectId) {
    throw new Error(`resolveMemoryPath(${scope}) requires projectPath + projectId`);
  }
  if (scope === "local") {
    return {
      absolutePath: path.join(params.projectPath, "CLAUDE.local.md"),
      relativePath: "CLAUDE.local.md",
      projectId: params.projectId,
    };
  }
  // project scope
  return {
    absolutePath: path.join(params.projectPath, "CLAUDE.md"),
    relativePath: "CLAUDE.md",
    projectId: params.projectId,
  };
}

/**
 * Resolve the on-disk path for a settings.json file at a given scope.
 * - global: ~/.claude/managed-settings.json (enterprise/managed)
 * - user:   ~/.claude/settings.json
 * - project: <projectPath>/.claude/settings.json
 * - local:   <projectPath>/.claude/settings.local.json
 */
export function resolveSettingsPath(
  scope: FileScope,
  params: { projectId?: string | null; projectPath?: string | null } = {},
): ResolvedPath {
  if (scope === "global") {
    return {
      absolutePath: path.join(HOME, ".claude", "managed-settings.json"),
      relativePath: "~/.claude/managed-settings.json",
      projectId: null,
    };
  }
  if (scope === "user") {
    return {
      absolutePath: path.join(HOME, ".claude", "settings.json"),
      relativePath: "~/.claude/settings.json",
      projectId: null,
    };
  }
  if (!params.projectPath || !params.projectId) {
    throw new Error(`resolveSettingsPath(${scope}) requires projectPath + projectId`);
  }
  if (scope === "local") {
    return {
      absolutePath: path.join(params.projectPath, ".claude", "settings.local.json"),
      relativePath: ".claude/settings.local.json",
      projectId: params.projectId,
    };
  }
  return {
    absolutePath: path.join(params.projectPath, ".claude", "settings.json"),
    relativePath: ".claude/settings.json",
    projectId: params.projectId,
  };
}

// ── Read / write ────────────────────────────────────────────────────────

export function readDisk(absolutePath: string): string | null {
  try {
    return fs.readFileSync(absolutePath, "utf-8");
  } catch {
    return null;
  }
}

export function diskExists(absolutePath: string): boolean {
  try {
    fs.accessSync(absolutePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write a file, snapshotting the previous content into file_versions first
 * if the file already existed. If the content is unchanged, no snapshot is
 * recorded.
 */
export function writeDiskWithSnapshot(
  target: ResolvedPath,
  content: string,
): { snapshotRecorded: boolean } {
  const { absolutePath, relativePath, projectId } = target;

  // Read existing for snapshot
  const existing = readDisk(absolutePath);
  let snapshotRecorded = false;

  if (existing !== null && existing !== content) {
    const db = getDb();
    db.insert(fileVersions)
      .values({
        id: nanoid(),
        projectId: projectId ?? null,
        relativePath,
        content: existing,
        createdAt: Date.now(),
      })
      .run();
    snapshotRecorded = true;
  }

  // Ensure parent dir exists
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(absolutePath, content, "utf-8");

  return { snapshotRecorded };
}

// ── Version history ─────────────────────────────────────────────────────

export interface VersionRow {
  id: string;
  projectId: string | null;
  relativePath: string;
  content: string;
  createdAt: number;
}

export function listVersions(
  projectId: string | null,
  relativePath: string,
): VersionRow[] {
  const db = getDb();
  const conditions = projectId
    ? and(eq(fileVersions.projectId, projectId), eq(fileVersions.relativePath, relativePath))
    : and(isNull(fileVersions.projectId), eq(fileVersions.relativePath, relativePath));

  return db
    .select()
    .from(fileVersions)
    .where(conditions)
    .orderBy(desc(fileVersions.createdAt))
    .all() as VersionRow[];
}

// ── Project scan ────────────────────────────────────────────────────────

export interface ScannedFile {
  type: "claude-md" | "settings";
  scope: "project" | "local";
  relativePath: string;
  absolutePath: string;
  updatedAt: number;
}

/**
 * Scan a project directory for canonical Claude config files (CLAUDE.md
 * variants and settings.json variants). Only files that exist on disk
 * are returned.
 */
export function scanProjectFiles(projectPath: string): ScannedFile[] {
  const candidates: Array<{ type: "claude-md" | "settings"; scope: "project" | "local"; rel: string }> = [
    { type: "claude-md", scope: "project", rel: "CLAUDE.md" },
    { type: "claude-md", scope: "local", rel: "CLAUDE.local.md" },
    { type: "claude-md", scope: "project", rel: ".claude/CLAUDE.md" },
    { type: "settings", scope: "project", rel: ".claude/settings.json" },
    { type: "settings", scope: "local", rel: ".claude/settings.local.json" },
  ];
  const out: ScannedFile[] = [];
  for (const c of candidates) {
    const abs = path.join(projectPath, c.rel);
    try {
      const stat = fs.statSync(abs);
      out.push({
        type: c.type,
        scope: c.scope,
        relativePath: c.rel,
        absolutePath: abs,
        updatedAt: stat.mtimeMs,
      });
    } catch {
      // missing — skip
    }
  }
  return out;
}

export function getVersion(versionId: string): VersionRow | null {
  const db = getDb();
  const row = db
    .select()
    .from(fileVersions)
    .where(eq(fileVersions.id, versionId))
    .get();
  return (row as VersionRow | undefined) ?? null;
}
