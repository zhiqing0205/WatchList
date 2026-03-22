"use server";

import { db, ensureMigrated } from "@/db";
import { mediaItems, tvProgress, movieProgress, mediaTags, tags, progressHistory, systemLogs, ratingHistory } from "@/db/schema";
import { eq, desc, asc, sql, and, like, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { TmdbMediaDetails } from "@/lib/tmdb";
import { getLastEpisodeFromDetails } from "@/lib/progress";

// Helper: build ORDER BY clause from sort parameters
function buildSortOrder(sortField?: string, sortDir?: string) {
  const dir = sortDir === "asc" ? sql.raw("ASC") : sql.raw("DESC");
  switch (sortField) {
    case "rating":
      return sql`COALESCE(${mediaItems.rating}, ${mediaItems.voteAverage}, 0) ${dir}`;
    case "episodes":
      return sql`(SELECT COALESCE(tp.total_seasons, 0) FROM tv_progress tp WHERE tp.media_item_id = ${mediaItems.id}) ${dir}`;
    case "date":
      return sql`${mediaItems.releaseDate} ${dir}`;
    default:
      return desc(mediaItems.updatedAt);
  }
}

// Determine if a TMDB item is currently airing/playing
function isTmdbAiring(mediaType: string, tmdbStatus?: string, releaseDate?: string): boolean {
  if (mediaType === "tv") {
    return tmdbStatus === "Returning Series";
  }
  if (mediaType === "movie") {
    // Movie is "热映中" if released within the last 90 days
    if (tmdbStatus !== "Released" || !releaseDate) return false;
    const release = new Date(releaseDate);
    const daysSinceRelease = (Date.now() - release.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceRelease >= 0 && daysSinceRelease <= 90;
  }
  return false;
}

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
  const initialStatus = isTmdbAiring(mediaType, details.status, releaseDate) ? "airing" : "planned";

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
      status: initialStatus,
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
  await recordRatingSnapshot(inserted.id, details.vote_average);
  await writeSystemLog("info", "media_added", `添加影视「${title}」`, { mediaType, tmdbId: details.id });

  revalidateAll();
  return { success: true, id: inserted.id };
}

// Get media items with their progress info for the library list
export async function getMediaItemsWithProgress(options?: {
  status?: string;
  mediaType?: string;
  search?: string;
  genre?: string;
  tag?: string;
  page?: number;
  limit?: number;
  visibleOnly?: boolean;
  sortField?: string;
  sortDir?: string;
}) {
  await ensureMigrated();
  const {
    status,
    mediaType,
    search,
    genre,
    tag,
    page = 1,
    limit = 20,
    visibleOnly = false,
    sortField,
    sortDir,
  } = options || {};

  const conditions = [];
  if (status) conditions.push(eq(mediaItems.status, status as "watching" | "completed" | "planned" | "dropped" | "on_hold" | "airing"));
  if (mediaType) conditions.push(eq(mediaItems.mediaType, mediaType as "movie" | "tv"));
  if (search) conditions.push(like(mediaItems.title, `%${search}%`));
  if (genre) conditions.push(like(mediaItems.genres, `%${genre}%`));
  if (tag) {
    // Filter by tag name via subquery
    conditions.push(
      sql`${mediaItems.id} IN (
        SELECT mt.media_item_id FROM media_tags mt
        JOIN tags t ON t.id = mt.tag_id
        WHERE t.name = ${tag}
      )`
    );
  }
  if (visibleOnly) conditions.push(eq(mediaItems.isVisible, true));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(mediaItems)
      .where(where)
      .orderBy(buildSortOrder(sortField, sortDir))
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

  // Fetch tags for all items
  let tagsMap: Record<number, { id: number; name: string; color: string | null }[]> = {};
  if (itemIds.length > 0) {
    const tagRows = await db
      .select({
        mediaItemId: mediaTags.mediaItemId,
        tagId: tags.id,
        tagName: tags.name,
        tagColor: tags.color,
      })
      .from(mediaTags)
      .innerJoin(tags, eq(mediaTags.tagId, tags.id));
    for (const row of tagRows) {
      if (itemIds.includes(row.mediaItemId)) {
        if (!tagsMap[row.mediaItemId]) tagsMap[row.mediaItemId] = [];
        tagsMap[row.mediaItemId].push({ id: row.tagId, name: row.tagName, color: row.tagColor });
      }
    }
  }

  const itemsWithProgress = items.map((item) => ({
    ...item,
    tvProgress: tvProgressMap[item.id] || null,
    movieProgress: movieProgressMap[item.id] || null,
    tags: tagsMap[item.id] || [],
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
  if (status) conditions.push(eq(mediaItems.status, status as "watching" | "completed" | "planned" | "dropped" | "on_hold" | "airing"));
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
      status: data.status as "watching" | "completed" | "planned" | "dropped" | "on_hold" | "airing" | undefined,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(mediaItems.id, id));

  if (old && data.status && data.status !== old.status) {
    await recordHistory(id, "status_changed", { from: old.status, to: data.status });
    await writeSystemLog("info", "media_edited", `「${old.title}」状态变更: ${old.status} → ${data.status}`, { id, field: "status", from: old.status, to: data.status });

    // Reverse sync: status change → progress update
    if (old.mediaType === "tv") {
      if (data.status === "completed") {
        const [prog] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, id)).limit(1);
        if (prog) {
          const lastEp = getLastEpisodeFromDetails(prog.seasonDetails);
          if (lastEp.episode > 0) {
            await db.update(tvProgress).set({
              currentSeason: lastEp.season,
              currentEpisode: lastEp.episode,
              updatedAt: sql`datetime('now')`,
            }).where(eq(tvProgress.mediaItemId, id));
          }
        }
      } else if (data.status === "planned") {
        await db.update(tvProgress).set({
          currentSeason: 1,
          currentEpisode: 0,
          updatedAt: sql`datetime('now')`,
        }).where(eq(tvProgress.mediaItemId, id));
      }
    } else if (old.mediaType === "movie") {
      if (data.status === "completed") {
        await db.update(movieProgress).set({
          watched: true,
          watchedAt: sql`datetime('now')`,
          updatedAt: sql`datetime('now')`,
        }).where(eq(movieProgress.mediaItemId, id));
      } else if (data.status === "planned") {
        await db.update(movieProgress).set({
          watched: false,
          watchedAt: null,
          updatedAt: sql`datetime('now')`,
        }).where(eq(movieProgress.mediaItemId, id));
      }
    }
  }
  if (old && data.rating !== undefined && data.rating !== old.rating) {
    await recordHistory(id, "rating_changed", { from: old.rating, to: data.rating });
    await writeSystemLog("info", "media_edited", `「${old.title}」评分变更: ${old.rating ?? "无"} → ${data.rating ?? "无"}`, { id, field: "rating", from: old.rating, to: data.rating });
  }

  revalidateAll(id);
}

/**
 * Infer the correct status from TV progress changes.
 * Returns new status string, or null if no change needed.
 * Core principle: never override "airing" — it's an external status from TMDB.
 */
function resolveStatusFromTvProgress(
  currentStatus: string,
  season: number,
  episode: number,
  seasonDetailsJson: string | null
): "watching" | "completed" | "planned" | null {
  if (currentStatus === "airing") return null;

  const lastEp = getLastEpisodeFromDetails(seasonDetailsJson);
  const isAtEnd = lastEp.episode > 0 && season === lastEp.season && episode >= lastEp.episode;
  const isAtStart = season === 1 && episode === 0;

  if (isAtEnd) return currentStatus === "completed" ? null : "completed";
  if (isAtStart && (currentStatus === "watching" || currentStatus === "completed")) return "planned";
  if (episode > 0 && ["planned", "on_hold", "dropped", "completed"].includes(currentStatus)) return "watching";

  return null;
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

  // Auto-update status based on new progress
  const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  if (item) {
    const newStatus = resolveStatusFromTvProgress(item.status, data.currentSeason, data.currentEpisode, old?.seasonDetails ?? null);
    if (newStatus) {
      await db.update(mediaItems).set({ status: newStatus, updatedAt: sql`datetime('now')` }).where(eq(mediaItems.id, mediaItemId));
      await recordHistory(mediaItemId, "status_changed", { from: item.status, to: newStatus });
    } else {
      await db.update(mediaItems).set({ updatedAt: sql`datetime('now')` }).where(eq(mediaItems.id, mediaItemId));
    }
  }

  await recordHistory(mediaItemId, "episode_watched", {
    from: old ? `S${old.currentSeason}E${old.currentEpisode}` : null,
    to: `S${data.currentSeason}E${data.currentEpisode}`,
    season: data.currentSeason,
    episode: data.currentEpisode,
  });

  const [tvItem] = await db.select({ title: mediaItems.title }).from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  await writeSystemLog("info", "progress_updated", `「${tvItem?.title || mediaItemId}」进度更新至 S${data.currentSeason}E${data.currentEpisode}`, {
    id: mediaItemId,
    from: old ? `S${old.currentSeason}E${old.currentEpisode}` : null,
    to: `S${data.currentSeason}E${data.currentEpisode}`,
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
    } else {
      // No next season — clamp to last episode; updateTvProgress will auto-complete
      newEpisode = currentSeasonInfo.episode_count;
    }
  }

  await updateTvProgress(mediaItemId, { currentSeason: newSeason, currentEpisode: newEpisode });
}

// Mark a TV show as fully watched: set progress to last episode of last season + completed
// This is an explicit user action, so it overrides even "airing" status.
export async function markTvCompleted(mediaItemId: number) {
  await ensureMigrated();
  const [prog] = await db.select().from(tvProgress).where(eq(tvProgress.mediaItemId, mediaItemId)).limit(1);
  if (!prog) return;

  const lastEp = getLastEpisodeFromDetails(prog.seasonDetails);
  if (lastEp.episode > 0) {
    await updateTvProgress(mediaItemId, {
      currentSeason: lastEp.season,
      currentEpisode: lastEp.episode,
    });
  }

  // Force completed even for airing (explicit user action)
  const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  if (item && item.status !== "completed") {
    await db.update(mediaItems).set({ status: "completed", updatedAt: sql`datetime('now')` }).where(eq(mediaItems.id, mediaItemId));
    await recordHistory(mediaItemId, "status_changed", { from: item.status, to: "completed" });
  }

  await writeSystemLog("info", "progress_updated", `「${item?.title || mediaItemId}」标记为全部看完`, { id: mediaItemId });
  revalidateAll(mediaItemId);
}

// Rewatch a TV show: set progress to S01E01 and status to watching (atomic single call)
export async function rewatchTv(mediaItemId: number) {
  await updateTvProgress(mediaItemId, { currentSeason: 1, currentEpisode: 1 });
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

  // Auto-update status, but never override "airing"
  const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  if (item && item.status !== "airing") {
    const newStatus = watched ? "completed" : "planned";
    if (item.status !== newStatus) {
      await db.update(mediaItems).set({ status: newStatus, updatedAt: sql`datetime('now')` }).where(eq(mediaItems.id, mediaItemId));
      await recordHistory(mediaItemId, "status_changed", { from: item.status, to: newStatus });
    }
  }

  await recordHistory(mediaItemId, "movie_watched", { watched, from: old?.watched });

  const [movieItem] = await db.select({ title: mediaItems.title }).from(mediaItems).where(eq(mediaItems.id, mediaItemId)).limit(1);
  await writeSystemLog("info", "progress_updated", `「${movieItem?.title || mediaItemId}」标记为${watched ? "已观看" : "未观看"}`, { id: mediaItemId, watched });

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
  await writeSystemLog("info", "batch_completed", `批量标记 ${ids.length} 个条目为已看`, { ids });
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

export async function batchSetVisibility(ids: number[], visible: boolean) {
  await ensureMigrated();
  for (const id of ids) {
    await db.update(mediaItems).set({ isVisible: visible }).where(eq(mediaItems.id, id));
  }
  await writeSystemLog("info", "batch_visibility", `批量${visible ? "显示" : "隐藏"} ${ids.length} 个条目`, { ids, visible });
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

  // Auto-detect airing status: only touch "planned" or "airing" items
  const tmdbAiring = isTmdbAiring(item.mediaType, details.status, releaseDate);
  let newStatus: string | undefined;
  if (item.status === "planned" && tmdbAiring) {
    newStatus = "airing";
  } else if (item.status === "airing" && !tmdbAiring) {
    newStatus = "planned";
  }

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
      ...(newStatus ? { status: newStatus as "airing" | "planned" } : {}),
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

export async function getMediaItemsByTagId(tagId: number) {
  await ensureMigrated();
  const rows = await db
    .select({
      id: mediaItems.id,
      title: mediaItems.title,
      mediaType: mediaItems.mediaType,
      posterPath: mediaItems.posterPath,
      status: mediaItems.status,
    })
    .from(mediaTags)
    .innerJoin(mediaItems, eq(mediaTags.mediaItemId, mediaItems.id))
    .where(eq(mediaTags.tagId, tagId))
    .orderBy(desc(mediaItems.updatedAt));
  return rows;
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

  // Rating distribution
  const ratingCounts = await db
    .select({
      rating: mediaItems.rating,
      count: sql<number>`count(*)`,
    })
    .from(mediaItems)
    .where(sql`${mediaItems.rating} IS NOT NULL`)
    .groupBy(mediaItems.rating);

  // Tag distribution — count media items per user-managed tag
  const tagCounts = await db
    .select({
      name: tags.name,
      color: tags.color,
      count: sql<number>`count(*)`,
    })
    .from(mediaTags)
    .innerJoin(tags, eq(mediaTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(*)`));

  // Monthly additions (last 12 months)
  const monthlyAdds = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${mediaItems.createdAt})`,
      count: sql<number>`count(*)`,
    })
    .from(mediaItems)
    .where(sql`${mediaItems.createdAt} >= datetime('now', '-12 months')`)
    .groupBy(sql`strftime('%Y-%m', ${mediaItems.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${mediaItems.createdAt})`);

  // Recent 7 days: added count
  const [recent7dAdded] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mediaItems)
    .where(sql`${mediaItems.createdAt} >= datetime('now', '-7 days')`);

  // Recent 7 days: completed count (status changed to completed in last 7 days)
  const [recent7dCompleted] = await db
    .select({ count: sql<number>`count(*)` })
    .from(progressHistory)
    .where(
      sql`${progressHistory.action} = 'status_changed' AND json_extract(${progressHistory.detail}, '$.to') = 'completed' AND ${progressHistory.createdAt} >= datetime('now', '-7 days')`
    );

  // Rating history total count
  const [ratingHistoryCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratingHistory);

  // Last backup time from site_config
  const { siteConfig: siteConfigTable } = await import("@/db/schema");
  const [backupRow] = await db
    .select()
    .from(siteConfigTable)
    .where(eq(siteConfigTable.key, "last_backup_time"))
    .limit(1);

  const recentHistory = await getProgressHistoryList(10);

  return {
    total: totalCount.count,
    byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s.count])),
    byType: Object.fromEntries(typeCounts.map((t) => [t.mediaType, t.count])),
    ratingDistribution: ratingCounts.map((r) => ({ rating: r.rating!, count: r.count })),
    tagDistribution: tagCounts.map((t) => ({ name: t.name, color: t.color, count: t.count })),
    monthlyAdds: monthlyAdds.map((m) => ({ month: m.month, count: m.count })),
    recent7dAdded: recent7dAdded.count,
    recent7dCompleted: recent7dCompleted.count,
    ratingHistoryTotal: ratingHistoryCount.count,
    lastBackupTime: backupRow?.value || null,
    recentHistory,
  };
}

