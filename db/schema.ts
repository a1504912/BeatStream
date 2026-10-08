import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, index, check } from 'drizzle-orm/sqlite-core';

export const scores=sqliteTable('scores',{
 userId:text('user_id').notNull(),
 runId:text('run_id').notNull(),
 songId:text('song_id').notNull(),
 difficulty:text('difficulty').notNull(),
 score:integer('score').notNull(),
 maxCombo:integer('max_combo').notNull(),
 noteCount:integer('note_count').notNull(),
 playedAt:integer('played_at').notNull(),
},t=>[
 primaryKey({columns:[t.userId,t.runId]}),
 index('idx_scores_user_song_difficulty_best').on(t.userId,t.songId,t.difficulty,t.score,t.maxCombo,t.playedAt),
 check('scores_difficulty',sql`${t.difficulty} IN ('light','normal','hard')`),
 check('scores_points',sql`${t.score} BETWEEN 0 AND 1000000`),
 check('scores_combo',sql`${t.maxCombo} BETWEEN 0 AND ${t.noteCount}`),
 check('scores_notes',sql`${t.noteCount} BETWEEN 1 AND 10000`),
]);
