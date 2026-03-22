export interface TvProgressInput {
  currentSeason: number | null;
  currentEpisode: number | null;
  totalSeasons: number | null;
  seasonDetails: string | null;
}

export interface TvWatchedInfo {
  watchedEps: number;
  totalEps: number;
  progressPercent: number;
  currentSeasonTotalEpisodes: number;
  isFullyWatched: boolean;
}

export function computeTvWatchedInfo(
  progress: TvProgressInput
): TvWatchedInfo {
  const seasonDetails: { season_number: number; episode_count: number }[] =
    progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
  const seasons = seasonDetails
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const currentSeason = progress.currentSeason || 1;
  const currentEpisode = progress.currentEpisode || 0;

  let watchedEps = 0;
  let totalEps = 0;
  let currentSeasonTotalEpisodes = 0;

  for (const s of seasons) {
    totalEps += s.episode_count || 0;
    if (s.season_number < currentSeason) {
      watchedEps += s.episode_count || 0;
    } else if (s.season_number === currentSeason) {
      watchedEps += currentEpisode;
      currentSeasonTotalEpisodes = s.episode_count || 0;
    }
  }

  const isFullyWatched =
    seasons.length > 0 &&
    currentSeason === seasons[seasons.length - 1].season_number &&
    currentEpisode >= seasons[seasons.length - 1].episode_count;

  const progressPercent =
    totalEps > 0 ? Math.min(100, Math.round((watchedEps / totalEps) * 100)) : 0;

  return {
    watchedEps,
    totalEps,
    progressPercent,
    currentSeasonTotalEpisodes,
    isFullyWatched,
  };
}

/**
 * Extract the last season number and its episode count from seasonDetails JSON.
 * Returns {season: 1, episode: 0} if no valid data.
 */
export function getLastEpisodeFromDetails(
  seasonDetailsJson: string | null
): { season: number; episode: number } {
  if (!seasonDetailsJson) return { season: 1, episode: 0 };
  const details: { season_number: number; episode_count: number }[] =
    JSON.parse(seasonDetailsJson);
  const seasons = details
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (seasons.length === 0) return { season: 1, episode: 0 };
  const last = seasons[seasons.length - 1];
  return { season: last.season_number, episode: last.episode_count };
}
