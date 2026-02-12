"use server";

import { db, ensureMigrated } from "@/db";
import { mediaItems, tvProgress, movieProgress, mediaTags, tags, progressHistory, systemLogs } from "@/db/schema";
import { eq, desc, asc, sql, and, like, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { TmdbMediaDetails } from "@/lib/tmdb";

function revalidateAll(mediaItemId?: number) {
  revalidatePath("/admin/library");
  revalidatePath("/admin");
  revalidatePath("/");
  if (mediaItemId) {
    revalidatePath(`/admin/library/${mediaItemId}`);
    revalidatePath(`/${mediaItemId}`);
  }
}

async function recordHistory(mediaItemId: number, action: string, detail: Record<string, unknown>) {
  await db.insert(progressHistory).values({
    mediaItemId,
    action,
    detail: JSON.stringify(detail),
  });
}

export async function writeSystemLog(
  level: "info" | "warn" | "error",
  action: string,
  message: string,
  detail?: Record<string, unknown>
) {
  await ensureMigrated();
  await db.insert(systemLogs).values({
    level,
    action,
    message,
    detail: detail ? JSON.stringify(detail) : null,
  });
}

export async function addMediaFromTmdb(
  details: TmdbMediaDetails,
  mediaType: "movie" | "tv"
) {
  await ensureMigrated();
  const title = details.title || details.name || "Unknown";
  const originalTitle = details.original_title || details.original_name;
  const releaseDate = details.release_date || details.first_air_date;
  const genres = JSON.stringify(details.genres.map((g) => g.name));
  const originCountry = details.origin_country?.[0] || null;

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
      originCountry,
      status: "planned",
    })
    .returning();

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

  // Auto-create tags from TMDB genres
  if (details.genres && details.genres.length > 0) {
    const tagIds: number[] = [];
    for (const genre of details.genres) {
      const rawSlug = genre.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]/g, "");
      const slug = rawSlug || `genre-${genre.id}`;
      const existing_tag = await db
        .select()
        .from(tags)
        .where(eq(tags.slug, slug))
        .limit(1);

      if (existing_tag.length > 0) {
        tagIds.push(existing_tag[0].id);
      } else {
        const [newTag] = await db
          .insert(tags)
          .values({ name: genre.name, slug, color: "#6366f1" })
          .returning();
        tagIds.push(newTag.id);
      }
    }
    if (tagIds.length > 0) {
      await db.insert(mediaTags).values(
        tagIds.map((tagId) => ({ mediaItemId: inserted.id, tagId }))
      );
    }
  }

  await recordHistory(inserted.id, "added", { title, mediaType });
  await writeSystemLog("info", "media_added", `添加影视「${title}」`, { mediaType, tmdbId: details.id });

  revalidateAll();
  return { success: true, id: inserted.id };
}

