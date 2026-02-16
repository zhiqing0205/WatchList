"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  Eye,
  SkipForward,
  CheckCircle,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  advanceEpisode,
  updateMovieProgress,
  updateTvProgress,
  markTvCompleted,
  updateMediaItem,
} from "@/app/admin/_actions/media";

// Brief flash animation hook — returns [flash, triggerFlash]
function useFlash(duration = 400): [boolean, () => void] {
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(true);
    timerRef.current = setTimeout(() => setFlash(false), duration);
  }, [duration]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return [flash, trigger];
}

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

function computeWatchedInfo(progress: TvProgressData) {
  const seasonDetails: {
    season_number: number;
    episode_count: number;
  }[] = progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
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

  const isFullyWatched =
    seasons.length > 0 &&
    currentSeason === seasons[seasons.length - 1].season_number &&
    currentEpisode >= seasons[seasons.length - 1].episode_count;

  return {
    watchedEps,
    totalEps,
    seasons,
    currentSeason,
    currentEpisode,
    isFullyWatched,
  };
}

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

function computeNextEpisode(progress: TvProgressData) {
  const seasonDetails: { season_number: number; episode_count: number }[] =
    progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
  const seasons = seasonDetails
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);

  let newSeason = progress.currentSeason || 1;
  let newEpisode = (progress.currentEpisode || 0) + 1;

  const currentSeasonInfo = seasons.find((s) => s.season_number === newSeason);
  if (currentSeasonInfo && newEpisode > currentSeasonInfo.episode_count) {
    const nextSeason = seasons.find((s) => s.season_number === newSeason + 1);
    if (nextSeason) {
      newSeason = newSeason + 1;
      newEpisode = 1;
    } else {
      newEpisode = currentSeasonInfo.episode_count;
    }
  }

  return { currentSeason: newSeason, currentEpisode: newEpisode };
}

function getLastEpisode(progress: TvProgressData) {
  const seasonDetails: { season_number: number; episode_count: number }[] =
    progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
  const seasons = seasonDetails
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number);
  if (seasons.length === 0) return { currentSeason: 1, currentEpisode: 0 };
  const last = seasons[seasons.length - 1];
  return { currentSeason: last.season_number, currentEpisode: last.episode_count };
}

// TV inline progress control with optimistic updates
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
  const [viewingSeason, setViewingSeason] = useState<number | null>(null);
  const [flash, triggerFlash] = useFlash();

  // Optimistic local state
  const [localProgress, setLocalProgress] = useState(progress);
  const [localStatus, setLocalStatus] = useState(status);

  // Sync from props when server data changes
  useEffect(() => {
    setLocalProgress(progress);
    setLocalStatus(status);
  }, [progress, status]);

  if (!localProgress) return null;

  const {
    watchedEps,
    totalEps,
    seasons,
    currentSeason,
    currentEpisode,
    isFullyWatched,
  } = computeWatchedInfo(localProgress);

  const activeSeason = viewingSeason ?? currentSeason;
  const activeSeasonInfo = seasons.find(
    (s) => s.season_number === activeSeason
  );
  const activeSeasonEps = activeSeasonInfo?.episode_count || 0;
  const progressPercent =
    totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0;
  const isCompleted = localStatus === "completed";
  const hasProgress = watchedEps > 0;

  const handleAdvance = async () => {
    // Optimistic update
    const next = computeNextEpisode(localProgress);
    setLocalProgress({ ...localProgress, ...next });
    if (localStatus === "planned") setLocalStatus("watching");
    triggerFlash();

    try {
      await advanceEpisode(mediaItemId);
      router.refresh();
    } catch {
      // Revert on error
      setLocalProgress(progress);
      setLocalStatus(status);
      toast.error("更新失败");
    }
  };

  const handleSetProgress = async (season: number, episode: number) => {
    // Optimistic update
    setLocalProgress({ ...localProgress, currentSeason: season, currentEpisode: episode });
    if (localStatus === "planned" && episode > 0) setLocalStatus("watching");
    setShowPicker(false);
    setViewingSeason(null);
    triggerFlash();

    try {
      await updateTvProgress(mediaItemId, { currentSeason: season, currentEpisode: episode });
      router.refresh();
    } catch {
      setLocalProgress(progress);
      setLocalStatus(status);
      toast.error("更新失败");
    }
  };

  const handleMarkCompleted = async () => {
    // Optimistic update
    const last = getLastEpisode(localProgress);
    setLocalProgress({ ...localProgress, ...last });
    setLocalStatus("completed");
    triggerFlash();

    try {
      await markTvCompleted(mediaItemId);
      router.refresh();
    } catch {
      setLocalProgress(progress);
      setLocalStatus(status);
      toast.error("更新失败");
    }
  };

  const handleRewatch = async () => {
    // Optimistic update
    setLocalProgress({ ...localProgress, currentSeason: 1, currentEpisode: 0 });
    setLocalStatus("watching");

    try {
      await updateTvProgress(mediaItemId, { currentSeason: 1, currentEpisode: 0 });
      await updateMediaItem(mediaItemId, { status: "watching" });
      router.refresh();
    } catch {
      setLocalProgress(progress);
      setLocalStatus(status);
      toast.error("更新失败");
    }
  };

  const handleReset = async () => {
    // Optimistic update
    setLocalProgress({ ...localProgress, currentSeason: 1, currentEpisode: 0 });

    try {
      await updateTvProgress(mediaItemId, { currentSeason: 1, currentEpisode: 0 });
      router.refresh();
    } catch {
      setLocalProgress(progress);
      setLocalStatus(status);
      toast.error("更新失败");
    }
  };

  // --- Completed state ---
  if (isCompleted && isFullyWatched) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
          <CheckCircle className="h-3 w-3" />
          已看完 {totalEps}集
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] text-muted-foreground"
          onClick={handleRewatch}
          disabled={loading}
        >
          重看
        </Button>
      </div>
    );
  }

  // --- Active watching state ---
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* Progress pill - click to open picker */}
        <button
          onClick={() => {
            setShowPicker(!showPicker);
            setViewingSeason(null);
          }}
          className={`flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-mono transition-all duration-300 hover:bg-accent ${
            flash
              ? "scale-110 bg-primary/15 ring-2 ring-primary/30"
              : "bg-muted scale-100"
          }`}
          title="点击选择进度"
        >
          <span>
            S{currentSeason}E{currentEpisode}
          </span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </button>

        {/* Advance button */}
        {!isFullyWatched && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={handleAdvance}
            disabled={loading}
          >
            <SkipForward className="h-3 w-3" />
            下一集
          </Button>
        )}

        {/* Mark completed button */}
        {!isCompleted && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 px-2 text-[11px]"
            onClick={handleMarkCompleted}
            disabled={loading}
          >
            <CheckCircle className="h-3 w-3" />
            看完
          </Button>
        )}

        {/* Reset progress button */}
        {hasProgress && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
            onClick={handleReset}
            disabled={loading}
            title="进度归零"
          >
            <RotateCcw className="h-3 w-3" />
            归零
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
                const isBefore = s.season_number < currentSeason;
                const isCurrent = s.season_number === currentSeason;
                const isViewing = s.season_number === activeSeason;
                return (
                  <button
                    key={s.season_number}
                    onClick={() => setViewingSeason(s.season_number)}
                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs transition-colors ${
                      isViewing
                        ? "bg-primary text-primary-foreground"
                        : isBefore
                          ? "bg-green-500/15 text-green-600"
                          : isCurrent
                            ? "bg-blue-500/15 text-blue-600"
                            : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {isBefore && <Check className="h-2.5 w-2.5" />}
                    S{s.season_number}
                  </button>
                );
              })}
            </div>
          )}

          {/* Episode grid */}
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

          {/* Summary */}
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              已看 {watchedEps}/{totalEps} 集
            </span>
            <span>{progressPercent}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Movie inline progress control with optimistic update
