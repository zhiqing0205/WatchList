export const dynamic = "force-dynamic";

import Image from "next/image";
import { getDashboardStats } from "@/app/admin/_actions/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tv, Film, Eye, CheckCircle, History, Layers } from "lucide-react";
import { formatShortDateCST } from "@/lib/utils";
import { getImageUrl } from "@/lib/tmdb";
import Link from "next/link";
import {
  StatusPieChart,
  GenreBarChart,
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

const actionIcons: Record<string, { icon: typeof Tv; color: string }> = {
  episode_watched: { icon: Tv, color: "text-blue-500" },
  movie_watched: { icon: Film, color: "text-green-500" },
  status_changed: { icon: Eye, color: "text-yellow-500" },
  rating_changed: { icon: CheckCircle, color: "text-purple-500" },
  added: { icon: Film, color: "text-primary" },
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

      {/* Top stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总数</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
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

      {/* Charts: Status pie + Genre bar */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">状态分布</CardTitle>
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
            <CardTitle className="text-sm font-medium">类型 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            <GenreBarChart data={stats.genreDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Recent activity with posters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            最近动态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {stats.recentHistory.map((row) => {
              const detail = formatHistoryDetail(
                row.history.action,
                row.history.detail
              );
              const iconCfg = actionIcons[row.history.action];
              const Icon = iconCfg?.icon || Film;
              const iconColor = iconCfg?.color || "text-muted-foreground";

              return (
                <Link
                  key={row.history.id}
                  href={`/admin/library/${row.history.mediaItemId}`}
                  className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0 hover:bg-accent/30 -mx-2 px-2 rounded transition-colors"
                >
                  {/* Poster thumbnail */}
                  <div className="relative h-12 w-8 flex-shrink-0 overflow-hidden rounded">
                    {row.posterPath ? (
                      <Image
                        src={getImageUrl(row.posterPath, "w92")}
                        alt={row.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Film className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">{row.title}</p>
                    <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                      <Icon className={`inline h-3 w-3 mr-0.5 align-text-bottom ${iconColor}`} />
                      {actionLabels[row.history.action] || row.history.action}
                      {detail && (
                        <span className="ml-1 font-medium text-foreground/70">{detail}</span>
                      )}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="text-[11px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {formatShortDateCST(row.history.createdAt)}
                  </span>
                </Link>
              );
            })}
            {stats.recentHistory.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">暂无记录</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