// Get media items with their progress info for the library list
export async function getMediaItemsWithProgress(options?: {
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

  // Fetch progress for all items
  const itemIds = items.map((i) => i.id);
  const tvItems = items.filter((i) => i.mediaType === "tv").map((i) => i.id);
  const movieItems = items.filter((i) => i.mediaType === "movie").map((i) => i.id);

  let tvProgressMap: Record<number, { currentSeason: number | null; currentEpisode: number | null; totalSeasons: number | null; seasonDetails: string | null }> = {};
  let movieProgressMap: Record<number, { watched: boolean | null; watchedAt: string | null }> = {};

  if (tvItems.length > 0) {
    const tvRows = await db.select().from(tvProgress);
    for (const row of tvRows) {
      if (tvItems.includes(row.mediaItemId)) {
        tvProgressMap[row.mediaItemId] = {
          currentSeason: row.currentSeason,
          currentEpisode: row.currentEpisode,
          totalSeasons: row.totalSeasons,
          seasonDetails: row.seasonDetails,
        };
      }
    }
  }

  if (movieItems.length > 0) {
    const movieRows = await db.select().from(movieProgress);
    for (const row of movieRows) {
      if (movieItems.includes(row.mediaItemId)) {
        movieProgressMap[row.mediaItemId] = {
          watched: row.watched,
          watchedAt: row.watchedAt,
        };
      }
    }
  }

  const itemsWithProgress = items.map((item) => ({
    ...item,
    tvProgress: tvProgressMap[item.id] || null,
    movieProgress: movieProgressMap[item.id] || null,
  }));

  return {
    items: itemsWithProgress,
    total: countResult[0].count,
    totalPages: Math.ceil(countResult[0].count / limit),
  };
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

  // Get old values for history
  const [old] = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);

  await db
    .update(mediaItems)
    .set({
      ...data,
      status: data.status as "watching" | "completed" | "planned" | "dropped" | "on_hold" | undefined,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(mediaItems.id, id));

  if (old && data.status && data.status !== old.status) {
    await recordHistory(id, "status_changed", { from: old.status, to: data.status });
  }
  if (old && data.rating !== undefined && data.rating !== old.rating) {
    await recordHistory(id, "rating_changed", { from: old.rating, to: data.rating });
  }

  revalidateAll(id);
}

export async function updateTvProgress(
  mediaItemId: number,
  data: { currentSeason: number; currentEpisode: number }
) {
  await ensureMigrated();

  // Get old progress for history
  const [old] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, mediaItemId)).limit(1);

  await db
    .update(tvProgress)
    .set({
      currentSeason: data.currentSeason,
      currentEpisode: data.currentEpisode,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(tvProgress.mediaItemId, mediaItemId));

  // Auto-update status
  if (data.currentEpisode > 0) {
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
    if (item && item.status === "planned") {
      await db.update(mediaItems).set({ status: "watching", updatedAt: sql`datetime('now')` }).where(eq(mediaItems.id, mediaItemId));
      await recordHistory(mediaItemId, "status_changed", { from: "planned", to: "watching" });
    }
  }

  await db
    .update(mediaItems)
    .set({ updatedAt: sql`datetime('now')` })
    .where(eq(mediaItems.id, mediaItemId));

  await recordHistory(mediaItemId, "episode_watched", {
    from: old ? `S${old.currentSeason}E${old.currentEpisode}` : null,
    to: `S${data.currentSeason}E${data.currentEpisode}`,
    season: data.currentSeason,
    episode: data.currentEpisode,
  });

  revalidateAll(mediaItemId);
}

// Quick +1 episode from list
export async function advanceEpisode(mediaItemId: number) {
  await ensureMigrated();
  const [prog] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, mediaItemId)).limit(1);
  if (!prog) return;

  const seasonDetails: { season_number: number; episode_count: number }[] =
    prog.seasonDetails ? JSON.parse(prog.seasonDetails) : [];

  let newSeason = prog.currentSeason || 1;
  let newEpisode = (prog.currentEpisode || 0) + 1;

  // Check if we need to advance to next season
  const currentSeasonInfo = seasonDetails.find((s) => s.season_number === newSeason);
  if (currentSeasonInfo && newEpisode > currentSeasonInfo.episode_count) {
    const nextSeason = seasonDetails.find((s) => s.season_number === newSeason + 1);
    if (nextSeason) {
      newSeason = newSeason + 1;
      newEpisode = 1;
    }
    // If no next season, stay at last episode and auto-complete
    else {
      newEpisode = currentSeasonInfo.episode_count;
      await db
        .update(mediaItems)
        .set({ status: "completed", updatedAt: sql`datetime('now')` })
        .where(eq(mediaItems.id, mediaItemId));
      await recordHistory(mediaItemId, "status_changed", { from: "watching", to: "completed" });
    }
  }

  await updateTvProgress(mediaItemId, { currentSeason: newSeason, currentEpisode: newEpisode });
}

