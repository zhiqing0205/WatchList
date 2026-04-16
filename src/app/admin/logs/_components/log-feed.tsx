"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, RefreshCw, Timer, Layers, Pencil, Play, CheckCircle2, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getSystemLogs } from "@/app/admin/_actions/media";
import { formatDateTimeCST } from "@/lib/utils";

const levelConfig: Record<string, { color: string; border: string }> = {
  info: { color: "bg-blue-500", border: "" },
  warn: { color: "bg-yellow-500", border: "border-l-2 border-l-yellow-500" },
  error: { color: "bg-red-500", border: "border-l-2 border-l-red-500" },
};

const actionConfig: Record<string, { label: string; icon: typeof Plus }> = {
  media_added: { label: "新增影视", icon: Plus },
  media_deleted: { label: "删除影视", icon: Trash2 },
  media_edited: { label: "编辑影视", icon: Pencil },
  batch_deleted: { label: "批量删除", icon: Layers },
  batch_completed: { label: "批量完成", icon: CheckCircle2 },
  batch_visibility: { label: "批量显隐", icon: EyeOff },
  progress_updated: { label: "进度更新", icon: Play },
  metadata_refetched: { label: "更新元数据", icon: RefreshCw },
  cron_metadata_refresh: { label: "定时更新", icon: Timer },
  manual_metadata_refresh: { label: "手动更新", icon: RefreshCw },
};

function LogDetail({ action, detail }: { action: string; detail: Record<string, unknown> }) {
  if ((action === "batch_deleted" || action === "batch_completed") && Array.isArray(detail.titles)) {
    return (
      <div className="flex flex-wrap gap-1">
        {(detail.titles as string[]).map((title, i) => (
          <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{title}</span>
        ))}
      </div>
    );
  }
  if (action.includes("metadata")) {
    const extras: React.ReactNode[] = [];
    if (detail.newRatings !== undefined && Number(detail.newRatings) > 0) {
      extras.push(
        <span key="ratings" className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600">
          新增评分 {String(detail.newRatings)}
        </span>
      );
    }
    if (Array.isArray(detail.errors) && detail.errors.length > 0) {
      extras.push(
        ...(detail.errors as string[]).slice(0, 3).map((err, i) => (
          <p key={`err-${i}`} className="w-full text-[11px] text-red-500 truncate">{err}</p>
        ))
      );
    }
    return extras.length > 0 ? <div className="flex flex-wrap gap-1.5">{extras}</div> : null;
  }
  if (detail.from !== undefined && detail.to !== undefined) return null;
  const skipKeys = new Set(["id", "ids", "mediaType", "tmdbId", "success", "failed", "total"]);
  const entries = Object.entries(detail).filter(
    ([k, v]) => !skipKeys.has(k) && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  );
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
          {Array.isArray(value) ? `${value.length} 项` : String(value)}
        </span>
      ))}
    </div>
  );
}

interface LogItem {
  id: number;
  level: string;
  action: string;
  message: string;
  detail: string | null;
  createdAt: string | null;
}

const PAGE_SIZE = 30;

export function LogFeed({
  initialItems,
  total,
  filterLevel,
  filterAction,
}: {
  initialItems: LogItem[];
  total: number;
  filterLevel?: string;
  filterAction?: string;
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
      const result = await getSystemLogs(nextPage, PAGE_SIZE, { level: filterLevel, action: filterAction });
      setItems((prev) => [...prev, ...result.items]);
      setPage(nextPage);
    } catch {
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, filterLevel, filterAction]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <p>暂无日志记录</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-1.5">
        {items.map((log) => {
          const lvCfg = levelConfig[log.level] || levelConfig.info;
          const actCfg = actionConfig[log.action];
          const Icon = actCfg?.icon;
          let detail: Record<string, unknown> | null = null;
          try { detail = log.detail ? JSON.parse(log.detail) : null; } catch { /* ignore */ }

          return (
            <div key={log.id} className={`rounded-lg border px-3 py-2.5 ${lvCfg.border}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${lvCfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground flex-shrink-0">
                      {Icon && <Icon className="h-3 w-3" />}
                      {actCfg?.label || log.action}
                    </span>
                    <span className="text-sm truncate">{log.message}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 ml-auto" title={log.createdAt || ""}>
                      {formatDateTimeCST(log.createdAt)}
                    </span>
                  </div>
                  {detail && (
                    <div className="mt-1">
                      <LogDetail action={log.action} detail={detail} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Infinite scroll sentinel — centered */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>
      )}

      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">共 {total} 条记录</p>
      )}
    </div>
  );
}
