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

  if (!progress) return null;

  const season = progress.currentSeason || 1;
  const episode = progress.currentEpisode || 0;
  const seasonDetails: { season_number: number; episode_count: number }[] =
    progress.seasonDetails ? JSON.parse(progress.seasonDetails) : [];
  const currentSeasonInfo = seasonDetails.find(
    (s) => s.season_number === season
  );
  const totalEpisodes = currentSeasonInfo?.episode_count || 0;

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

  const handleSetEpisode = async (ep: number) => {
    setLoading(true);
    try {
      await updateTvProgress(mediaItemId, {
        currentSeason: season,
        currentEpisode: ep,
      });
      router.refresh();
      setShowPicker(false);
    } catch {
      toast.error("更新失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSetSeason = async (s: number) => {
    setLoading(true);
    try {
      await updateTvProgress(mediaItemId, {
        currentSeason: s,
        currentEpisode: 0,
      });
      router.refresh();
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

  return (
    <div className="flex flex-col gap-1.5">
      {/* Progress indicator + quick controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="rounded bg-muted px-2 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
          title="点击展开集数选择"
        >
          S{season}E{episode}
          {totalEpisodes > 0 && `/${totalEpisodes}`}
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

      {/* Expandable episode picker */}
      {showPicker && (
        <div className="absolute right-12 top-full z-20 mt-1 w-80 max-w-[90vw] rounded-md border bg-popover p-3 shadow-lg">
          {/* Season selector */}
          {(progress.totalSeasons || 1) > 1 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {Array.from(
                { length: progress.totalSeasons || 1 },
                (_, i) => i + 1
              ).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSetSeason(s)}
                  className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                    s === season
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent"
                  }`}
                >
                  S{s}
                </button>
              ))}
            </div>
          )}
          {/* Episode grid */}
          {totalEpisodes > 0 && (
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map(
                (ep) => (
                  <button
                    key={ep}
                    onClick={() => handleSetEpisode(ep)}
                    disabled={loading}
                    className={`flex h-7 w-full items-center justify-center rounded text-xs font-medium transition-colors ${
                      ep <= episode
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {ep}
                  </button>
                )
              )}
            </div>
          )}
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