// Mark a TV show as fully watched: set progress to last episode of last season + completed
export async function markTvCompleted(mediaItemId: number) {
  await ensureMigrated();
  const [prog] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, mediaItemId)).limit(1);
  if (!prog) return;

  const seasonDetails: { season_number: number; episode_count: number }[] =
    prog.seasonDetails ? JSON.parse(prog.seasonDetails) : [];
  const seasons = seasonDetails
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  if (seasons.length > 0) {
    const lastSeason = seasons[seasons.length - 1];
    await updateTvProgress(mediaItemId, {
      currentSeason: lastSeason.season_number,
      currentEpisode: lastSeason.episode_count,
    });
  }

  const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  const oldStatus = item?.status;

  await db
    .update(mediaItems)
    .set({ status: "completed", updatedAt: sql`datetime('now')` })
    .where(eq(mediaItems.id, mediaItemId));

  if (oldStatus && oldStatus !== "completed") {
    await recordHistory(mediaItemId, "status_changed", { from: oldStatus, to: "completed" });
  }

  revalidateAll(mediaItemId);
}

export async function updateMovieProgress(
  mediaItemId: number,
  watched: boolean
) {
  await ensureMigrated();

  const [old] = await db.select().from(movieProgress).where(eq(movieProgress.mediaItemId, mediaItemId)).limit(1);

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

  await recordHistory(mediaItemId, "movie_watched", { watched, from: old?.watched });
  await recordHistory(mediaItemId, "status_changed", {
    from: watched ? "planned" : "completed",
    to: watched ? "completed" : "planned",
  });

  revalidateAll(mediaItemId);
}

export async function deleteMediaItem(id: number) {
  await ensureMigrated();
  const [item] = await db.select({ title: mediaItems.title }).from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
  await db.delete(mediaItems).where(eq(mediaItems.id, id));
  await writeSystemLog("info", "media_deleted", `删除影视「${item?.title || id}」`, { id });
  revalidateAll();
}

// Batch operations
export async function batchMarkCompleted(ids: number[]) {
  await ensureMigrated();
  for (const id of ids) {
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
    if (!item) continue;

    if (item.mediaType === "movie") {
      await db
        .update(movieProgress)
        .set({ watched: true, watchedAt: sql`datetime('now')`, updatedAt: sql`datetime('now')` })
        .where(eq(movieProgress.mediaItemId, id));
    } else if (item.mediaType === "tv") {
      // Set TV progress to the last episode of the last season
      const [prog] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, id)).limit(1);
      if (prog) {
        const seasonDetails: { season_number: number; episode_count: number }[] =
          prog.seasonDetails ? JSON.parse(prog.seasonDetails) : [];
        const seasons = seasonDetails.filter((s) => s.season_number > 0).sort((a, b) => a.season_number - b.season_number);
        if (seasons.length > 0) {
          const last = seasons[seasons.length - 1];
          await updateTvProgress(id, { currentSeason: last.season_number, currentEpisode: last.episode_count });
        }
      }
    }

    const oldStatus = item.status;
    await db
      .update(mediaItems)
      .set({ status: "completed", updatedAt: sql`datetime('now')` })
      .where(eq(mediaItems.id, id));

    if (oldStatus !== "completed") {
      await recordHistory(id, "status_changed", { from: oldStatus, to: "completed" });
    }
  }
  revalidateAll();
}

export async function batchDelete(ids: number[]) {
  await ensureMigrated();
  const titles: string[] = [];
  for (const id of ids) {
    const [item] = await db.select({ title: mediaItems.title }).from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
    if (item) titles.push(item.title);
    await db.delete(mediaItems).where(eq(mediaItems.id, id));
  }
  await writeSystemLog("info", "batch_deleted", `批量删除 ${ids.length} 个条目`, { ids, titles });
  revalidateAll();
}

