import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_CONNECTION_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

// Auto-migrate: create tables if they don't exist
const migrationStatements = [
  `CREATE TABLE IF NOT EXISTS \`media_items\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`tmdb_id\` integer NOT NULL,
    \`media_type\` text NOT NULL,
    \`title\` text NOT NULL,
    \`original_title\` text,
    \`overview\` text,
    \`poster_path\` text,
    \`backdrop_path\` text,
    \`release_date\` text,
    \`vote_average\` real,
    \`genres\` text,
    \`status\` text DEFAULT 'planned' NOT NULL,
    \`rating\` integer,
    \`notes\` text,
    \`play_url\` text,
    \`sort_order\` integer DEFAULT 0,
    \`is_visible\` integer DEFAULT true,
    \`created_at\` text DEFAULT (datetime('now')),
    \`updated_at\` text DEFAULT (datetime('now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`media_items_tmdb_id_unique\` ON \`media_items\` (\`tmdb_id\`)`,
  `CREATE TABLE IF NOT EXISTS \`tags\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`color\` text DEFAULT '#6366f1',
    \`sort_order\` integer DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`tags_slug_unique\` ON \`tags\` (\`slug\`)`,
  `CREATE TABLE IF NOT EXISTS \`media_tags\` (
    \`media_item_id\` integer NOT NULL,
    \`tag_id\` integer NOT NULL,
    PRIMARY KEY(\`media_item_id\`, \`tag_id\`),
    FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE TABLE IF NOT EXISTS \`movie_progress\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`media_item_id\` integer NOT NULL,
    \`watched\` integer DEFAULT false,
    \`watched_at\` text,
    \`updated_at\` text DEFAULT (datetime('now')),
    FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`movie_progress_media_item_id_unique\` ON \`movie_progress\` (\`media_item_id\`)`,
  `CREATE TABLE IF NOT EXISTS \`tv_progress\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`media_item_id\` integer NOT NULL,
    \`current_season\` integer DEFAULT 1,
    \`current_episode\` integer DEFAULT 0,
    \`total_seasons\` integer,
    \`season_details\` text,
    \`updated_at\` text DEFAULT (datetime('now')),
    FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS \`tv_progress_media_item_id_unique\` ON \`tv_progress\` (\`media_item_id\`)`,
  `CREATE TABLE IF NOT EXISTS \`site_config\` (
    \`key\` text PRIMARY KEY NOT NULL,
    \`value\` text,
    \`updated_at\` text DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS \`progress_history\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`media_item_id\` integer NOT NULL,
    \`action\` text NOT NULL,
    \`detail\` text,
    \`created_at\` text DEFAULT (datetime('now')),
    FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`,
  // Add origin_country column if missing
  `ALTER TABLE \`media_items\` ADD COLUMN \`origin_country\` text`,
];

let migrated = false;

export async function ensureMigrated() {
  if (migrated) return;
  for (const sql of migrationStatements) {
    try {
      await client.execute(sql);
    } catch (e: unknown) {
      // Ignore "duplicate column" errors from ALTER TABLE
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("duplicate column")) throw e;
    }
  }
  migrated = true;
}

// Run migration eagerly on module load
ensureMigrated().catch(console.error);
