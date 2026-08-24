ALTER TABLE `steps` ADD `title` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `steps` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `steps` SET `title` = `element_label`, `description` = `element_label`;--> statement-breakpoint
ALTER TABLE `walkthroughs` ADD `cta_url` text;
