"use client";

import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  watching: "#3b82f6",
  completed: "#22c55e",
  planned: "#eab308",
  on_hold: "#6b7280",
  dropped: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  on_hold: "搁置",
  dropped: "弃剧",
};

interface StatusPieProps {
  byStatus: Record<string, number>;
  total: number;
  tvCount: number;
  movieCount: number;
}

export function StatusPieChart({ byStatus, total, tvCount, movieCount }: StatusPieProps) {
  const data = Object.entries(byStatus)
    .map(([status, count]) => ({
      key: status,
      label: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || "#94a3b8",
    }))
    .filter((d) => d.value > 0);

  // Build conic-gradient segments
  let accumulated = 0;
  const segments = data.map((d) => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const start = accumulated;
    accumulated += pct;
    return { ...d, start, end: accumulated };
  });

  const gradient =
    segments.length > 0
      ? segments
          .map((s) => `${s.color} ${s.start}% ${s.end}%`)
          .join(", ")
      : "#e5e7eb 0% 100%";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Donut with center label */}
      <div className="relative h-40 w-40">
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
            WebkitMask: "radial-gradient(farthest-side, transparent 58%, #000 59%)",
            mask: "radial-gradient(farthest-side, transparent 58%, #000 59%)",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold leading-none">{total}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">总计</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="font-semibold">{d.value}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        剧集 {tvCount} · 电影 {movieCount}
      </div>
    </div>
  );
}

interface TagBarProps {
  data: { name: string; color: string | null; count: number }[];
}

export function TagBarChart({ data }: TagBarProps) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        暂无标签数据
      </p>
    );
  }

  const max = Math.max(...data.map((d) => d.count));

  return (
    <div className="flex flex-col gap-2">
      {data.map((item) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        return (
          <button
            key={item.name}
            onClick={() =>
              router.push(`/admin/library?tag=${encodeURIComponent(item.name)}`)
            }
            className="group flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent/50"
          >
            <span className="w-16 flex-shrink-0 truncate text-xs text-muted-foreground group-hover:text-foreground">
              {item.name}
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || "#6366f1",
                  minWidth: pct > 0 ? "4px" : "0",
                }}
              />
            </div>
            <span className="w-6 flex-shrink-0 text-right text-xs font-medium tabular-nums">
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
