"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getImageUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Edit,
  Trash2,
  CheckCircle,
  RefreshCw,
  Loader2,
  X,
  Star,
  Tv,
  Clapperboard,
  Eye,
  EyeOff,
  Pin,
  PinOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  batchMarkCompleted,
  batchDelete,
  batchRefetchMetadata,
  batchSetVisibility,
  togglePin,
  getMediaItemsWithProgress,
  refreshAllMetadata,
} from "@/app/admin/_actions/media";
import {
  TvProgressControl,
  MovieProgressControl,
  StatusControl,
} from "./progress-controls";
import { DeleteMediaButton } from "./delete-button";
import { RatingHistoryModal } from "./rating-history-modal";

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

interface MediaItemWithProgress {
  id: number;
  tmdbId: number;
  mediaType: string;
  title: string;
  originalTitle: string | null;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  rating: number | null;
  status: string;
  isVisible: boolean | null;
  sortOrder: number | null;
  tvProgress: TvProgressData | null;
  movieProgress: MovieProgressData | null;
  tags: { id: number; name: string; color: string | null }[];
}

type ConfirmAction = "complete" | "refetch" | "delete" | null;

const confirmConfig: Record<
  Exclude<ConfirmAction, null>,
  { title: string; description: (count: number) => string; destructive?: boolean }
> = {
  complete: {
    title: "标记已看完",
    description: (n) => `确定将 ${n} 个条目标记为已看完？进度将设置为最后一集。`,
  },
  refetch: {
    title: "重新抓取元信息",
    description: (n) =>
      `确定重新抓取 ${n} 个条目的元信息？将从 TMDB 更新标题、封面、评分等数据。`,
  },
  delete: {
    title: "删除条目",
    description: (n) => `确定删除 ${n} 个条目？此操作不可撤销！`,
    destructive: true,
  },
};

const PAGE_SIZE = 20;

