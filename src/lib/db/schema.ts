import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  description: text("description").default(""),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
  updatedAt: integer("updated_at", { mode: "number" }).notNull(),
});

// file_versions holds pre-write snapshots keyed by (projectId, relativePath).
// projectId is NULL for home-scoped files (~/.claude/*). relativePath is the
// path relative to the project root, or a "~" prefixed form for home scope.
export const fileVersions = sqliteTable("file_versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "number" }).notNull(),
});
