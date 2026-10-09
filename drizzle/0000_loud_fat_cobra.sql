CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`vacancy_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`vacancy_id`) REFERENCES `vacancies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_unique_idx` ON `applications` (`vacancy_id`,`candidate_id`);--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_window_idx` ON `auth_attempts` (`key`,`created_at`);--> statement-breakpoint
CREATE TABLE `demands` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`specialization` text NOT NULL,
	`grade` text NOT NULL,
	`skills` text NOT NULL,
	`must_have` text NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`salary_from` integer,
	`salary_to` integer,
	`original_json` text,
	`algorithm_version` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `demand_employer_idx` ON `demands` (`employer_id`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`candidate_id` text NOT NULL,
	`demand_id` text,
	`salary_from` integer NOT NULL,
	`salary_to` integer NOT NULL,
	`description` text NOT NULL,
	`contact_method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`employer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`demand_id`) REFERENCES `demands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `invite_candidate_idx` ON `invitations` (`candidate_id`);--> statement-breakpoint
CREATE INDEX `invite_employer_idx` ON `invitations` (`employer_id`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`experience_years` real DEFAULT 0 NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`specialization` text DEFAULT 'backend' NOT NULL,
	`claimed_grade` text DEFAULT 'junior' NOT NULL,
	`verified_grade` text,
	`demonstrated_skills` text DEFAULT '[]' NOT NULL,
	`test_score` real DEFAULT 0 NOT NULL,
	`last_verified_at` text,
	`is_public` integer DEFAULT 0 NOT NULL,
	`consent_publication` integer DEFAULT 0 NOT NULL,
	`fsp_id` text,
	`fsp_verified` integer DEFAULT 0 NOT NULL,
	`achievements` text DEFAULT '[]' NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`contact_method` text DEFAULT 'Email' NOT NULL,
	`is_synthetic` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `profiles_category_idx` ON `profiles` (`specialization`,`verified_grade`,`is_public`);--> statement-breakpoint
CREATE TABLE `seed_state` (
	`key` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `test_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`specialization` text NOT NULL,
	`grade` text NOT NULL,
	`exam_json` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`result_json` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `test_user_idx` ON `test_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`role` text NOT NULL,
	`email_verified` integer DEFAULT 0 NOT NULL,
	`consent_processing` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` text PRIMARY KEY NOT NULL,
	`demand_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`demand_id`) REFERENCES `demands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vacancies_demand_id_unique` ON `vacancies` (`demand_id`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`demo_token` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
