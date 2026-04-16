export const dynamic = "force-dynamic";

import Link from "next/link";
import { getSystemLogs } from "@/app/admin/_actions/media";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, AlertTriangle, XCircle } from "lucide-react";
import { LogFeed } from "./_components/log-feed";

const levelConfig: Record<string, { label: string; color: string; bg: string; icon: typeof Info }> = {
  info: { label: "信息", color: "bg-blue-500", bg: "bg-blue-500/10 text-blue-600", icon: Info },
  warn: { label: "警告", color: "bg-yellow-500", bg: "bg-yellow-500/10 text-yellow-600", icon: AlertTriangle },
  error: { label: "错误", color: "bg-red-500", bg: "bg-red-500/10 text-red-600", icon: XCircle },
};

interface Props {
  searchParams: Promise<{ level?: string; action?: string }>;
}

export default async function LogsPage({ searchParams }: Props) {
  const params = await searchParams;
  const level = params.level || undefined;
  const action = params.action || undefined;
  const { items, total, byLevel } = await getSystemLogs(1, 30, { level, action });

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

      {/* Log feed with infinite scroll */}
      <LogFeed initialItems={items} total={total} filterLevel={level} filterAction={action} />
    </div>
  );
}
