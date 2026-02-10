export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import { getMediaItemsWithProgress } from "@/app/admin/_actions/media";
import { getImageUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { Edit, Plus } from "lucide-react";
import { DeleteMediaButton } from "./_components/delete-button";
import {
  TvProgressControl,
  MovieProgressControl,
  StatusControl,
} from "./_components/progress-controls";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

interface Props {
  searchParams: Promise<{ page?: string; status?: string; type?: string; search?: string }>;
}

export default async function LibraryPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { items, totalPages } = await getMediaItemsWithProgress({
    page,
    status: params.status,
    mediaType: params.type,
    search: params.search,
    limit: 20,
  });

  const urlParams = new URLSearchParams();
  if (params.status) urlParams.set("status", params.status);
  if (params.type) urlParams.set("type", params.type);
  if (params.search) urlParams.set("search", params.search);
  const baseUrl = `/admin/library${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">影视管理</h1>
        <Button asChild>
          <Link href="/admin/search">
            <Plus className="mr-2 h-4 w-4" />
            添加影视
          </Link>
        </Button>
      </div>

      {/* Filter links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/library">
          <Badge variant={!params.status && !params.type ? "default" : "outline"}>全部</Badge>
        </Link>
        {Object.entries(statusLabels).map(([value, label]) => (
          <Link key={value} href={`/admin/library?status=${value}`}>
            <Badge variant={params.status === value ? "default" : "outline"}>
              {label}
            </Badge>
          </Link>
        ))}
        <span className="mx-2 border-l" />
        <Link href="/admin/library?type=tv">
          <Badge variant={params.type === "tv" ? "default" : "outline"}>剧集</Badge>
        </Link>
        <Link href="/admin/library?type=movie">
          <Badge variant={params.type === "movie" ? "default" : "outline"}>电影</Badge>
        </Link>
      </div>

      {/* Media list */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
          >
            <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded">
              <Image
                src={getImageUrl(item.posterPath, "w92")}
                alt={item.title}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium">{item.title}</h3>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {item.mediaType === "tv" ? "剧集" : "电影"}
                </Badge>
                <StatusControl mediaItemId={item.id} status={item.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {item.releaseDate?.substring(0, 4)}
                {item.voteAverage ? ` · ⭐ ${item.voteAverage.toFixed(1)}` : ""}
                {item.rating ? ` · 评分: ${item.rating}/10` : ""}
                {!item.isVisible ? " · 🔒 隐藏" : ""}
              </p>
            </div>

            {/* Inline progress controls */}
            <div className="flex-shrink-0">
              {item.mediaType === "tv" && (
                <TvProgressControl
                  mediaItemId={item.id}
                  progress={item.tvProgress}
                  status={item.status}
                />
              )}
              {item.mediaType === "movie" && (
                <MovieProgressControl
                  mediaItemId={item.id}
                  progress={item.movieProgress}
                />
              )}
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/admin/library/${item.id}`}>
                  <Edit className="h-4 w-4" />
                </Link>
              </Button>
              <DeleteMediaButton id={item.id} title={item.title} />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center py-10 text-muted-foreground">
            <p>暂无影视内容</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/admin/search">去搜索添加</Link>
            </Button>
          </div>
        )}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
