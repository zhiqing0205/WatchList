"use server";

import { db, ensureMigrated } from "@/db";
import { mediaItems, tvProgress, movieProgress, mediaTags, tags } from "@/db/schema";
import { eq, desc, asc, sql, and, like } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { TmdbMediaDetails } from "@/lib/tmdb";

export async function addMediaFromTmdb(
  details: TmdbMediaDetails,
  mediaType: "movie" | "tv"
) {
  await ensureMigrated();
  const title = details.title || details.name || "Unknown";
  const originalTitle = details.original_title || details.original_name;
  const releaseDate = details.release_date || details.first_air_date;
  const genres = JSON.stringify(details.genres.map((g) => g.name));

  const existing = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.tmdbId, details.id))
    .limit(1);

  if (existing.length > 0) {
    return { error: "该影视已在库中", id: existing[0].id };
  }

  const [inserted] = await db
    .insert(mediaItems)
    .values({
      tmdbId: details.id,
      mediaType,
      title,
      originalTitle,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate,
      voteAverage: details.vote_average,
      genres,
      status: "planned",
    })
    .returning();

  // Create progress record
  if (mediaType === "tv") {
    const seasonDetails = details.seasons
      ? JSON.stringify(
          details.seasons.map((s) => ({
            season_number: s.season_number,
            episode_count: s.episode_count,
            name: s.name,
          }))
        )
      : null;

    await db.insert(tvProgress).values({
      mediaItemId: inserted.id,
      totalSeasons: details.number_of_seasons || 1,
      seasonDetails,
    });
  } else {
    await db.insert(movieProgress).values({
      mediaItemId: inserted.id,
    });
  }

  revalidatePath("/admin/library");
  revalidatePath("/media");
  return { success: true, id: inserted.id };
}

export async function getMediaItems(options?: {
  status?: string;
  mediaType?: string;
  search?: string;
  page?: number;
  limit?: number;
  visibleOnly?: boolean;
}) {
  await ensureMigrated();
  const {
    status,
    mediaType,
    search,
    page = 1,
    limit = 20,
    visibleOnly = false,
  } = options || {};

  const conditions = [];
  if (status) conditions.push(eq(mediaItems.status, status as "watching" | "completed" | "planned" | "dropped" | "on_hold"));
  if (mediaType) conditions.push(eq(mediaItems.mediaType, mediaType as "movie" | "tv"));
  if (search) conditions.push(like(mediaItems.title, `%${search}%`));
  if (visibleOnly) conditions.push(eq(mediaItems.isVisible, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(mediaItems)
      .where(where)
      .orderBy(desc(mediaItems.updatedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(mediaItems)
      .where(where),
  ]);

  return {
    items,
    total: countResult[0].count,
    totalPages: Math.ceil(countResult[0].count / limit),
  };
}

export async function getMediaItemById(id: number) {
  await ensureMigrated();
  const [item] = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.id, id))
    .limit(1);

  if (!item) return null;

  let progress = null;
  if (item.mediaType === "tv") {
    const [p] = await db
      .select()
      .from(tvProgress)
      .where(eq(tvProgress.mediaItemId, id))
      .limit(1);
    progress = p || null;
  } else {
    const [p] = await db
      .select()
      .from(movieProgress)
      .where(eq(movieProgress.mediaItemId, id))
      .limit(1);
    progress = p || null;
  }

  const itemTags = await db
    .select({ tag: tags })
    .from(mediaTags)
    .innerJoin(tags, eq(mediaTags.tagId, tags.id))
    .where(eq(mediaTags.mediaItemId, id));

  return {
    ...item,
    progress,
    tags: itemTags.map((t) => t.tag),
  };
}

