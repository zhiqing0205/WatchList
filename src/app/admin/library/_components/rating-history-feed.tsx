"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Star } from "lucide-react";
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
    <div className="space-y-0.5">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50"
        >
          {/* Poster */}
          <Link
            href={`/admin/library/${item.mediaItemId}`}
            className="relative h-9 w-7 flex-shrink-0 overflow-hidden rounded"
          >
            <Image
              src={getImageUrl(item.posterPath, "w92")}
              alt={item.title}
              fill
              className="object-cover"
            />
          </Link>

          {/* Title */}
          <Link
            href={`/admin/library/${item.mediaItemId}`}
            className="min-w-0 flex-1 truncate text-sm hover:text-primary"
          >
            {item.title}
          </Link>

          {/* Type */}
          <Badge variant="outline" className="flex-shrink-0 text-[10px]">
            {item.mediaType === "tv" ? "剧集" : "电影"}
          </Badge>

          {/* Rating */}
          <div className="flex flex-shrink-0 items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="font-mono text-sm font-medium">
              {item.voteAverage.toFixed(1)}
            </span>
          </div>

          {/* Time */}
          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
            {formatDateTime(item.recordedAt)}
          </span>
        </div>
      ))}

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-3 text-center text-xs text-muted-foreground">
          共 {total} 条记录
        </p>
      )}
    </div>
  );
}
