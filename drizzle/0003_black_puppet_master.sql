CREATE TABLE `reminder_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`lead_minutes` integer NOT NULL,
	`updated_at` text NOT NULL
);
