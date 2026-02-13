"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  batchMarkCompleted,
  batchDelete,
  batchRefetchMetadata,
} from "@/app/admin/_actions/media";
import {
  TvProgressControl,
  MovieProgressControl,
  StatusControl,
} from "./progress-controls";
import { DeleteMediaButton } from "./delete-button";

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
  tvProgress: TvProgressData | null;
  movieProgress: MovieProgressData | null;
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

export function LibraryList({ items }: { items: MediaItemWithProgress[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

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
        {/* Batch action bar */}
        {selected.size > 0 && (
          <div className="sticky top-0 z-20 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-md">
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
            <div className="ml-auto flex items-center gap-2">
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
            className={`relative flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              selected.has(item.id)
                ? "border-primary bg-primary/5"
                : "hover:bg-accent/50"
            }`}
          >
            {/* Checkbox */}
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggleSelect(item.id)}
              className="flex-shrink-0"
            />

            {/* Poster */}
            <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden rounded">
              <Image
                src={getImageUrl(item.posterPath, "w92")}
                alt={item.title}
                fill
                className="object-cover"
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium">{item.title}</h3>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {item.mediaType === "tv" ? "剧集" : "电影"}
                </Badge>
                <StatusControl mediaItemId={item.id} status={item.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {item.releaseDate || ""}
                {item.voteAverage
                  ? ` · ⭐ ${item.voteAverage.toFixed(1)}`
                  : ""}
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

            {/* Actions */}
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
    </>
  );
}
