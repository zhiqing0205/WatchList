export const dynamic = "force-dynamic";

import { getSystemLogs } from "@/app/admin/_actions/media";
import { Pagination } from "@/components/pagination";
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
  Eye,
} from "lucide-react";

const levelColors: Record<string, string> = {
  info: "bg-blue-500",
  warn: "bg-yellow-500",
  error: "bg-red-500",
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
  // Batch operations with titles
  if ((action === "batch_deleted" || action === "batch_completed") && Array.isArray(detail.titles)) {
    return (
      <div className="flex flex-wrap gap-1">
        {(detail.titles as string[]).map((title, i) => (
          <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{title}</span>
        ))}
      </div>
    );
  }

  // Metadata refresh results
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
        <span className="rounded bg-muted px-2 py-0.5 text-[11px]">
          共 {String(detail.total)}
        </span>
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

  // Status / field changes with from → to
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

  // Fallback: render all key-value pairs
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
  searchParams: Promise<{ page?: string }>;
}

export default async function LogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { items, totalPages, total } = await getSystemLogs(page, 50);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">系统日志</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <p>暂无日志记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((log) => {
            const color = levelColors[log.level] || levelColors.info;
            const action = actionConfig[log.action];
            const Icon = action?.icon;
            let detail: Record<string, unknown> | null = null;
            try {
              detail = log.detail ? JSON.parse(log.detail) : null;
            } catch {
              // ignore
            }

            return (
              <div key={log.id} className="rounded-lg border p-3 space-y-1.5 sm:p-4">
                {/* Header: level + action + time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${color}`} />
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {action?.label || log.action}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap" title={log.createdAt || ""}>
                    {formatDateTimeCST(log.createdAt)}
                  </span>
                </div>

                {/* Message */}
                <p className="text-sm">{log.message}</p>

                {/* Formatted detail */}
                {detail && <LogDetail action={log.action} detail={detail} />}
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/logs" />
    </div>
  );
}
