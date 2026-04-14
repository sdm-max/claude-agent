-- Drop legacy DB-cached file/settings tables. The app reads/writes
-- these directly from disk now; only file_versions (snapshots) and
-- projects (registry) remain.
DROP TABLE IF EXISTS `files`;--> statement-breakpoint
DROP TABLE IF EXISTS `settings`;
