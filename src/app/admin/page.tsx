export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/app/admin/_actions/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, Eye, CheckCircle, Clock, Pause, XCircle, History } from "lucide-react";
import { formatShortDateCST } from "@/lib/utils";
import Link from "next/link";

const statusIcons: Record<string, React.ReactNode> = {
  watching: <Eye className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  planned: <Clock className="h-4 w-4 text-yellow-500" />,
  on_hold: <Pause className="h-4 w-4 text-gray-500" />,
  dropped: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  on_hold: "搁置",
  dropped: "弃剧",
};

const actionLabels: Record<string, string> = {
  episode_watched: "更新进度",
  movie_watched: "观影记录",
  status_changed: "状态变更",
  rating_changed: "评分变更",
  added: "新增影视",
};

function formatHistoryDetail(action: string, detail: string | null): string {
  if (!detail) return "";
  try {
    const d = JSON.parse(detail);
    switch (action) {
      case "episode_watched":
        return d.to ? `→ ${d.to}` : "";
      case "movie_watched":
        return d.watched ? "标记已看" : "标记未看";
      case "status_changed":
        return `${statusLabels[d.from] || d.from} → ${statusLabels[d.to] || d.to}`;
      case "rating_changed":
        return `${d.from || "无"} → ${d.to || "无"}`;
      case "added":
        return d.mediaType === "tv" ? "添加剧集" : "添加电影";
      default:
        return "";
    }
  } catch {
    return "";
  }
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总数</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">剧集</CardTitle>
            <Tv className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byType.tv || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">电影</CardTitle>
            <Film className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byType.movie || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">在看</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byStatus.watching || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">状态分布</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(statusLabels).map(([status, label]) => (
              <div key={status} className="flex items-center gap-2">
                {statusIcons[status]}
                <span className="text-sm">{label}</span>
                <span className="text-sm font-bold">{stats.byStatus[status] || 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent history timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            追剧记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentHistory.map((row) => {
              const detail = formatHistoryDetail(
                row.history.action,
                row.history.detail
              );
              return (
                <Link
                  key={row.history.id}
                  href={`/admin/library/${row.history.mediaItemId}`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
                    {row.history.action === "episode_watched" && (
                      <Tv className="h-4 w-4 text-blue-500" />
                    )}
                    {row.history.action === "movie_watched" && (
                      <Film className="h-4 w-4 text-green-500" />
                    )}
                    {row.history.action === "status_changed" && (
                      <Eye className="h-4 w-4 text-yellow-500" />
                    )}
                    {row.history.action === "rating_changed" && (
                      <CheckCircle className="h-4 w-4 text-purple-500" />
                    )}
                    {row.history.action === "added" && (
                      <Film className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {actionLabels[row.history.action] || row.history.action}
                      {detail && ` · ${detail}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatShortDateCST(row.history.createdAt)}
                  </span>
                </Link>
              );
            })}
            {stats.recentHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无记录，去搜索添加吧</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
