CREATE TABLE `steps` (
	`id` text PRIMARY KEY NOT NULL,
	`walkthrough_id` text NOT NULL,
	`capture_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`screenshot_file` text NOT NULL,
	`page_url` text NOT NULL,
	`element_label` text NOT NULL,
	`click_x` real NOT NULL,
	`click_y` real NOT NULL,
	`viewport_width` integer NOT NULL,
	`viewport_height` integer NOT NULL,
	`rect_x` real NOT NULL,
	`rect_y` real NOT NULL,
	`rect_width` real NOT NULL,
	`rect_height` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`walkthrough_id`) REFERENCES `walkthroughs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `steps_capture_unique` ON `steps` (`walkthrough_id`,`capture_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `steps_sequence_unique` ON `steps` (`walkthrough_id`,`sequence`);