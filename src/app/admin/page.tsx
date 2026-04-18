export const dynamic = "force-dynamic";

import Image from "next/image";
import { getDashboardStats } from "@/app/admin/_actions/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tv, Film, Eye, CheckCircle, History, Plus, BarChart3, CloudUpload, Star } from "lucide-react";
import { formatShortDateCST, formatDateTimeCST } from "@/lib/utils";
import { getImageUrl } from "@/lib/tmdb";
import Link from "next/link";
import {
  StatusPieChart,
  TagBarChart,
  MonthlyAddChart,
  RatingDistChart,
} from "./_components/dashboard-charts";
import { STATUS_LABELS, STATUS_BADGE_COLORS } from "@/lib/status";

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
  rating_changed: { icon: Star, color: "text-purple-500" },
  added: { icon: Plus, color: "text-primary" },
};

function HistoryDetail({ action, detail }: { action: string; detail: string | null }) {
  if (!detail) return null;
  try {
    const d = JSON.parse(detail);
    switch (action) {
      case "episode_watched":
        return (
          <div className="flex items-center gap-1.5">
            {d.from && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{d.from}</span>}
            {d.from && <span className="text-[11px] text-muted-foreground">→</span>}
            <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary">{d.to}</span>
          </div>
        );
      case "status_changed": {
        const fromLabel = STATUS_LABELS[d.from as keyof typeof STATUS_LABELS] || d.from;
        const toLabel = STATUS_LABELS[d.to as keyof typeof STATUS_LABELS] || d.to;
        const fromColor = STATUS_BADGE_COLORS[d.from as keyof typeof STATUS_BADGE_COLORS] || "bg-gray-500";
        const toColor = STATUS_BADGE_COLORS[d.to as keyof typeof STATUS_BADGE_COLORS] || "bg-gray-500";
        return (
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${fromColor}`}>{fromLabel}</span>
            <span className="text-[11px] text-muted-foreground">→</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${toColor}`}>{toLabel}</span>
          </div>
        );
      }
      case "movie_watched":
        return (
          <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${d.watched ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}`}>
            {d.watched ? "标记已看" : "标记未看"}
          </span>
        );
      case "rating_changed":
        return (
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{d.from ?? "无"}</span>
            <span className="text-[11px] text-muted-foreground">→</span>
            <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-medium text-purple-600">{d.to ?? "无"}</span>
          </div>
        );
      case "added":
        return (
          <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {d.mediaType === "tv" ? "添加剧集" : "添加电影"}
          </span>
        );
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">影视总数</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-0.5">剧集 {stats.byType.tv || 0} · 电影 {stats.byType.movie || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">近七日入库</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent7dAdded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">近七日看完</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent7dCompleted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">上次备份</CardTitle>
            <CloudUpload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {stats.lastBackupTime ? formatDateTimeCST(stats.lastBackupTime) : "未备份"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts: asymmetric 3+2 grid on lg, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left column: trend charts */}
        <div className="space-y-4 lg:col-span-3">
          <Card className="gap-2 py-3">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-medium">月度入库趋势</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <MonthlyAddChart data={stats.monthlyAdds} />
            </CardContent>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-medium">TMDB 评分分布</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <RatingDistChart data={stats.ratingDistribution} />
            </CardContent>
          </Card>
        </div>

        {/* Right column: distributions */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="gap-2 py-3">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-medium">状态分布</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <StatusPieChart
                byStatus={stats.byStatus}
                total={stats.total}
                tvCount={stats.byType.tv || 0}
                movieCount={stats.byType.movie || 0}
              />
            </CardContent>
          </Card>
          <Card className="gap-2 py-3">
            <CardHeader className="px-4 pb-0">
              <CardTitle className="text-sm font-medium">标签分布</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-2">
              <TagBarChart data={stats.tagDistribution} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent activity — 2-column grid on lg */}
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <History className="h-4 w-4" />
          最近动态
        </h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {stats.recentHistory.map((row) => {
            const iconCfg = actionIcons[row.history.action];
            const Icon = iconCfg?.icon || Film;
            const iconColor = iconCfg?.color || "text-muted-foreground";

            return (
              <Link
                key={row.history.id}
                href={`/admin/library/${row.history.mediaItemId}`}
                className="flex gap-3 rounded-lg border p-2.5 transition-colors hover:bg-accent/30"
              >
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-md sm:h-16 sm:w-11">
                  {row.posterPath ? (
                    <Image
                      src={getImageUrl(row.posterPath, "w92")}
                      alt={row.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <Film className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <span className="flex-shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      {row.mediaType === "tv" ? "剧集" : "电影"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 flex-shrink-0 ${iconColor}`} />
                    <span className="text-[11px] font-medium">
                      {actionLabels[row.history.action] || row.history.action}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatShortDateCST(row.history.createdAt)}</span>
                  </div>
                  <HistoryDetail action={row.history.action} detail={row.history.detail} />
                </div>
              </Link>
            );
          })}
          {stats.recentHistory.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground col-span-full">暂无记录</p>
          )}
        </div>
      </div>
    </div>
  );
}
