export const dynamic = "force-dynamic";

import { getSystemLogs } from "@/app/admin/_actions/media";
import { Pagination } from "@/components/pagination";
import {
  Plus,
  Trash2,
  RefreshCw,
  Timer,
  Layers,
} from "lucide-react";

const levelColors: Record<string, string> = {
  info: "bg-blue-500",
  warn: "bg-yellow-500",
  error: "bg-red-500",
};

const actionConfig: Record<string, { label: string; icon: typeof Plus }> = {
  media_added: { label: "新增影视", icon: Plus },
  media_deleted: { label: "删除影视", icon: Trash2 },
  batch_deleted: { label: "批量删除", icon: Layers },
  metadata_refetched: { label: "更新元数据", icon: RefreshCw },
  cron_metadata_refresh: { label: "定时任务", icon: Timer },
};

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function LogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { items, totalPages, total } = await getSystemLogs(page, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统日志</h1>
        <span className="text-sm text-muted-foreground">共 {total} 条</span>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <p>暂无日志记录</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">级别</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">操作</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">内容</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">时间</th>
              </tr>
            </thead>
            <tbody>
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
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        {Icon && <Icon className="h-3 w-3" />}
                        {action?.label || log.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-sm">{log.message}</span>
                      {detail && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
                            详细信息
                          </summary>
                          <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed max-h-40">
                            {JSON.stringify(detail, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <span className="text-xs text-muted-foreground" title={log.createdAt || ""}>
                        {formatTime(log.createdAt)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/logs" />
    </div>
  );
}
