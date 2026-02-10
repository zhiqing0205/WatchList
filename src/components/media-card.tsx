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

    // Filter out season 0 (specials)
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

export function MediaCard({ item }: { item: MediaCardItem }) {
  const watchPercent = computeWatchPercent(item);
  const tvStats =
    item.mediaType === "tv" ? getTvStats(item.tvProgress) : null;

  return (
    <Link href={`/media/${item.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        {/* Grayscale base layer */}
        <Image
          src={getImageUrl(item.posterPath)}
          alt={item.title}
          fill
          className="object-cover grayscale"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        {/* Color layer - clipped to watch percentage */}
        {watchPercent > 0 && (
          <Image
            src={getImageUrl(item.posterPath)}
            alt=""
            fill
            className="object-cover"
            style={{ clipPath: `inset(0 ${100 - watchPercent}% 0 0)` }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            aria-hidden
          />
        )}

        {/* Always-visible overlays */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Top left: status badge */}
        <div className="absolute left-1.5 top-1.5">
          <Badge
            variant="secondary"
            className={`${statusColors[item.status]} text-white border-0 text-[10px] px-1.5 py-0`}
          >
            {statusLabels[item.status]}
          </Badge>
        </div>

        {/* Top right: rating */}
        {item.rating && (
          <div className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-[10px] font-bold text-yellow-400">
            {item.rating}
          </div>
        )}

        {/* Bottom left: type + year */}
        <div className="absolute bottom-1.5 left-1.5">
          <p className="text-[10px] text-white/90 font-medium">
            {item.mediaType === "tv" ? "剧集" : "电影"}
            {item.releaseDate && ` · ${item.releaseDate.substring(0, 4)}`}
          </p>
        </div>

        {/* Bottom right: seasons/episodes info */}
        {tvStats && tvStats.totalEpisodes > 0 && (
          <div className="absolute bottom-1.5 right-1.5 text-right">
            <p className="text-[10px] text-white/90 font-medium">
              {tvStats.totalSeasons}季 {tvStats.totalEpisodes}集
            </p>
          </div>
        )}

        {/* Hover scale effect */}
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105 pointer-events-none" />
      </div>
      <div className="mt-2 space-y-0.5">
        <h3 className="line-clamp-1 text-sm font-medium leading-tight">
          {item.title}
        </h3>
        {item.voteAverage !== null && item.voteAverage !== undefined && (
          <p className="text-xs text-muted-foreground">
            ⭐ {item.voteAverage.toFixed(1)}
          </p>
        )}
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
