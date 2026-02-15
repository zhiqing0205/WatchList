export const dynamic = "force-dynamic";

import { getDashboardStats } from "@/app/admin/_actions/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tv, Film, Eye, CheckCircle, History } from "lucide-react";
import { formatShortDateCST } from "@/lib/utils";
import Link from "next/link";
import {
  StatusPieChart,
  GenreBarChart,
  RatingBarChart,
  MonthlyAreaChart,
} from "./_components/dashboard-charts";

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

      {/* Row 1: Status pie + Rating distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">影视概览</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart
              byStatus={stats.byStatus}
              total={stats.total}
              tvCount={stats.byType.tv || 0}
              movieCount={stats.byType.movie || 0}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">我的评分分布</CardTitle>
          </CardHeader>
          <CardContent>
            <RatingBarChart data={stats.ratingDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Genre bar + Monthly trend */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">类型 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            <GenreBarChart data={stats.genreDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">近 12 个月新增</CardTitle>
          </CardHeader>
          <CardContent>
            <MonthlyAreaChart data={stats.monthlyAdds} />
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            最近动态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {stats.recentHistory.map((row) => {
              const detail = formatHistoryDetail(
                row.history.action,
                row.history.detail
              );
              return (
                <Link
                  key={row.history.id}
                  href={`/admin/library/${row.history.mediaItemId}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted flex-shrink-0">
                    {row.history.action === "episode_watched" && (
                      <Tv className="h-3.5 w-3.5 text-blue-500" />
                    )}
                    {row.history.action === "movie_watched" && (
                      <Film className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {row.history.action === "status_changed" && (
                      <Eye className="h-3.5 w-3.5 text-yellow-500" />
                    )}
                    {row.history.action === "rating_changed" && (
                      <CheckCircle className="h-3.5 w-3.5 text-purple-500" />
                    )}
                    {row.history.action === "added" && (
                      <Film className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm font-medium">{row.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {actionLabels[row.history.action] || row.history.action}
                      {detail && ` · ${detail}`}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {formatShortDateCST(row.history.createdAt)}
                  </span>
                </Link>
              );
            })}
            {stats.recentHistory.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">暂无记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
