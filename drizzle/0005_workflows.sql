CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ko` text,
	`description` text,
	`description_ko` text,
	`scope` text NOT NULL,
	`project_id` text,
	`items` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workflows_scope` ON `workflows` (`scope`);
--> statement-breakpoint
CREATE INDEX `idx_workflows_project` ON `workflows` (`project_id`);
--> statement-breakpoint
ALTER TABLE `applied_templates` ADD COLUMN `workflow_id` text;
--> statement-breakpoint
CREATE INDEX `idx_applied_templates_workflow` ON `applied_templates` (`workflow_id`);
