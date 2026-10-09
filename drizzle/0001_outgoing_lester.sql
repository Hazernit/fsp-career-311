CREATE TABLE `demo_pairs` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`candidate_id` text,
	`employer_id` text,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`candidate_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `active_test_user_idx` ON `test_attempts` (`user_id`) WHERE "test_attempts"."submitted_at" IS NULL;