function getTvStats(tvProgress: TvProgressData | null) {
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

interface LibraryListProps {
  initialItems: MediaItemWithProgress[];
  total: number;
  filterStatus?: string;
  filterType?: string;
  filterSearch?: string;
  filterGenre?: string;
  filterTag?: string;
}

export function LibraryList({
  initialItems,
  total,
  filterStatus,
  filterType,
  filterSearch,
  filterGenre,
  filterTag,
}: LibraryListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Rating history modal state
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingModalItem, setRatingModalItem] = useState<{
    id: number;
    title: string;
    voteAverage: number | null;
  } | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length < total;

  // Reset when filters change (initial items from server)
  useEffect(() => {
    setItems(initialItems);
    setPage(1);
    setSelected(new Set());
  }, [initialItems]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getMediaItemsWithProgress({
        page: nextPage,
        status: filterStatus,
        mediaType: filterType,
        search: filterSearch,
        genre: filterGenre,
        tag: filterTag,
        limit: PAGE_SIZE,
      });
      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
    } catch {
      toast.error("加载更多失败");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, filterStatus, filterType, filterSearch, filterGenre, filterTag]);

  // IntersectionObserver for infinite scroll
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

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const executeBatchAction = (action: Exclude<ConfirmAction, null>) => {
    setConfirmAction(null);
    setGlobalLoading(true);
    startTransition(async () => {
      try {
        const ids = Array.from(selected);
        if (action === "complete") {
          await batchMarkCompleted(ids);
          toast.success(`已将 ${ids.length} 个条目标记为已看完`);
        } else if (action === "refetch") {
          await batchRefetchMetadata(ids);
          toast.success(`已重新抓取 ${ids.length} 个条目的元信息`);
        } else if (action === "delete") {
          await batchDelete(ids);
          toast.success(`已删除 ${ids.length} 个条目`);
        }
        setSelected(new Set());
        router.refresh();
      } catch {
        toast.error("操作失败");
      } finally {
        setGlobalLoading(false);
      }
    });
  };

  const currentConfig = confirmAction ? confirmConfig[confirmAction] : null;

  return (
    <>
      {/* Global loading overlay */}
      {globalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 shadow-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              处理中...
            </p>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{currentConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {currentConfig?.description(selected.size)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={currentConfig?.destructive ? "destructive" : "default"}
              onClick={() => confirmAction && executeBatchAction(confirmAction)}
            >
              确定
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2">
        {/* Refresh all metadata button - shown when nothing selected */}
        {selected.size === 0 && items.length > 0 && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={globalLoading}
              onClick={async () => {
                setGlobalLoading(true);
                try {
                  const result = await refreshAllMetadata({ manual: true });
                  toast.success(
                    `更新完成：成功 ${result.success}，失败 ${result.failed}`
                  );
                  router.refresh();
                } catch {
                  toast.error("更新失败");
                } finally {
                  setGlobalLoading(false);
                }
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              一键更新全部元数据
            </Button>
          </div>
        )}

        {/* Batch action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-md sm:gap-3">
            <span className="text-sm font-medium">
              已选 {selected.size} 项
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction("complete")}
              disabled={pending}
              className="gap-1.5"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              标记已看完
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction("refetch")}
              disabled={pending}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重新抓取
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction("delete")}
              disabled={pending}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              className="gap-1.5"
              onClick={async () => {
                setGlobalLoading(true);
                try {
                  await batchSetVisibility(Array.from(selected), true);
                  toast.success(`已设置 ${selected.size} 个条目为前台显示`);
                  setSelected(new Set());
                  router.refresh();
                } catch {
                  toast.error("操作失败");
                } finally {
                  setGlobalLoading(false);
                }
              }}
            >
              <Eye className="h-3.5 w-3.5" />
              显示
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              className="gap-1.5"
              onClick={async () => {
                setGlobalLoading(true);
                try {
                  await batchSetVisibility(Array.from(selected), false);
                  toast.success(`已设置 ${selected.size} 个条目为前台隐藏`);
                  setSelected(new Set());
                  router.refresh();
                } catch {
                  toast.error("操作失败");
                } finally {
                  setGlobalLoading(false);
                }
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
              隐藏
            </Button>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Button size="sm" variant="ghost" onClick={toggleAll}>
                {selected.size === items.length ? "取消全选" : "全选"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Items */}
        {items.map((item) => (
          <div
            key={item.id}
            className={`relative flex items-center gap-2 rounded-lg border p-2 transition-colors sm:gap-3 sm:p-3 ${
              selected.has(item.id)
                ? "border-primary bg-primary/5"
                : (item.sortOrder || 0) > 0
                  ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-accent/50"
            } ${!item.isVisible ? "opacity-50" : ""}`}
          >
            {/* Checkbox */}
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggleSelect(item.id)}
              className="flex-shrink-0"
            />

            {/* Poster */}
            <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded sm:h-16 sm:w-12">
              <Image
                src={getImageUrl(item.posterPath, "w92")}
                alt={item.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Row 1: title + rating + status */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <h3 className="truncate text-sm font-medium">{item.title}</h3>
                {(item.sortOrder || 0) > 0 && (
                  <span className="flex-shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary">置顶</span>
                )}
                {item.voteAverage != null && item.voteAverage > 0 && (
                  <button
                    onClick={() => {
                      setRatingModalItem({
                        id: item.id,
                        title: item.title,
                        voteAverage: item.voteAverage,
                      });
                      setRatingModalOpen(true);
                    }}
                    className="flex flex-shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-accent"
                    title="查看评分历史"
                  >
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{item.voteAverage.toFixed(1)}</span>
                  </button>
                )}
                {item.rating && (
                  <span className="hidden flex-shrink-0 text-xs text-muted-foreground sm:inline">
                    我的: {item.rating}/10
                  </span>
                )}
                <StatusControl mediaItemId={item.id} status={item.status} />
              </div>
              {/* Row 2: type + date + season info + visibility */}
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                {item.mediaType === "tv" ? (
                  <Tv className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <Clapperboard className="h-3 w-3 flex-shrink-0" />
                )}
                <span className="truncate">
                  {item.releaseDate || "播出时间未定"}
                  {item.mediaType === "tv" && (() => {
                    const stats = getTvStats(item.tvProgress);
                    if (stats && stats.totalEpisodes > 0) {
                      return ` · ${stats.totalSeasons}季${stats.totalEpisodes}集`;
                    }
                    return "";
                  })()}
                  {!item.isVisible ? " · 🔒" : ""}
                </span>
              </div>
              {/* Row 3: tags - hidden on mobile */}
              {item.tags.length > 0 && (
                <div className="mt-1 hidden flex-wrap items-center gap-1 sm:flex">
                  {item.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="h-4 px-1 py-0 text-[10px] leading-none"
                      style={{
                        borderColor: tag.color || undefined,
                        color: tag.color || undefined,
                      }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Inline progress controls - hidden on mobile */}
            <div className="hidden flex-shrink-0 sm:block">
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

            {/* Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0 sm:gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${(item.sortOrder || 0) > 0 ? "text-primary" : "text-muted-foreground"}`}
                title={(item.sortOrder || 0) > 0 ? "取消置顶" : "置顶"}
                onClick={async () => {
                  const pinned = await togglePin(item.id);
                  toast.success(pinned ? "已置顶" : "已取消置顶");
                  router.refresh();
                }}
              >
                {(item.sortOrder || 0) > 0 ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </Button>
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

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {loadingMore && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </div>
        )}

        {/* Total count */}
        {items.length > 0 && !hasMore && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            共 {total} 条记录
          </p>
        )}
      </div>

      {/* Rating history modal */}
      {ratingModalItem && (
        <RatingHistoryModal
          open={ratingModalOpen}
          onOpenChange={(open) => {
            setRatingModalOpen(open);
            if (!open) setRatingModalItem(null);
          }}
          mediaItemId={ratingModalItem.id}
          title={ratingModalItem.title}
          currentRating={ratingModalItem.voteAverage}
        />
      )}
    </>
  );
}