export function MovieProgressControl({
  mediaItemId,
  progress,
}: {
  mediaItemId: number;
  progress: MovieProgressData | null;
}) {
  const router = useRouter();
  const [optimisticWatched, setOptimisticWatched] = useState(progress?.watched || false);
  const [flash, triggerFlash] = useFlash();

  useEffect(() => {
    setOptimisticWatched(progress?.watched || false);
  }, [progress]);

  const handleToggle = async () => {
    const newWatched = !optimisticWatched;
    setOptimisticWatched(newWatched); // Instant UI update
    triggerFlash();

    try {
      await updateMovieProgress(mediaItemId, newWatched);
      router.refresh();
    } catch {
      setOptimisticWatched(!newWatched); // Revert
      toast.error("更新失败");
    }
  };

  return (
    <Button
      variant={optimisticWatched ? "default" : "outline"}
      size="sm"
      className={`h-7 gap-1 text-xs transition-all duration-300 ${
        flash ? "scale-110 ring-2 ring-primary/30" : "scale-100"
      }`}
      onClick={handleToggle}
    >
      {optimisticWatched ? (
        <Check className="h-3 w-3" />
      ) : (
        <Eye className="h-3 w-3" />
      )}
      {optimisticWatched ? "已看" : "标记看完"}
    </Button>
  );
}

// Status dropdown with colored options and optimistic update
const statusConfig = [
  { value: "watching", label: "在看", dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { value: "planned", label: "想看", dot: "bg-yellow-500", bg: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  { value: "completed", label: "已看", dot: "bg-green-500", bg: "bg-green-500/10 text-green-600 border-green-500/30" },
  { value: "on_hold", label: "搁置", dot: "bg-gray-500", bg: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  { value: "dropped", label: "弃剧", dot: "bg-red-500", bg: "bg-red-500/10 text-red-600 border-red-500/30" },
];

export function StatusControl({
  mediaItemId,
  status,
}: {
  mediaItemId: number;
  status: string;
}) {
  const router = useRouter();
  const [optimisticStatus, setOptimisticStatus] = useState(status);
  const [showOptions, setShowOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [flash, triggerFlash] = useFlash();

  useEffect(() => {
    setOptimisticStatus(status);
  }, [status]);

  const current = statusConfig.find((s) => s.value === optimisticStatus) || statusConfig[0];

  // Close on outside click
  useEffect(() => {
    if (!showOptions) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showOptions]);

  const handleChange = async (newStatus: string) => {
    if (newStatus === optimisticStatus) {
      setShowOptions(false);
      return;
    }
    const oldStatus = optimisticStatus;
    setOptimisticStatus(newStatus); // Instant UI update
    setShowOptions(false);
    triggerFlash();

    try {
      await updateMediaItem(mediaItemId, { status: newStatus });
      router.refresh();
    } catch {
      setOptimisticStatus(oldStatus); // Revert
      toast.error("更新失败");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowOptions(!showOptions)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-300 ${current.bg} ${
          flash ? "scale-110 ring-2 ring-primary/30" : "scale-100"
        }`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-50" />
      </button>
      {showOptions && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border bg-popover p-1 shadow-lg">
          {statusConfig.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-accent ${
                opt.value === optimisticStatus ? "font-semibold" : ""
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
              {opt.label}
              {opt.value === optimisticStatus && (
                <Check className="ml-auto h-3 w-3 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