export async function refetchMediaMetadata(id: number, options?: { silent?: boolean }) {
  await ensureMigrated();
  const { getMediaDetails } = await import("@/lib/tmdb");

  const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, id)).limit(1);
  if (!item) return;

  const details = await getMediaDetails(item.mediaType as "movie" | "tv", item.tmdbId);
  const title = details.title || details.name || item.title;
  const originalTitle = details.original_title || details.original_name;
  const releaseDate = details.release_date || details.first_air_date;
  const genres = JSON.stringify(details.genres.map((g) => g.name));
  const originCountry = details.origin_country?.[0] || null;

  await db
    .update(mediaItems)
    .set({
      title,
      originalTitle,
      overview: details.overview,
      posterPath: details.poster_path,
      backdropPath: details.backdrop_path,
      releaseDate,
      voteAverage: details.vote_average,
      genres,
      originCountry,
      metadataUpdatedAt: sql`datetime('now')`,
    })
    .where(eq(mediaItems.id, id));

  // Update TV season details if applicable
  if (item.mediaType === "tv" && details.seasons) {
    const seasonDetails = JSON.stringify(
      details.seasons.map((s) => ({
        season_number: s.season_number,
        episode_count: s.episode_count,
        name: s.name,
      }))
    );
    await db
      .update(tvProgress)
      .set({
        totalSeasons: details.number_of_seasons || 1,
        seasonDetails,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(tvProgress.mediaItemId, id));
  }

  if (!options?.silent) {
    await writeSystemLog("info", "metadata_refetched", `更新元数据「${title}」`, { id, title });
  }
  revalidateAll(id);
}

