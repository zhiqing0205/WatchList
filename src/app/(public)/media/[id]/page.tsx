export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMediaItemById } from "@/app/admin/_actions/media";
import { getImageUrl, getMediaDetails } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ArrowLeft, Star } from "lucide-react";
import type { Metadata } from "next";
import type { TmdbCastMember } from "@/lib/tmdb";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const item = await getMediaItemById(Number(id));
  if (!item) return { title: "未找到" };
  return {
    title: `${item.title} | 追剧清单`,
    description: item.overview || undefined,
  };
}

export default async function MediaDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getMediaItemById(Number(id));

  if (!item) notFound();

  // Fetch cast from TMDB
  let cast: TmdbCastMember[] = [];
  try {
    const details = await getMediaDetails(
      item.mediaType as "movie" | "tv",
      item.tmdbId
    );
    cast = details.credits?.cast?.slice(0, 20) || [];
  } catch {
    // Silently fail - cast is optional
  }

  const genres: string[] = item.genres ? JSON.parse(item.genres) : [];
  const tvProg =
    item.mediaType === "tv" &&
    item.progress &&
    "currentSeason" in item.progress
      ? item.progress
      : null;
  const movieProg =
    item.mediaType === "movie" &&
    item.progress &&
    "watched" in item.progress
      ? item.progress
      : null;

  return (
    <div className="relative min-h-screen">
      {/* Fixed full-page backdrop */}
      <div className="fixed inset-0 z-0">
        {item.backdropPath ? (
          <Image
            src={getImageUrl(item.backdropPath, "w1280")}
            alt=""
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="h-full w-full bg-muted" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-background/70 to-background/90" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Back button - top left */}
        <div className="container mx-auto px-4 pt-4">
          <Link
            href="/media"
            className="inline-flex items-center gap-1.5 rounded-full bg-background/40 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </div>

        {/* Hero: Poster + Info + Synopsis in one row */}
        <div className="container mx-auto px-4 pt-6 pb-8 md:px-10">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Poster */}
            <div className="mx-auto w-52 flex-shrink-0 md:mx-0 md:w-60">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
                <Image
                  src={getImageUrl(item.posterPath)}
                  alt={item.title}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Info + Synopsis */}
            <div className="flex flex-1 flex-col justify-between min-w-0">
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <h1 className="text-3xl font-bold md:text-4xl leading-tight">
                    {item.title}
                  </h1>
                  {item.originalTitle && item.originalTitle !== item.title && (
                    <p className="mt-1 text-lg text-white/60">
                      {item.originalTitle}
                    </p>
                  )}
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {item.mediaType === "tv" ? "剧集" : "电影"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/20 text-white/80"
                  >
                    {statusLabels[item.status]}
                  </Badge>
                  {item.releaseDate && (
                    <span className="text-sm text-white/60">
                      {item.releaseDate.substring(0, 4)}
                    </span>
                  )}
                  {genres.map((g) => (
                    <Badge
                      key={g}
                      variant="outline"
                      className="border-white/15 text-white/70 text-xs"
                    >
                      {g}
                    </Badge>
                  ))}
                </div>

                {/* Ratings */}
                <div className="flex items-center gap-4">
                  {item.voteAverage !== null &&
                    item.voteAverage !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        <span className="text-lg font-semibold">
                          {item.voteAverage.toFixed(1)}
                        </span>
                      </div>
                    )}
                  {item.rating && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-white/50">我的评分</span>
                      <span className="text-lg font-semibold text-yellow-400">
                        {item.rating}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress */}
                {tvProg && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-primary font-mono">
                      S{String(tvProg.currentSeason).padStart(2, "0")}E
                      {String(tvProg.currentEpisode).padStart(2, "0")}
                    </span>
                    {tvProg.totalSeasons && (
                      <span className="text-sm text-white/50">
                        / 共 {tvProg.totalSeasons} 季
                      </span>
                    )}
                  </div>
                )}
                {movieProg && (
                  <p
                    className={`text-lg font-medium ${movieProg.watched ? "text-green-400" : "text-white/50"}`}
                  >
                    {movieProg.watched ? "✓ 已观看" : "未观看"}
                  </p>
                )}

                {/* Synopsis - inline with info, not in a separate card */}
                {item.overview && (
                  <p className="text-sm leading-relaxed text-white/70 max-w-2xl">
                    {item.overview}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 flex items-center gap-3">
                {item.playUrl && (
                  <Button size="lg" asChild>
                    <a
                      href={item.playUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Play className="mr-2 h-5 w-5" />
                      播放
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cast section */}
        {cast.length > 0 && (
          <div className="container mx-auto px-4 pb-8 md:px-10">
            <h2 className="mb-4 text-lg font-semibold text-white/80">演员</h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
              {cast.map((person) => (
                <div
                  key={person.id}
                  className="flex-shrink-0 w-24 text-center"
                >
                  <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-muted ring-2 ring-white/10">
                    {person.profile_path ? (
                      <Image
                        src={getImageUrl(person.profile_path, "w185")}
                        alt={person.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                        {person.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-white/80 line-clamp-1">
                    {person.name}
                  </p>
                  <p className="text-[10px] text-white/50 line-clamp-1">
                    {person.character}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes + Tags */}
        {(item.notes || item.tags.length > 0) && (
          <div className="container mx-auto px-4 pb-12 md:px-10">
            <div className="flex flex-wrap gap-8">
              {item.notes && (
                <div className="flex-1 min-w-[300px]">
                  <h2 className="mb-3 text-lg font-semibold text-white/80">
                    笔记
                  </h2>
                  <p className="text-sm leading-relaxed text-white/60 whitespace-pre-wrap">
                    {item.notes}
                  </p>
                </div>
              )}
              {item.tags.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold text-white/80">
                    标签
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <Link key={tag.id} href={`/tags/${tag.slug}`}>
                        <Badge
                          variant="outline"
                          className="border-white/20 hover:bg-white/10 transition-colors"
                          style={{
                            color: tag.color || undefined,
                            borderColor: tag.color || undefined,
                          }}
                        >
                          {tag.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
