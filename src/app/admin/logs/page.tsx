export const dynamic = "force-dynamic";

import { getSystemLogs } from "@/app/admin/_actions/media";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";

const levelConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  info: { label: "信息", variant: "secondary" },
  warn: { label: "警告", variant: "outline" },
  error: { label: "错误", variant: "destructive" },
};

const actionLabels: Record<string, string> = {
  media_added: "新增影视",
  media_deleted: "删除影视",
  batch_deleted: "批量删除",
  metadata_refetched: "更新元数据",
  cron_metadata_refresh: "定时任务",
};

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function LogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { items, totalPages } = await getSystemLogs(page, 50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统日志</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-muted-foreground">
          <p>暂无日志记录</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((log) => {
            const level = levelConfig[log.level] || levelConfig.info;
            let detail: Record<string, unknown> | null = null;
            try {
              detail = log.detail ? JSON.parse(log.detail) : null;
            } catch {
              // ignore
            }

            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <Badge variant={level.variant} className="mt-0.5 flex-shrink-0 text-[10px]">
                  {level.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {actionLabels[log.action] || log.action}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {log.createdAt}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm">{log.message}</p>
                  {detail && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground">
                        详细信息
                      </summary>
                      <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed">
                        {JSON.stringify(detail, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} baseUrl="/admin/logs" />
    </div>
  );
}
