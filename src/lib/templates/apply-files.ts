import path from "path";
import { getDb } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeDiskWithSnapshot, type ResolvedPath } from "@/lib/disk-files";
import type { TemplateFile } from "@/lib/templates";

/**
 * Write template extraFiles (CLAUDE.md, etc.) directly to disk under the
 * given project path. Each file is snapshotted into file_versions before
 * being overwritten. Returns the list of relative paths that were written.
 */
export function applyExtraFilesToProject(
  projectPath: string,
  extraFiles: TemplateFile[],
): string[] {
  if (!extraFiles || extraFiles.length === 0) return [];

  const db = getDb();
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.path, projectPath))
    .get();

  const projectId = project?.id ?? null;
  const written: string[] = [];

  for (const ef of extraFiles) {
    if (!ef.path.endsWith(".md") || !ef.path.toLowerCase().includes("claude")) {
      continue;
    }
    const target: ResolvedPath = {
      absolutePath: path.join(projectPath, ef.path),
      relativePath: ef.path,
      projectId,
    };
    writeDiskWithSnapshot(target, ef.content);
    written.push(ef.path);
  }

  return written;
}
