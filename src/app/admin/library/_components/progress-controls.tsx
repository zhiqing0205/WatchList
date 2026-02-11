"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Check, Eye } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  advanceEpisode,
  updateMovieProgress,
  updateTvProgress,
  updateMediaItem,
} from "@/app/admin/_actions/media";

interface TvProgressData {
  currentSeason: number | null;
  currentEpisode: number | null;
  totalSeasons: number | null;
  seasonDetails: string | null;
}

interface MovieProgressData {
  watched: boolean | null;
  watchedAt: string | null;
}

// Compute total watched episodes for display
function computeWatchedInfo(progress: TvProgressData) {
  const seasonDetails: { season_number: number; episode_count: number; name?: string }[] =
    progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
  const seasons = seasonDetails
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const currentSeason = progress.currentSeason || 1;
  const currentEpisode = progress.currentEpisode || 0;

  let watchedEps = 0;
  let totalEps = 0;
  for (const s of seasons) {
    totalEps += s.episode_count || 0;
    if (s.season_number < currentSeason) {
      watchedEps += s.episode_count || 0;
    } else if (s.season_number === currentSeason) {
      watchedEps += currentEpisode;
    }
  }

  return { watchedEps, totalEps, seasons, currentSeason, currentEpisode };
}

// Determine if an episode is "watched" based on sequential model
function isEpisodeWatched(
  season: number,
  episode: number,
  currentSeason: number,
  currentEpisode: number
): boolean {
  if (season < currentSeason) return true;
  if (season === currentSeason && episode <= currentEpisode) return true;
  return false;
}

// TV inline progress control
export function TvProgressControl({
  mediaItemId,
  progress,
  status,
}: {
  mediaItemId: number;
  progress: TvProgressData | null;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Which season to view in the picker (navigational only)
  const [viewingSeason, setViewingSeason] = useState<number | null>(null);

  if (!progress) return null;

  const { watchedEps, totalEps, seasons, currentSeason, currentEpisode } =
    computeWatchedInfo(progress);

  // The season currently displayed in the picker
  const activeSeason = viewingSeason ?? currentSeason;
  const activeSeasonInfo = seasons.find((s) => s.season_number === activeSeason);
  const activeSeasonEps = activeSeasonInfo?.episode_count || 0;

  const handleAdvance = async () => {
    setLoading(true);
    try {
      await advanceEpisode(mediaItemId);
      router.refresh();
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  // Click on any episode in any season → set progress to that point
  const handleSetProgress = async (season: number, episode: number) => {
    setLoading(true);
    try {
      await updateTvProgress(mediaItemId, {
        currentSeason: season,
        currentEpisode: episode,
      });
      router.refresh();
      setShowPicker(false);
      setViewingSeason(null);
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkCompleted = async () => {
    setLoading(true);
    try {
      await updateMediaItem(mediaItemId, { status: "completed" });
      router.refresh();
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Compact progress display + quick controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => {
            setShowPicker(!showPicker);
            setViewingSeason(null);
          }}
          className="flex items-center gap-1.5 rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
          title="点击展开进度选择"
        >
          <span>S{currentSeason}E{currentEpisode}</span>
          <span className="text-muted-foreground">
            {progressPercent}%
          </span>
        </button>
        <Button
          variant="outline"
          size="icon"
          className="h-6 w-6"
          onClick={handleAdvance}
          disabled={loading}
          title="下一集"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
        {status !== "completed" && (
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={handleMarkCompleted}
            disabled={loading}
            title="标记看完"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Expandable progress picker */}
      {showPicker && (
        <div className="absolute right-12 top-full z-20 mt-1 w-80 max-w-[90vw] rounded-md border bg-popover p-3 shadow-lg">
          {/* Season tabs */}
          {seasons.length > 1 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {seasons.map((s) => {
                const isCompleted = s.season_number < currentSeason;
                const isCurrent = s.season_number === currentSeason;
                const isViewing = s.season_number === activeSeason;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => setViewingSeason(s.season_number)}
                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs transition-colors ${
                      isViewing
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-green-500/15 text-green-600"
                          : isCurrent
                            ? "bg-blue-500/15 text-blue-600"
                            : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {isCompleted && <Check className="h-2.5 w-2.5" />}
                    S{s.season_number}
                  </button>
                );
              })}
            </div>
          )}

          {/* Episode grid for the viewing season */}
          {activeSeasonEps > 0 && (
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: activeSeasonEps }, (_, i) => i + 1).map(
                (ep) => {
                  const watched = isEpisodeWatched(
                    activeSeason,
                    ep,
                    currentSeason,
                    currentEpisode
                  );
                  return (
                    <button
                      key={ep}
                      onClick={() => handleSetProgress(activeSeason, ep)}
                      disabled={loading}
                      className={`flex h-7 w-full items-center justify-center rounded text-xs font-medium transition-colors ${
                        watched
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {ep}
                    </button>
                  );
                }
              )}
            </div>
          )}

          {/* Summary line */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>已看 {watchedEps}/{totalEps} 集</span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Movie inline progress control
export function MovieProgressControl({
  mediaItemId,
  progress,
}: {
  mediaItemId: number;
  progress: MovieProgressData | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const watched = progress?.watched || false;

  const handleToggle = async () => {
    setLoading(true);
    try {
      await updateMovieProgress(mediaItemId, !watched);
      router.refresh();
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={watched ? "default" : "outline"}
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : watched ? (
        <Check className="h-3 w-3" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      {watched ? "已看" : "标记看完"}
    </Button>
  );
}

// Quick status badge that can be clicked to cycle
export function StatusControl({
  mediaItemId,
  status,
}: {
  mediaItemId: number;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const statusLabels: Record<string, string> = {
    watching: "在看",
    completed: "已看",
    planned: "想看",
    dropped: "弃剧",
    on_hold: "搁置",
  };

  const statusColors: Record<string, string> = {
    watching: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    completed: "bg-green-500/15 text-green-600 border-green-500/30",
    planned: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    dropped: "bg-red-500/15 text-red-600 border-red-500/30",
    on_hold: "bg-gray-500/15 text-gray-600 border-gray-500/30",
  };

  const handleChange = async (newStatus: string) => {
    if (newStatus === status) {
      setShowOptions(false);
      return;
    }
    setLoading(true);
    try {
      await updateMediaItem(mediaItemId, { status: newStatus });
      router.refresh();
      setShowOptions(false);
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${statusColors[status] || ""}`}
        disabled={loading}
      >
        {loading ? "..." : statusLabels[status] || status}
      </button>
      {showOptions && (
        <div className="absolute right-0 top-full z-10 mt-1 rounded-md border bg-popover p-1 shadow-md">
          {Object.entries(statusLabels).map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleChange(value)}
              className={`block w-full rounded px-3 py-1 text-left text-xs transition-colors hover:bg-accent ${
                value === status ? "font-bold" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
