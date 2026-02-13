"use client";

import { useState, useCallback, useRef, useEffect, createContext, useContext } from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { getImageUrl, getCountryName } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Star, Play } from "lucide-react";
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

// Context for grid-level hover
const GridHoverContext = createContext<{
  hoveredId: number | null;
  onHoverStart: (id: number, el: HTMLElement) => void;
  onHoverEnd: () => void;
}>({ hoveredId: null, onHoverStart: () => {}, onHoverEnd: () => {} });

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
  const countryName = getCountryName(item.originCountry);

  const { hoveredId, onHoverStart, onHoverEnd } = useContext(GridHoverContext);
  const dimmed = hoveredId !== null && hoveredId !== item.id;

  const cardRef = useRef<HTMLAnchorElement>(null);
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

    if (cardRef.current) {
      onHoverStart(item.id, cardRef.current);
    }

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
  }, [ratingValue, item.id, onHoverStart]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHovered(false);
    setPhase("idle");
    setAnimatedRating(null);
    onHoverEnd();
  }, [onHoverEnd]);

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
      return {
        clipPath: `inset(0 ${100 - watchPercent}% 0 0)`,
        opacity: 0,
        transition: `opacity ${transitionTiming}, transform ${transitionTiming}`,
        transform: imageScale,
      };
    }
    if (phase === "sweep-ready") {
      return {
        clipPath: "inset(0 100% 0 0)",
        opacity: 0,
        transition: "none",
        transform: imageScale,
      };
    }
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
      ref={cardRef}
      href={`/${item.id}`}
      className="group block"
      style={{
        opacity: dimmed ? 0.35 : 1,
        transition: "opacity 0.3s ease",
      }}
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
              {countryName && ` · ${countryName}`}
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

/* ── Preview Popup ──────────────────────────────────── */

function PreviewPopup({
  item,
  anchorRect,
}: {
  item: MediaCardItem;
  anchorRect: DOMRect;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const genres: string[] = item.genres ? JSON.parse(item.genres) : [];
  const tvStats = item.mediaType === "tv" ? getTvStats(item.tvProgress) : null;
  const countryName = getCountryName(item.originCountry);
  const ratingValue = item.rating || item.voteAverage;

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) return;

    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 12;

    let left: number;
    let top: number;

    // Prefer right side
    if (anchorRect.right + gap + pw < vw) {
      left = anchorRect.right + gap;
    } else if (anchorRect.left - gap - pw > 0) {
      left = anchorRect.left - gap - pw;
    } else {
      left = Math.max(8, (vw - pw) / 2);
    }

    // Vertically centered on the card
    top = anchorRect.top + anchorRect.height / 2 - ph / 2;
    if (top < 8) top = 8;
    if (top + ph > vh - 8) top = vh - 8 - ph;

    setPos({ top, left });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-50 w-72 rounded-xl border bg-card/95 p-4 shadow-2xl backdrop-blur-md"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
        transition: "opacity 0.2s ease",
        pointerEvents: "none",
      }}
    >
      {/* Title */}
      <h3 className="text-base font-bold leading-tight">{item.title}</h3>
      {item.originalTitle && item.originalTitle !== item.title && (
        <p className="mt-0.5 text-xs text-muted-foreground">{item.originalTitle}</p>
      )}

      {/* Meta */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>{item.mediaType === "tv" ? "剧集" : "电影"}</span>
        {item.releaseDate && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span>{item.releaseDate}</span>
          </>
        )}
        {countryName && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span>{countryName}</span>
          </>
        )}
      </div>

      {/* Genres */}
      {genres.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {genres.slice(0, 4).map((g) => (
            <Badge key={g} variant="outline" className="text-[10px] px-1.5 py-0">
              {g}
            </Badge>
          ))}
        </div>
      )}

      {/* Rating + Progress */}
      <div className="mt-2.5 flex items-center gap-3">
        {ratingValue != null && ratingValue > 0 && (
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold">{ratingValue.toFixed(1)}</span>
          </div>
        )}
        {tvStats && tvStats.totalEpisodes > 0 && (
          <span className="text-xs text-muted-foreground">
            {tvStats.totalSeasons}季 {tvStats.totalEpisodes}集
          </span>
        )}
        {item.tvProgress && (item.tvProgress.currentEpisode || 0) > 0 && (
          <span className="text-xs font-mono text-primary">
            S{String(item.tvProgress.currentSeason).padStart(2, "0")}
            E{String(item.tvProgress.currentEpisode).padStart(2, "0")}
          </span>
        )}
        {item.movieProgress?.watched && (
          <span className="text-xs text-green-500">已观看</span>
        )}
      </div>

      {/* Overview */}
      {item.overview && (
        <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {item.overview}
        </p>
      )}

      {/* Play URL hint */}
      {item.playUrl && (
        <div className="mt-2.5 flex items-center gap-1 text-xs text-primary">
          <Play className="h-3 w-3" />
          <span>可播放</span>
        </div>
      )}
    </div>,
    document.body
  );
}

/* ── MediaGrid ──────────────────────────────────────── */

export function MediaGrid({
  items,
  maxRows,
  overflowHref,
  overflowTotal,
}: {
  items: MediaCardItem[];
  maxRows?: number;
  overflowHref?: string;
  overflowTotal?: number;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Hover preview state
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const hoveredItem = hoveredId !== null ? items.find((i) => i.id === hoveredId) : null;

  const handleHoverStart = useCallback((id: number, el: HTMLElement) => {
    setHoveredId(id);
    setHoveredRect(el.getBoundingClientRect());
    setShowPreview(false);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      // Re-read rect in case scroll moved
      setHoveredRect(el.getBoundingClientRect());
      setShowPreview(true);
    }, ZOOM_DURATION);
  }, []);

  const handleHoverEnd = useCallback(() => {
    setHoveredId(null);
    setShowPreview(false);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
  }, []);

  useEffect(() => {
    if (!maxRows || !gridRef.current) return;

    const check = () => {
      const el = gridRef.current;
      if (!el || el.children.length === 0) return;
      const firstTop = (el.children[0] as HTMLElement).offsetTop;
      let cols = 0;
      for (let i = 0; i < el.children.length; i++) {
        if ((el.children[i] as HTMLElement).offsetTop === firstTop) cols++;
        else break;
      }
      const capacity = maxRows * cols;
      setHasOverflow((overflowTotal ?? items.length) > capacity);
    };

    check();

    const ro = new ResizeObserver(check);
    ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, [maxRows, items.length, overflowTotal]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg">暂无影视内容</p>
        <p className="text-sm">稍后再来看看吧</p>
      </div>
    );
  }

  return (
    <GridHoverContext.Provider
      value={{ hoveredId, onHoverStart: handleHoverStart, onHoverEnd: handleHoverEnd }}
    >
      <div
        ref={gridRef}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        style={
          maxRows
            ? {
                gridTemplateRows: `repeat(${maxRows}, auto)`,
                gridAutoRows: 0,
                overflow: "hidden",
              }
            : undefined
        }
      >
        {items.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </div>
      {maxRows && hasOverflow && overflowHref && (
        <div className="mt-3 text-center">
          <Link
            href={overflowHref}
            className="inline-flex items-center gap-1 rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            查看全部{overflowTotal ? ` ${overflowTotal} 部` : ""}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
      {/* Preview popup */}
      {showPreview && hoveredItem && hoveredRect && (
        <PreviewPopup item={hoveredItem} anchorRect={hoveredRect} />
      )}
    </GridHoverContext.Provider>
  );
}
