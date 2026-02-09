import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const mediaItems = sqliteTable("media_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tmdbId: integer("tmdb_id").unique().notNull(),
  mediaType: text("media_type", { enum: ["movie", "tv"] }).notNull(),
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  overview: text("overview"),
  posterPath: text("poster_path"),
  backdropPath: text("backdrop_path"),
  releaseDate: text("release_date"),
  voteAverage: real("vote_average"),
  genres: text("genres"), // JSON string
  status: text("status", {
    enum: ["watching", "completed", "planned", "dropped", "on_hold"],
  })
    .notNull()
    .default("planned"),
  rating: integer("rating"), // 1-10
  notes: text("notes"),
  playUrl: text("play_url"),
  sortOrder: integer("sort_order").default(0),
  isVisible: integer("is_visible", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const tvProgress = sqliteTable("tv_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mediaItemId: integer("media_item_id")
    .references(() => mediaItems.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  currentSeason: integer("current_season").default(1),
  currentEpisode: integer("current_episode").default(0),
  totalSeasons: integer("total_seasons"),
  seasonDetails: text("season_details"), // JSON string
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const movieProgress = sqliteTable("movie_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mediaItemId: integer("media_item_id")
    .references(() => mediaItems.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  watched: integer("watched", { mode: "boolean" }).default(false),
  watchedAt: text("watched_at"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").default("#6366f1"),
  sortOrder: integer("sort_order").default(0),
});

export const mediaTags = sqliteTable(
  "media_tags",
  {
    mediaItemId: integer("media_item_id")
      .references(() => mediaItems.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mediaItemId, table.tagId] }),
  ]
);

export const siteConfig = sqliteTable("site_config", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// Types
export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
export type TvProgress = typeof tvProgress.$inferSelect;
export type MovieProgress = typeof movieProgress.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type MediaTag = typeof mediaTags.$inferSelect;
export type SiteConfig = typeof siteConfig.$inferSelect;