export async function batchRefetchMetadata(ids: number[]) {
  await ensureMigrated();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await refetchMediaMetadata(id, { silent: true });
      success++;
    } catch (e) {
      failed++;
      errors.push(`ID ${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await writeSystemLog(
    failed > 0 ? "warn" : "info",
    "metadata_refetched",
    `批量更新元数据: 成功 ${success}, 失败 ${failed}, 共 ${ids.length}`,
    { success, failed, total: ids.length, errors: errors.slice(0, 10) }
  );
  revalidateAll();
}

export async function setMediaTags(mediaItemId: number, tagIds: number[]) {
  await ensureMigrated();
  await db.delete(mediaTags).where(eq(mediaTags.mediaItemId, mediaItemId));

  if (tagIds.length > 0) {
    await db.insert(mediaTags).values(
      tagIds.map((tagId) => ({ mediaItemId, tagId }))
    );
  }

  revalidateAll(mediaItemId);
}

// Tags CRUD
export async function getAllTags() {
  await ensureMigrated();
  return db.select().from(tags).orderBy(asc(tags.sortOrder), asc(tags.name));
}

export async function createTag(data: { name: string; slug: string; color: string }) {
  await ensureMigrated();
  const [tag] = await db.insert(tags).values(data).returning();
  revalidateAll();
  return tag;
}

export async function updateTag(id: number, data: { name?: string; slug?: string; color?: string; sortOrder?: number }) {
  await ensureMigrated();
  await db.update(tags).set(data).where(eq(tags.id, id));
  revalidateAll();
}

export async function deleteTag(id: number) {
  await ensureMigrated();
  await db.delete(tags).where(eq(tags.id, id));
  revalidateAll();
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

// Progress history
export async function getProgressHistoryList(limit = 30) {
  await ensureMigrated();
  const rows = await db
    .select({
      history: progressHistory,
      title: mediaItems.title,
      posterPath: mediaItems.posterPath,
      mediaType: mediaItems.mediaType,
    })
    .from(progressHistory)
    .innerJoin(mediaItems, eq(progressHistory.mediaItemId, mediaItems.id))
    .orderBy(desc(progressHistory.createdAt))
    .limit(limit);

  return rows;
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

  const recentHistory = await getProgressHistoryList(15);

  return {
    total: totalCount.count,
    byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
    byType: Object.fromEntries(typeCounts.map((t) => [t.mediaType, t.count])),
    recentHistory,
  };
}

// Get media items grouped by status for homepage
export async function getMediaItemsGroupedByStatus(options?: {
  mediaType?: string;
  visibleOnly?: boolean;
  limit?: number;
}) {
  await ensureMigrated();
  const { mediaType, visibleOnly = true, limit = 15 } = options || {};

  const statuses = ["watching", "planned", "completed", "on_hold"] as const;
  const groups: { status: string; items: Awaited<ReturnType<typeof getMediaItemsWithProgress>>["items"]; total: number }[] = [];

  for (const status of statuses) {
    const conditions = [
      eq(mediaItems.status, status),
    ];
    if (mediaType) conditions.push(eq(mediaItems.mediaType, mediaType as "movie" | "tv"));
    if (visibleOnly) conditions.push(eq(mediaItems.isVisible, true));

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      db.select().from(mediaItems).where(where).orderBy(desc(mediaItems.updatedAt)).limit(limit),
      db.select({ count: sql<number>`count(*)` }).from(mediaItems).where(where),
    ]);

    if (items.length === 0) continue;

    // Fetch progress
    const tvItems = items.filter((i) => i.mediaType === "tv").map((i) => i.id);
    const movieItems = items.filter((i) => i.mediaType === "movie").map((i) => i.id);

    let tvProgressMap: Record<number, { currentSeason: number | null; currentEpisode: number | null; totalSeasons: number | null; seasonDetails: string | null }> = {};
    let movieProgressMap: Record<number, { watched: boolean | null; watchedAt: string | null }> = {};

    if (tvItems.length > 0) {
      const tvRows = await db.select().from(tvProgress).where(inArray(tvProgress.mediaItemId, tvItems));
      for (const row of tvRows) {
        tvProgressMap[row.mediaItemId] = {
          currentSeason: row.currentSeason,
          currentEpisode: row.currentEpisode,
          totalSeasons: row.totalSeasons,
          seasonDetails: row.seasonDetails,
        };
      }
    }

    if (movieItems.length > 0) {
      const movieRows = await db.select().from(movieProgress).where(inArray(movieProgress.mediaItemId, movieItems));
      for (const row of movieRows) {
        movieProgressMap[row.mediaItemId] = {
          watched: row.watched,
          watchedAt: row.watchedAt,
        };
      }
    }

    const itemsWithProgress = items.map((item) => ({
      ...item,
      tvProgress: tvProgressMap[item.id] || null,
      movieProgress: movieProgressMap[item.id] || null,
    }));

    groups.push({
      status,
      items: itemsWithProgress,
      total: countResult[0].count,
    });
  }

  return groups;
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

// Check which TMDB IDs are already in the library
export async function checkMediaInLibrary(
  tmdbIds: number[]
): Promise<Record<number, number>> {
  await ensureMigrated();
  if (tmdbIds.length === 0) return {};

  const rows = await db
    .select({ id: mediaItems.id, tmdbId: mediaItems.tmdbId })
    .from(mediaItems)
    .where(inArray(mediaItems.tmdbId, tmdbIds));

  return Object.fromEntries(rows.map((r) => [r.tmdbId, r.id]));
}

// Import media by TMDB ID (fetches details from TMDB first)
export async function importMediaByTmdbId(
  tmdbId: number,
  mediaType: "movie" | "tv"
) {
  const { getMediaDetails } = await import("@/lib/tmdb");
  const details = await getMediaDetails(mediaType, tmdbId);
  return addMediaFromTmdb(details, mediaType);
}

// Get system logs with pagination
export async function getSystemLogs(page = 1, limit = 50) {
  await ensureMigrated();
  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ count: sql<number>`count(*)` }).from(systemLogs),
  ]);
  return {
    items,
    total: countResult[0].count,
    totalPages: Math.ceil(countResult[0].count / limit),
  };
}

// Refresh all media metadata (used by cron)
export async function refreshAllMetadata() {
  await ensureMigrated();
  const allItems = await db
    .select({ id: mediaItems.id, title: mediaItems.title })
    .from(mediaItems);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of allItems) {
    try {
      await refetchMediaMetadata(item.id, { silent: true });
      success++;
    } catch (e) {
      failed++;
      errors.push(`${item.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await writeSystemLog(
    failed > 0 ? "warn" : "info",
    "cron_metadata_refresh",
    `定时刷新元数据完成: 成功 ${success}, 失败 ${failed}, 共 ${allItems.length}`,
    { success, failed, total: allItems.length, errors: errors.slice(0, 10) }
  );

  return { success, failed, total: allItems.length };
}
