"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getAllRatingHistory } from "@/app/admin/_actions/media";
import { getImageUrl } from "@/lib/tmdb";

interface RatingRecord {
  id: number;
  voteAverage: number;
  recordedAt: string | null;
  mediaItemId: number;
  title: string;
  posterPath: string | null;
  mediaType: string;
  previousVoteAverage: number | null;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const PAGE_SIZE = 20;

export function RatingHistoryFeed({
  initialItems,
  total,
}: {
  initialItems: RatingRecord[];
  total: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length < total;

  useEffect(() => {
    setItems(initialItems);
    setPage(1);
  }, [initialItems]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await getAllRatingHistory({ page: nextPage, limit: PAGE_SIZE });
      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        暂无评分历史记录
      </p>
    );
  }

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {items.map((item) => {
        const diff = item.previousVoteAverage != null
          ? Math.round((item.voteAverage - item.previousVoteAverage) * 10) / 10
          : null;

        return (
          <Link
            key={item.id}
            href={`/admin/library/${item.mediaItemId}`}
            className="flex gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent/30 sm:p-3"
          >
            {/* Poster */}
            <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded sm:h-16 sm:w-12">
              <Image
                src={getImageUrl(item.posterPath, "w92")}
                alt={item.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                  {item.mediaType === "tv" ? "剧集" : "电影"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-mono text-sm font-semibold">
                    {item.voteAverage.toFixed(1)}
                  </span>
                </div>
                {diff !== null && diff !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                    diff > 0
                      ? "bg-green-500/10 text-green-600"
                      : "bg-red-500/10 text-red-500"
                  }`}>
                    {diff > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                  </span>
                )}
                {diff === 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    <Minus className="h-3 w-3" />
                    0.0
                  </span>
                )}
              </div>
            </div>

            {/* Time */}
            <span className="flex-shrink-0 text-[10px] text-muted-foreground whitespace-nowrap self-start sm:text-xs">
              {formatDateTime(item.recordedAt)}
            </span>
          </Link>
        );
      })}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="col-span-full flex justify-center py-4">
          {loading && (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="col-span-full py-3 text-center text-xs text-muted-foreground">
          共 {total} 条记录
        </p>
      )}
    </div>
  );
}
