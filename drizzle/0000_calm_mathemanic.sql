CREATE TABLE `migration_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`claimed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`due_time` text,
	`estimate_minutes` integer,
	`priority` integer DEFAULT 2 NOT NULL,
	`parent_id` text,
	`completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`in_progress` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
