"use server";

import { db, client, ensureMigrated } from "@/db";
import {
  mediaItems,
  tvProgress,
  movieProgress,
  tags,
  mediaTags,
  progressHistory,
  ratingHistory,
  siteConfig,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { webdavPut, webdavTestConnection, type WebDAVConfig } from "@/lib/webdav";

// ── Export all user data ──────────────────────────────────────────────

export async function exportData() {
  await ensureMigrated();

  const [
    mediaItemsData,
    tvProgressData,
    movieProgressData,
    tagsData,
    mediaTagsData,
    progressHistoryData,
    ratingHistoryData,
  ] = await Promise.all([
    db.select().from(mediaItems),
    db.select().from(tvProgress),
    db.select().from(movieProgress),
    db.select().from(tags),
    db.select().from(mediaTags),
    db.select().from(progressHistory),
    db.select().from(ratingHistory),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: {
      media_items: mediaItemsData,
      tv_progress: tvProgressData,
      movie_progress: movieProgressData,
      tags: tagsData,
      media_tags: mediaTagsData,
      progress_history: progressHistoryData,
      rating_history: ratingHistoryData,
    },
  };
}

// ── Import data from JSON ─────────────────────────────────────────────

// Map camelCase keys to snake_case for SQLite columns
const camelToSnake: Record<string, string> = {
  tmdbId: "tmdb_id",
  mediaType: "media_type",
  originalTitle: "original_title",
  posterPath: "poster_path",
  backdropPath: "backdrop_path",
  releaseDate: "release_date",
  voteAverage: "vote_average",
  originCountry: "origin_country",
  playUrl: "play_url",
  sortOrder: "sort_order",
  isVisible: "is_visible",
  createdAt: "created_at",
  updatedAt: "updated_at",
  metadataUpdatedAt: "metadata_updated_at",
  mediaItemId: "media_item_id",
  currentSeason: "current_season",
  currentEpisode: "current_episode",
  totalSeasons: "total_seasons",
  seasonDetails: "season_details",
  watchedAt: "watched_at",
  tagId: "tag_id",
  recordedAt: "recorded_at",
};

function normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[camelToSnake[key] || key] = value;
  }
  return result;
}

// Build an INSERT SQL string for a batch statement
function buildInsert(table: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return [];
  return rows.map((raw) => {
    const row = normalizeKeys(raw);
    const cols = Object.keys(row);
    const vals = cols.map((c) => {
      const v = row[c];
      if (v === null || v === undefined) return "NULL";
      if (typeof v === "number" || typeof v === "boolean") return String(Number(v));
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    return `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${vals.join(", ")})`;
  });
}

interface BackupPayload {
  version?: number;
  tables: Record<string, Record<string, unknown>[]>;
}

export async function importData(jsonString: string) {
  await ensureMigrated();

  const data: BackupPayload = JSON.parse(jsonString);
  if (!data.tables) {
    throw new Error("无效的备份文件：缺少 tables 字段");
  }

  const tableOrder = [
    "media_tags",
    "progress_history",
    "rating_history",
    "tv_progress",
    "movie_progress",
    "tags",
    "media_items",
  ];

  // Build batch: delete in FK-safe order, then insert in reverse order
  const stmts: string[] = [];
  for (const t of tableOrder) {
    stmts.push(`DELETE FROM \`${t}\``);
  }

  const insertOrder = [...tableOrder].reverse();
  for (const t of insertOrder) {
    const rows = data.tables[t];
    if (rows && rows.length > 0) {
      stmts.push(...buildInsert(t, rows));
    }
  }

  await client.batch(stmts.map((s) => ({ sql: s, args: [] })), "write");

  return { success: true, message: "数据导入成功" };
}

// ── WebDAV backup ─────────────────────────────────────────────────────

async function getWebDAVConfig(): Promise<WebDAVConfig | null> {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(siteConfig)
    .where(
      sql`${siteConfig.key} IN ('webdav_url', 'webdav_username', 'webdav_password')`
    );

  const cfg: Record<string, string> = {};
  for (const r of rows) {
    if (r.value) cfg[r.key] = r.value;
  }

  if (!cfg.webdav_url || !cfg.webdav_username || !cfg.webdav_password) {
    return null;
  }

  return {
    url: cfg.webdav_url,
    username: cfg.webdav_username,
    password: cfg.webdav_password,
  };
}

export async function backupToWebDAV() {
  const config = await getWebDAVConfig();
  if (!config) {
    return { success: false, message: "WebDAV 未配置" };
  }

  const data = await exportData();
  const json = JSON.stringify(data, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `watchlist-backup-${timestamp}.json`;

  await webdavPut(config, filename, json);

  // Update last backup time
  await db
    .insert(siteConfig)
    .values({
      key: "last_backup_time",
      value: new Date().toISOString(),
      updatedAt: sql`datetime('now')`,
    })
    .onConflictDoUpdate({
      target: siteConfig.key,
      set: { value: new Date().toISOString(), updatedAt: sql`datetime('now')` },
    });

  return { success: true, message: `备份成功：${filename}` };
}

// ── Config management ─────────────────────────────────────────────────

export async function saveWebDAVConfig(data: {
  url: string;
  username: string;
  password: string;
}) {
  await ensureMigrated();
  const pairs = [
    { key: "webdav_url", value: data.url },
    { key: "webdav_username", value: data.username },
    { key: "webdav_password", value: data.password },
  ];

  for (const { key, value } of pairs) {
    await db
      .insert(siteConfig)
      .values({ key, value, updatedAt: sql`datetime('now')` })
      .onConflictDoUpdate({
        target: siteConfig.key,
        set: { value, updatedAt: sql`datetime('now')` },
      });
  }

  return { success: true };
}

export async function getBackupInfo() {
  await ensureMigrated();
  const rows = await db
    .select()
    .from(siteConfig)
    .where(
      sql`${siteConfig.key} IN ('webdav_url', 'webdav_username', 'webdav_password', 'last_backup_time')`
    );

  const cfg: Record<string, string> = {};
  for (const r of rows) {
    if (r.value) cfg[r.key] = r.value;
  }

  return {
    webdavUrl: cfg.webdav_url || "",
    webdavUsername: cfg.webdav_username || "",
    webdavPassword: cfg.webdav_password || "",
    lastBackupTime: cfg.last_backup_time || null,
  };
}

export async function testWebDAVConnection() {
  const config = await getWebDAVConfig();
  if (!config) {
    return { ok: false, message: "请先填写并保存 WebDAV 配置" };
  }
  return webdavTestConnection(config);
}
