CREATE TABLE `custom_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_ko` text,
	`description` text DEFAULT '',
	`description_ko` text DEFAULT '',
	`category` text NOT NULL,
	`difficulty` integer NOT NULL DEFAULT 1,
	`scope` text NOT NULL DEFAULT 'project',
	`tags` text,
	`settings` text NOT NULL,
	`extra_files` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_custom_templates_category` ON `custom_templates` (`category`);
--> statement-breakpoint
CREATE INDEX `idx_custom_templates_updated` ON `custom_templates` (`updated_at`);
