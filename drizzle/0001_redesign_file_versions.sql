-- Redesign file_versions to key snapshots by (project_id, relative_path)
-- instead of file_id. Prepares for dropping the `files` table in a later
-- migration. Backfills existing rows by looking up the owning `files` row.

CREATE TABLE `file_versions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`relative_path` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `file_versions_new` (id, project_id, relative_path, content, created_at)
SELECT
	fv.id,
	CASE
		WHEN f.scope IN ('user', 'global') THEN NULL
		ELSE f.project_id
	END AS project_id,
	CASE
		WHEN f.type = 'claude-md' AND f.scope = 'user' THEN '~/.claude/CLAUDE.md'
		WHEN f.type = 'claude-md' AND f.scope = 'project' THEN 'CLAUDE.md'
		WHEN f.type = 'claude-md' AND f.scope = 'local' THEN 'CLAUDE.local.md'
		WHEN f.type = 'settings' AND f.scope = 'user' THEN '~/.claude/settings.json'
		WHEN f.type = 'settings' AND f.scope = 'global' THEN '~/.claude/managed-settings.json'
		WHEN f.type = 'settings' AND f.scope = 'project' THEN '.claude/settings.json'
		WHEN f.type = 'settings' AND f.scope = 'local' THEN '.claude/settings.local.json'
		ELSE f.type || '/' || f.scope
	END AS relative_path,
	fv.content,
	fv.created_at
FROM `file_versions` fv
JOIN `files` f ON f.id = fv.file_id;
--> statement-breakpoint
DROP TABLE `file_versions`;
--> statement-breakpoint
ALTER TABLE `file_versions_new` RENAME TO `file_versions`;
--> statement-breakpoint
CREATE INDEX `idx_file_versions_lookup` ON `file_versions` (`project_id`,`relative_path`,`created_at`);