export async function updateMediaItem(
  id: number,
  data: {
    status?: string;
    rating?: number | null;
    notes?: string | null;
    playUrl?: string | null;
    isVisible?: boolean;
    sortOrder?: number;
  }
) {
  await ensureMigrated();
  await db
    .update(mediaItems)
    .set({
      ...data,
      status: data.status as "watching" | "completed" | "planned" | "dropped" | "on_hold" | undefined,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(mediaItems.id, id));

  revalidatePath("/admin/library");
  revalidatePath(`/admin/library/${id}`);
  revalidatePath("/media");
  revalidatePath(`/media/${id}`);
}

export async function updateTvProgress(
  mediaItemId: number,
  data: { currentSeason: number; currentEpisode: number }
) {
  await ensureMigrated();
  await db
    .update(tvProgress)
    .set({
      currentSeason: data.currentSeason,
      currentEpisode: data.currentEpisode,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(tvProgress.mediaItemId, mediaItemId));

  await db
    .update(mediaItems)
    .set({ updatedAt: sql`datetime('now')` })
    .where(eq(mediaItems.id, mediaItemId));

  revalidatePath("/admin/library");
  revalidatePath(`/admin/library/${mediaItemId}`);
  revalidatePath("/media");
  revalidatePath(`/media/${mediaItemId}`);
}

export async function updateMovieProgress(
  mediaItemId: number,
  watched: boolean
) {
  await ensureMigrated();
  await db
    .update(movieProgress)
    .set({
      watched,
      watchedAt: watched ? sql`datetime('now')` : null,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(movieProgress.mediaItemId, mediaItemId));

  await db
    .update(mediaItems)
    .set({
      status: watched ? "completed" : "planned",
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(mediaItems.id, mediaItemId));

  revalidatePath("/admin/library");
  revalidatePath(`/admin/library/${mediaItemId}`);
  revalidatePath("/media");
}

export async function deleteMediaItem(id: number) {
  await ensureMigrated();
  await db.delete(mediaItems).where(eq(mediaItems.id, id));
  revalidatePath("/admin/library");
  revalidatePath("/media");
}

export async function setMediaTags(mediaItemId: number, tagIds: number[]) {
  await ensureMigrated();
  await db.delete(mediaTags).where(eq(mediaTags.mediaItemId, mediaItemId));

  if (tagIds.length > 0) {
    await db.insert(mediaTags).values(
      tagIds.map((tagId) => ({ mediaItemId, tagId }))
    );
  }

  revalidatePath("/admin/library");
  revalidatePath(`/admin/library/${mediaItemId}`);
  revalidatePath("/media");
}

// Tags CRUD
export async function getAllTags() {
  await ensureMigrated();
  return db.select().from(tags).orderBy(asc(tags.sortOrder), asc(tags.name));
}

export async function createTag(data: { name: string; slug: string; color: string }) {
  await ensureMigrated();
  const [tag] = await db.insert(tags).values(data).returning();
  revalidatePath("/admin/tags");
  return tag;
}

export async function updateTag(id: number, data: { name?: string; slug?: string; color?: string; sortOrder?: number }) {
  await ensureMigrated();
  await db.update(tags).set(data).where(eq(tags.id, id));
  revalidatePath("/admin/tags");
}

export async function deleteTag(id: number) {
  await ensureMigrated();
  await db.delete(tags).where(eq(tags.id, id));
  revalidatePath("/admin/tags");
}

// Site config
export async function getSiteConfig() {
  await ensureMigrated();
  const { siteConfig } = await import("@/db/schema");
  const rows = await db.select().from(siteConfig);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getConfigValue(key: string) {
  await ensureMigrated();
  const { siteConfig } = await import("@/db/schema");
  const [row] = await db
    .select()
    .from(siteConfig)
    .where(eq(siteConfig.key, key))
    .limit(1);
  return row?.value || null;
}

export async function setConfigValue(key: string, value: string) {
  await ensureMigrated();
  const { siteConfig } = await import("@/db/schema");
  await db
    .insert(siteConfig)
    .values({ key, value, updatedAt: sql`datetime('now')` })
    .onConflictDoUpdate({
      target: siteConfig.key,
      set: { value, updatedAt: sql`datetime('now')` },
    });
  revalidatePath("/admin/settings");
}

// Dashboard stats
export async function getDashboardStats() {
  await ensureMigrated();
  const [totalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaItems);

  const statusCounts = await db
    .select({
      status: mediaItems.status,
      count: sql<number>`count(*)`,
    })
    .from(mediaItems)
    .groupBy(mediaItems.status);

  const typeCounts = await db
    .select({
      mediaType: mediaItems.mediaType,
      count: sql<number>`count(*)`,
    })
    .from(mediaItems)
    .groupBy(mediaItems.mediaType);

  const recentItems = await db
    .select()
    .from(mediaItems)
    .orderBy(desc(mediaItems.updatedAt))
    .limit(5);

  return {
    total: totalCount.count,
    byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
    byType: Object.fromEntries(typeCounts.map((t) => [t.mediaType, t.count])),
    recent: recentItems,
  };
}

// Get media items by tag
export async function getMediaByTag(tagSlug: string, page = 1, limit = 20) {
  await ensureMigrated();
  const [tag] = await db
    .select()
    .from(tags)
    .where(eq(tags.slug, tagSlug))
    .limit(1);

  if (!tag) return { items: [], total: 0, totalPages: 0, tag: null };

  const items = await db
    .select({ mediaItem: mediaItems })
    .from(mediaTags)
    .innerJoin(mediaItems, eq(mediaTags.mediaItemId, mediaItems.id))
    .where(and(eq(mediaTags.tagId, tag.id), eq(mediaItems.isVisible, true)))
    .orderBy(desc(mediaItems.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaTags)
    .innerJoin(mediaItems, eq(mediaTags.mediaItemId, mediaItems.id))
    .where(and(eq(mediaTags.tagId, tag.id), eq(mediaItems.isVisible, true)));

  return {
    items: items.map((i) => i.mediaItem),
    total: countResult.count,
    totalPages: Math.ceil(countResult.count / limit),
    tag,
  };
}
