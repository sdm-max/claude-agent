import fs from "fs";
import path from "path";
import os from "os";
import type { TemplateFile } from "@/lib/templates";

export type ExtraFile = TemplateFile;

/**
 * Mirror of apply-files.ts path guards:
 *  - reject `..` segments
 *  - reject absolute paths
 *  - `~/` → `os.homedir()` join
 *  - otherwise → `basePath` join
 *
 * Returns absolute path, or `null` when the input violates guards
 * (caller should silently skip).
 */
export function resolveSafePath(basePath: string, rawPath: string): string | null {
  if (!rawPath || typeof rawPath !== "string") return null;
  if (rawPath.includes("..")) return null;
  if (path.isAbsolute(rawPath)) return null;

  if (rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }
  return path.join(basePath, rawPath);
}

/**
 * Parse applied_templates.extraFiles JSON column.
 * null / malformed → empty array (silent, see D-5 AC #1).
 */
export function parseExtraFilesColumn(raw: string | null | undefined): ExtraFile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ExtraFile[];
  } catch {
    return [];
  }
}

/**
 * Build a Set of resolved absolute paths from a list of other active
 * applied_templates rows' extraFiles columns. Used to detect shared
 * paths that must NOT be unlinked during undo.
 */
export function collectSharedResolvedPaths(
  basePath: string,
  otherExtraFilesColumns: (string | null | undefined)[],
): Set<string> {
  const shared = new Set<string>();
  for (const col of otherExtraFilesColumns) {
    const files = parseExtraFilesColumn(col);
    for (const f of files) {
      const abs = resolveSafePath(basePath, f.path);
      if (abs) shared.add(abs);
    }
  }
  return shared;
}

export interface UndoFilesResult {
  removedFiles: string[];
  keptSharedFiles: string[];
  errors: { path: string; error: string }[];
}

/**
 * Unlink each of `targetFiles` whose resolved absolute path is NOT in
 * `sharedResolved`. Path guard violations are silently skipped (not
 * reported as errors). All `fs.unlinkSync` errors (including ENOENT)
 * are collected into `errors[]`; partial failures never throw.
 *
 * If `snapshot` callback is supplied, it is invoked with (absPath,
 * currentContent) BEFORE unlink so the caller can persist a
 * `file_versions` row for re-apply restoration.
 */
export function undoExtraFiles(
  basePath: string,
  targetFiles: ExtraFile[],
  sharedResolved: Set<string>,
  snapshot?: (absPath: string, relPath: string, content: string) => void,
): UndoFilesResult {
  const removedFiles: string[] = [];
  const keptSharedFiles: string[] = [];
  const errors: { path: string; error: string }[] = [];

  for (const ef of targetFiles) {
    const abs = resolveSafePath(basePath, ef.path);
    if (!abs) {
      // guard violation → silent skip (per AC #4 in D-5.2)
      continue;
    }

    if (sharedResolved.has(abs)) {
      keptSharedFiles.push(ef.path);
      continue;
    }

    // Pre-unlink snapshot for re-apply restoration.
    if (snapshot) {
      try {
        const existing = fs.readFileSync(abs, "utf-8");
        snapshot(abs, ef.path, existing);
      } catch {
        // unreadable (ENOENT / EACCES) → skip snapshot, continue to unlink attempt
      }
    }

    try {
      fs.unlinkSync(abs);
      removedFiles.push(ef.path);
    } catch (e) {
      errors.push({
        path: ef.path,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { removedFiles, keptSharedFiles, errors };
}
