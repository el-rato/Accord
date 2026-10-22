CREATE TABLE `workspaces` (
	`session_hash` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
