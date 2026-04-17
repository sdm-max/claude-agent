CREATE TABLE `applied_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `scope` text NOT NULL,
  `project_id` text,
  `template_id` text NOT NULL,
  `template_name` text NOT NULL,
  `delta_json` text NOT NULL,
  `extra_files` text,
  `applied_at` integer NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_applied_active` ON `applied_templates` (`scope`, `project_id`, `is_active`);