// Get media items grouped by status for homepage
export async function getMediaItemsGroupedByStatus(options?: {
  mediaType?: string;
  visibleOnly?: boolean;
  limit?: number;
  sortField?: string;
  sortDir?: string;
  statusSorts?: Record<string, { sortField?: string; sortDir?: string }>;
}) {
  await ensureMigrated();
  const { mediaType, visibleOnly = true, limit = 15, sortField, sortDir, statusSorts } = options || {};

  const statuses = ["airing", "watching", "planned", "completed", "on_hold"] as const;
  const groups: { status: string; items: Awaited<ReturnType<typeof getMediaItemsWithProgress>>["items"]; total: number }[] = [];

  for (const status of statuses) {
    const conditions = [
      eq(mediaItems.status, status),
    ];
    if (mediaType) conditions.push(eq(mediaItems.mediaType, mediaType as "movie" | "tv"));
    if (visibleOnly) conditions.push(eq(mediaItems.isVisible, true));

    const where = and(...conditions);

    const ss = statusSorts?.[status];
    const sf = ss?.sortField || sortField;
    const sd = ss?.sortDir || sortDir;

    const [items, countResult] = await Promise.all([
      db.select().from(mediaItems).where(where).orderBy(buildSortOrder(sf, sd)).limit(limit),
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

    // Fetch tags
    const allItemIds = items.map((i) => i.id);
    let tagsMap: Record<number, { id: number; name: string; color: string | null }[]> = {};
    if (allItemIds.length > 0) {
      const tagRows = await db
        .select({
          mediaItemId: mediaTags.mediaItemId,
          tagId: tags.id,
          tagName: tags.name,
          tagColor: tags.color,
        })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(inArray(mediaTags.mediaItemId, allItemIds));
      for (const row of tagRows) {
        if (!tagsMap[row.mediaItemId]) tagsMap[row.mediaItemId] = [];
        tagsMap[row.mediaItemId].push({ id: row.tagId, name: row.tagName, color: row.tagColor });
      }
    }

    const itemsWithProgress = items.map((item) => ({
      ...item,
      tvProgress: tvProgressMap[item.id] || null,
      movieProgress: movieProgressMap[item.id] || null,
      tags: tagsMap[item.id] || [],
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

// Refresh all media metadata (used by cron and manual trigger)
const MAX_RATING_HISTORY = 30;

async function recordRatingSnapshot(mediaItemId: number, voteAverage: number | null) {
  if (voteAverage == null) return;

  // Round to 1 decimal to avoid duplicate records from tiny TMDB fluctuations
  const rounded = Math.round(voteAverage * 10) / 10;

  // Get the most recent record for this media item
  const [latest] = await db
    .select({ voteAverage: ratingHistory.voteAverage })
    .from(ratingHistory)
    .where(eq(ratingHistory.mediaItemId, mediaItemId))
    .orderBy(desc(ratingHistory.recordedAt))
    .limit(1);

  // Skip if rating unchanged (compare rounded values)
  if (latest && Math.round(latest.voteAverage * 10) / 10 === rounded) return;

  // Insert new snapshot with rounded value
  await db.insert(ratingHistory).values({ mediaItemId, voteAverage: rounded });

  // Trim to MAX_RATING_HISTORY per media item
  const count = await db
    .select({ count: sql<number>`count(*)` })
    .from(ratingHistory)
    .where(eq(ratingHistory.mediaItemId, mediaItemId));

  if (count[0].count > MAX_RATING_HISTORY) {
    const excess = count[0].count - MAX_RATING_HISTORY;
    const oldest = await db
      .select({ id: ratingHistory.id })
      .from(ratingHistory)
      .where(eq(ratingHistory.mediaItemId, mediaItemId))
      .orderBy(asc(ratingHistory.recordedAt))
      .limit(excess);
    if (oldest.length > 0) {
      await db.delete(ratingHistory).where(
        inArray(ratingHistory.id, oldest.map((r) => r.id))
      );
    }
  }
}

export async function refreshAllMetadata(options?: { manual?: boolean }) {
  await ensureMigrated();
  const allItems = await db
    .select({ id: mediaItems.id, title: mediaItems.title })
    .from(mediaItems);

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  const isManual = options?.manual;

  for (const item of allItems) {
    try {
      await refetchMediaMetadata(item.id, { silent: true });
      // Record rating snapshot during cron runs
      if (!isManual) {
        const [updated] = await db
          .select({ voteAverage: mediaItems.voteAverage })
          .from(mediaItems)
          .where(eq(mediaItems.id, item.id))
          .limit(1);
        await recordRatingSnapshot(item.id, updated?.voteAverage ?? null);
      }
      success++;
    } catch (e) {
      failed++;
      errors.push(`${item.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await writeSystemLog(
    failed > 0 ? "warn" : "info",
    isManual ? "manual_metadata_refresh" : "cron_metadata_refresh",
    `${isManual ? "手动" : "定时"}刷新元数据完成: 成功 ${success}, 失败 ${failed}, 共 ${allItems.length}`,
    { success, failed, total: allItems.length, errors: errors.slice(0, 10) }
  );

  return { success, failed, total: allItems.length };
}

export async function getRatingHistory(mediaItemId: number) {
  await ensureMigrated();
  return db
    .select({
      id: ratingHistory.id,
      voteAverage: ratingHistory.voteAverage,
      recordedAt: ratingHistory.recordedAt,
    })
    .from(ratingHistory)
    .where(eq(ratingHistory.mediaItemId, mediaItemId))
    .orderBy(asc(ratingHistory.recordedAt));
}

export async function getAllRatingHistory(options?: { page?: number; limit?: number }) {
  await ensureMigrated();
  const { page = 1, limit = 20 } = options || {};

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: ratingHistory.id,
        voteAverage: ratingHistory.voteAverage,
        recordedAt: ratingHistory.recordedAt,
        mediaItemId: ratingHistory.mediaItemId,
        title: mediaItems.title,
        posterPath: mediaItems.posterPath,
        mediaType: mediaItems.mediaType,
      })
      .from(ratingHistory)
      .innerJoin(mediaItems, eq(ratingHistory.mediaItemId, mediaItems.id))
      .orderBy(desc(ratingHistory.recordedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)` })
      .from(ratingHistory),
  ]);

  return {
    items: rows,
    total: countResult[0].count,
  };
}
