CREATE TABLE `questionnaire_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`industry` text NOT NULL,
	`specialization` text NOT NULL,
	`claimed_grade` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questionnaire_user_idx` ON `questionnaire_attempts` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `applications` ADD `status` text DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `applications` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `roles` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `soft_skills` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `test_attempts` ADD `questionnaire_id` text REFERENCES questionnaire_attempts(id);
--> statement-breakpoint
-- Preserve the chronology and existing role label of records created before this release.
UPDATE `applications` SET `updated_at` = `created_at` WHERE `updated_at` = '';
--> statement-breakpoint
UPDATE `profiles` SET `roles` = json_array(`title`)
WHERE trim(`title`) <> '' AND `id` IN (SELECT `id` FROM `users` WHERE `role` = 'candidate');
