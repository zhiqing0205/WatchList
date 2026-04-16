export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSystemLogs } from "@/app/admin/_actions/media";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeCST } from "@/lib/utils";
import {
  Plus,
  Trash2,
  RefreshCw,
  Timer,
  Layers,
  Pencil,
  Play,
  CheckCircle2,
  EyeOff,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";

const levelConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Info }> = {
  info: { label: "信息", color: "bg-blue-500", bg: "bg-blue-500/10 text-blue-600", border: "", icon: Info },
  warn: { label: "警告", color: "bg-yellow-500", bg: "bg-yellow-500/10 text-yellow-600", border: "border-l-2 border-l-yellow-500", icon: AlertTriangle },
  error: { label: "错误", color: "bg-red-500", bg: "bg-red-500/10 text-red-600", border: "border-l-2 border-l-red-500", icon: XCircle },
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

  if (action.includes("metadata") && detail.success !== undefined) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600">
          成功 {String(detail.success)}
        </span>
        {Number(detail.failed) > 0 && (
          <span className="rounded bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
            失败 {String(detail.failed)}
          </span>
        )}
        <span className="rounded bg-muted px-2 py-0.5 text-[11px]">共 {String(detail.total)}</span>
        {detail.newRatings !== undefined && Number(detail.newRatings) > 0 && (
          <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-600">
            新增评分 {String(detail.newRatings)}
          </span>
        )}
        {Array.isArray(detail.errors) && detail.errors.length > 0 && (
          <div className="w-full mt-1 space-y-0.5">
            {(detail.errors as string[]).slice(0, 5).map((err, i) => (
              <p key={i} className="text-[11px] text-red-500 truncate">{err}</p>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (detail.from !== undefined || detail.to !== undefined) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {Object.entries(detail).map(([key, value]) => {
          if (value === null || value === undefined) return null;
          return (
            <span key={key} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
              <span className="text-muted-foreground">{key}:</span>{" "}
              <span className="font-medium">{String(value)}</span>
            </span>
          );
        })}
      </div>
    );
  }

  const entries = Object.entries(detail).filter(
    ([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
  );
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
          <span className="text-muted-foreground">{key}:</span>{" "}
          <span className="font-medium">{Array.isArray(value) ? `${value.length} 项` : String(value)}</span>
        </span>
      ))}
    </div>
  );
}

interface Props {
  searchParams: Promise<{ page?: string; level?: string; action?: string }>;
}

export default async function LogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const level = params.level || undefined;
  const action = params.action || undefined;
  const { items, totalPages, total, byLevel } = await getSystemLogs(page, 30, { level, action });

  const totalAll = (byLevel.info || 0) + (byLevel.warn || 0) + (byLevel.error || 0);

  function filterUrl(key: string, value: string | undefined) {
    const p = new URLSearchParams();
    if (level && key !== "level") p.set("level", level);
    if (action && key !== "action") p.set("action", action);
    if (value) p.set(key, value);
    return `/admin/logs${p.toString() ? `?${p.toString()}` : ""}`;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">系统日志</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {/* Level summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {(["info", "warn", "error"] as const).map((lv) => {
          const cfg = levelConfig[lv];
          const LvIcon = cfg.icon;
          const count = byLevel[lv] || 0;
          return (
            <Link key={lv} href={filterUrl("level", level === lv ? undefined : lv)}>
              <Card className={`transition-colors hover:bg-accent/50 ${level === lv ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <LvIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    <p className="text-lg font-bold leading-none mt-0.5">{count}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {level && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">筛选:</span>
          <Link href={filterUrl("level", undefined)}>
            <Badge variant="default" className="cursor-pointer gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${levelConfig[level]?.color}`} />
              {levelConfig[level]?.label}
              <span className="ml-1 text-[10px] opacity-70">✕</span>
            </Badge>
          </Link>
        </div>
      )}

      {/* Log entries */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <p>暂无日志记录</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-2">
          {items.map((log) => {
            const lvCfg = levelConfig[log.level] || levelConfig.info;
            const actCfg = actionConfig[log.action];
            const Icon = actCfg?.icon;
            let detail: Record<string, unknown> | null = null;
            try {
              detail = log.detail ? JSON.parse(log.detail) : null;
            } catch {
              // ignore
            }

            return (
              <div key={log.id} className={`rounded-lg border p-3 space-y-1.5 ${lvCfg.border}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${lvCfg.color}`} />
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {actCfg?.label || log.action}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap" title={log.createdAt || ""}>
                    {formatDateTimeCST(log.createdAt)}
                  </span>
                </div>
                <p className="text-sm">{log.message}</p>
                {detail && <LogDetail action={log.action} detail={detail} />}
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} baseUrl={filterUrl("page", undefined)} />
    </div>
  );
}
