CREATE TABLE `scores` (
	`user_id` text NOT NULL,
	`run_id` text NOT NULL,
	`song_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`score` integer NOT NULL,
	`max_combo` integer NOT NULL,
	`note_count` integer NOT NULL,
	`played_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `run_id`),
	CONSTRAINT "scores_difficulty" CHECK("scores"."difficulty" IN ('light','normal','hard')),
	CONSTRAINT "scores_points" CHECK("scores"."score" BETWEEN 0 AND 1000000),
	CONSTRAINT "scores_combo" CHECK("scores"."max_combo" BETWEEN 0 AND "scores"."note_count"),
	CONSTRAINT "scores_notes" CHECK("scores"."note_count" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `idx_scores_user_song_difficulty_best` ON `scores` (`user_id`,`song_id`,`difficulty`,`score`,`max_combo`,`played_at`);