export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMediaItemById } from "@/app/admin/_actions/media";
import { getImageUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, ArrowLeft, Star } from "lucide-react";
import type { Metadata } from "next";

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

  const genres: string[] = item.genres ? JSON.parse(item.genres) : [];
  const tvProg = item.mediaType === "tv" && item.progress && "currentSeason" in item.progress
    ? item.progress
    : null;
  const movieProg = item.mediaType === "movie" && item.progress && "watched" in item.progress
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
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" />
      </div>

      {/* Scrollable content over the fixed backdrop */}
      <div className="relative z-10">
        {/* Hero section */}
        <div className="pt-16 pb-8">
          <div className="container mx-auto px-4 md:px-10">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Poster */}
              <div className="mx-auto w-48 flex-shrink-0 md:mx-0 md:w-56">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-2xl">
                  <Image
                    src={getImageUrl(item.posterPath)}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex flex-col justify-end space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {item.mediaType === "tv" ? "剧集" : "电影"}
                  </Badge>
                  <Badge variant="outline" className="bg-background/30">
                    {statusLabels[item.status]}
                  </Badge>
                  {item.releaseDate && (
                    <span className="text-sm text-muted-foreground">
                      {item.releaseDate.substring(0, 4)}
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-bold md:text-4xl">{item.title}</h1>
                {item.originalTitle && item.originalTitle !== item.title && (
                  <p className="text-lg text-muted-foreground">{item.originalTitle}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {item.voteAverage !== null && item.voteAverage !== undefined && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{item.voteAverage.toFixed(1)}</span>
                    </div>
                  )}
                  {item.rating && (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">我的评分:</span>
                      <span className="font-medium text-yellow-400">{item.rating}/10</span>
                    </div>
                  )}
                  {genres.map((g) => (
                    <Badge key={g} variant="outline" className="text-xs bg-background/30">
                      {g}
                    </Badge>
                  ))}
                </div>

                {/* Progress display */}
                {tvProg && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-primary font-mono">
                      S{String(tvProg.currentSeason).padStart(2, "0")}E
                      {String(tvProg.currentEpisode).padStart(2, "0")}
                    </span>
                    {tvProg.totalSeasons && (
                      <span className="text-sm text-muted-foreground">
                        / 共 {tvProg.totalSeasons} 季
                      </span>
                    )}
                  </div>
                )}
                {movieProg && (
                  <p className={`text-lg font-medium ${movieProg.watched ? "text-green-500" : "text-muted-foreground"}`}>
                    {movieProg.watched ? "✓ 已观看" : "未观看"}
                    {movieProg.watchedAt && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        {movieProg.watchedAt}
                      </span>
                    )}
                  </p>
                )}

                <div className="flex items-center gap-3">
                  {item.playUrl && (
                    <Button asChild>
                      <a href={item.playUrl} target="_blank" rel="noopener noreferrer">
                        <Play className="mr-2 h-4 w-4" />
                        播放
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" asChild className="bg-background/30">
                    <Link href="/media">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      返回列表
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content section */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="md:col-span-2 space-y-6">
              {item.overview && (
                <div className="rounded-lg border bg-card/80 backdrop-blur-sm p-6">
                  <h2 className="mb-3 text-xl font-semibold">简介</h2>
                  <p className="leading-relaxed text-muted-foreground">{item.overview}</p>
                </div>
              )}
              {item.notes && (
                <div className="rounded-lg border bg-card/80 backdrop-blur-sm p-6">
                  <h2 className="mb-3 text-xl font-semibold">笔记</h2>
                  <p className="leading-relaxed text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* Tags */}
              {item.tags.length > 0 && (
                <div className="rounded-lg border bg-card/80 backdrop-blur-sm p-4">
                  <h3 className="mb-2 font-semibold">标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag) => (
                      <Link key={tag.id} href={`/tags/${tag.slug}`}>
                        <Badge
                          variant="outline"
                          style={{ borderColor: tag.color || undefined, color: tag.color || undefined }}
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
        </div>
      </div>
    </div>
  );
}
