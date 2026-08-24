CREATE TABLE `completion_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`walkthrough_id` text NOT NULL,
	FOREIGN KEY (`walkthrough_id`) REFERENCES `walkthroughs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `walkthroughs` ADD `views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `walkthroughs` ADD `completions` integer DEFAULT 0 NOT NULL;