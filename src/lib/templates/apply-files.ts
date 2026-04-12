import { getDb } from "@/lib/db";
import { files, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { TemplateFile } from "@/lib/templates";

/**
 * Save template extraFiles (CLAUDE.md, etc.) to the project's files table.
 * Finds the project by path, then upserts claude-md type files.
 * Returns the list of saved file paths.
 */
export function applyExtraFilesToProject(
  projectPath: string,
  extraFiles: TemplateFile[]
): string[] {
  if (!extraFiles || extraFiles.length === 0) return [];

  const db = getDb();
  const now = Date.now();

  // Find project by path
  const project = db
    .select()
    .from(projects)
    .where(eq(projects.path, projectPath))
    .get();

  if (!project) return [];

  const savedPaths: string[] = [];

  for (const ef of extraFiles) {
    // Only auto-apply CLAUDE.md files to DB
    if (!ef.path.endsWith(".md") || !ef.path.toLowerCase().includes("claude")) {
      continue;
    }

    const scope = ef.path.includes(".local") ? "local" : "project";

    // Check if file already exists
    const existing = db
      .select()
      .from(files)
      .where(
        and(
          eq(files.projectId, project.id),
          eq(files.type, "claude-md"),
          eq(files.scope, scope)
        )
      )
      .get();

    if (existing) {
      db.update(files)
        .set({ content: ef.content, updatedAt: now })
        .where(eq(files.id, existing.id))
        .run();
    } else {
      db.insert(files)
        .values({
          id: nanoid(),
          projectId: project.id,
          type: "claude-md",
          scope,
          content: ef.content,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    savedPaths.push(ef.path);
  }

  return savedPaths;
}
