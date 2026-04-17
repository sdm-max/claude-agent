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

export const appliedTemplates = sqliteTable("applied_templates", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),                  // "global" | "user" | "project" | "local"
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),       // 예: "security-basic"
  templateName: text("template_name").notNull(),   // 캐시된 nameKo
  deltaJson: text("delta_json").notNull(),         // template.settings 원본 (머지 결과 아님)
  extraFiles: text("extra_files"),                 // JSON array of TemplateFile[]
  appliedAt: integer("applied_at", { mode: "number" }).notNull(),
  isActive: integer("is_active", { mode: "number" }).notNull().default(1),  // 0 = undone
});
