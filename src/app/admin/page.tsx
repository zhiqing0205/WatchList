import { getDashboardStats } from "@/app/admin/_actions/media";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Film, Tv, Eye, CheckCircle, Clock, Pause, XCircle } from "lucide-react";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import Image from "next/image";

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

      {/* Recent items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近更新</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recent.map((item) => (
              <Link
                key={item.id}
                href={`/admin/library/${item.id}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-accent"
              >
                <div className="relative h-12 w-8 flex-shrink-0 overflow-hidden rounded">
                  <Image
                    src={getImageUrl(item.posterPath, "w92")}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.mediaType === "tv" ? "剧集" : "电影"} · {statusLabels[item.status]}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{item.updatedAt}</span>
              </Link>
            ))}
            {stats.recent.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无内容，去搜索添加吧</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
