"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import type { MediaItem } from "@/db/schema";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

const statusColors: Record<string, string> = {
  watching: "bg-blue-500",
  completed: "bg-green-500",
  planned: "bg-yellow-500",
  dropped: "bg-red-500",
  on_hold: "bg-gray-500",
};

interface TvProgressInfo {
  currentSeason: number | null;
  currentEpisode: number | null;
  totalSeasons: number | null;
  seasonDetails: string | null;
}

interface MovieProgressInfo {
  watched: boolean | null;
  watchedAt: string | null;
}

export type MediaCardItem = MediaItem & {
  tvProgress?: TvProgressInfo | null;
  movieProgress?: MovieProgressInfo | null;
};

function computeWatchPercent(item: MediaCardItem): number {
  if (item.mediaType === "movie") {
    return item.movieProgress?.watched ? 100 : 0;
  }

  if (item.mediaType === "tv" && item.tvProgress) {
    const seasonDetails: { season_number: number; episode_count: number }[] =
      item.tvProgress.seasonDetails
        ? JSON.parse(item.tvProgress.seasonDetails)
        : [];

    const seasons = seasonDetails.filter((s) => s.season_number > 0);
    const totalEps = seasons.reduce(
      (sum, s) => sum + (s.episode_count || 0),
      0
    );
    if (totalEps === 0) return 0;

    const currentSeason = item.tvProgress.currentSeason || 1;
    const currentEpisode = item.tvProgress.currentEpisode || 0;

    let watchedEps = 0;
    for (const s of seasons) {
      if (s.season_number < currentSeason) {
        watchedEps += s.episode_count || 0;
      } else if (s.season_number === currentSeason) {
        watchedEps += currentEpisode;
      }
    }

    return Math.min(100, Math.round((watchedEps / totalEps) * 100));
  }

  return 0;
}

function getTvStats(tvProgress: TvProgressInfo | null | undefined) {
  if (!tvProgress) return null;
  const seasonDetails: { season_number: number; episode_count: number }[] =
    tvProgress.seasonDetails ? JSON.parse(tvProgress.seasonDetails) : [];
  const seasons = seasonDetails.filter((s) => s.season_number > 0);
  const totalSeasons = seasons.length || tvProgress.totalSeasons || 0;
  const totalEpisodes = seasons.reduce(
    (sum, s) => sum + (s.episode_count || 0),
    0
  );
  return { totalSeasons, totalEpisodes };
}

// Ease-in-out curve: slow start, fast middle, slow end
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Shared duration for zoom + fade (ms)
const ZOOM_DURATION = 600;

type AnimPhase = "idle" | "zooming" | "sweep-ready" | "sweeping";

export function MediaCard({ item }: { item: MediaCardItem }) {
  const watchPercent = computeWatchPercent(item);
  const tvStats =
    item.mediaType === "tv" ? getTvStats(item.tvProgress) : null;
  const ratingValue =
    item.rating || (item.voteAverage ? parseFloat(item.voteAverage.toFixed(1)) : null);

  const [phase, setPhase] = useState<AnimPhase>("idle");
  const [hovered, setHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated rating counter
  const [animatedRating, setAnimatedRating] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    setPhase("zooming");
    timerRef.current = setTimeout(() => {
      setPhase("sweep-ready");
    }, ZOOM_DURATION);

    // Start rating counter animation
    if (ratingValue && ratingValue > 0) {
      setAnimatedRating(0);
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / ZOOM_DURATION, 1);
        const eased = easeInOut(progress);
        setAnimatedRating(eased * ratingValue);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [ratingValue]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHovered(false);
    setPhase("idle");
    setAnimatedRating(null);
  }, []);

  // When React renders "sweep-ready", schedule the actual sweep on next frame
  useEffect(() => {
    if (phase !== "sweep-ready") return;
    const raf = requestAnimationFrame(() => {
      setPhase("sweeping");
    });
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const imageScale = hovered ? "scale(1.1)" : "scale(1)";
  const transitionTiming = `${ZOOM_DURATION}ms ease-in-out`;

  // Color layer styles per phase
  const colorStyle = ((): React.CSSProperties => {
    if (phase === "idle") {
      return {
        clipPath: `inset(0 ${100 - watchPercent}% 0 0)`,
        opacity: 1,
        transition: `opacity 0.3s ease-out, clip-path 0.3s ease-out, transform ${transitionTiming}`,
        transform: imageScale,
      };
    }
    if (phase === "zooming") {
      // Fade color away in sync with zoom — same duration & easing
      return {
        clipPath: `inset(0 ${100 - watchPercent}% 0 0)`,
        opacity: 0,
        transition: `opacity ${transitionTiming}, transform ${transitionTiming}`,
        transform: imageScale,
      };
    }
    if (phase === "sweep-ready") {
      // Starting position for sweep: clip fully hidden, no transition
      return {
        clipPath: "inset(0 100% 0 0)",
        opacity: 0,
        transition: "none",
        transform: imageScale,
      };
    }
    // phase === "sweeping": animate from 0 to watchPercent
    return {
      clipPath: `inset(0 ${100 - watchPercent}% 0 0)`,
      opacity: 1,
      transition: `opacity 0.2s ease-out, clip-path ${transitionTiming}, transform ${transitionTiming}`,
      transform: imageScale,
    };
  })();

  // Rating display: animated value on hover, static otherwise
  const shownRating =
    animatedRating !== null
      ? animatedRating.toFixed(1)
      : ratingValue
        ? ratingValue.toFixed(1)
        : null;

  return (
    <Link
      href={`/${item.id}`}
      className="group block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        {/* Grayscale base layer */}
        <Image
          src={getImageUrl(item.posterPath)}
          alt={item.title}
          fill
          className="object-cover grayscale"
          style={{
            transform: imageScale,
            transition: `transform ${transitionTiming}`,
          }}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        {/* Color layer - opacity fade + clip sweep */}
        <Image
          src={getImageUrl(item.posterPath)}
          alt=""
          fill
          className="object-cover"
          style={colorStyle}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          aria-hidden
        />

        {/* Gradient overlays */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/60 to-transparent" />

        {/* Top left: status badge */}
        <div className="absolute left-2 top-2 transition-transform duration-300 group-hover:-translate-y-0.5">
          <Badge
            variant="secondary"
            className={`${statusColors[item.status]} text-white border-0 text-[10px] px-1.5 py-0 shadow-md`}
          >
            {statusLabels[item.status]}
          </Badge>
        </div>

        {/* Top right: rating with counter animation */}
        {shownRating && (
          <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-[11px] font-bold text-yellow-400 shadow-md backdrop-blur-sm transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-0.5">
            {shownRating}
          </div>
        )}

        {/* Bottom info - same line: left type+year, right seasons/eps */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 transition-transform duration-300 group-hover:-translate-y-1">
          <div className="flex items-end justify-between">
            <span className="text-[11px] text-white/90 font-medium">
              {item.mediaType === "tv" ? "剧集" : "电影"}
              {item.releaseDate && ` · ${item.releaseDate.substring(0, 4)}`}
            </span>
            {tvStats && tvStats.totalEpisodes > 0 && (
              <span className="text-[11px] text-white/90 font-medium">
                {tvStats.totalSeasons}季 · {tvStats.totalEpisodes}集
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Title below card */}
      <div className="mt-2">
        <h3 className="line-clamp-1 text-sm font-medium leading-tight transition-colors duration-200 group-hover:text-primary">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

export function MediaGrid({ items }: { items: MediaCardItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg">暂无影视内容</p>
        <p className="text-sm">稍后再来看看吧</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
