"use client";

import { useRouter } from "next/navigation";
import { STATUS_HEX_COLORS, STATUS_LABELS } from "@/lib/status";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

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
      label: STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status,
      value: count,
      color: STATUS_HEX_COLORS[status as keyof typeof STATUS_HEX_COLORS] || "#94a3b8",
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
      <div className="relative h-44 w-44">
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
  const filtered = data.filter((d) => d.count > 1);

  if (filtered.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        暂无标签数据
      </p>
    );
  }

  const max = Math.max(...filtered.map((d) => d.count));

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((item) => {
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

// Monthly additions area chart
export function MonthlyAddChart({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无数据</p>;
  }

  const chartData = data.map((d) => ({
    month: d.month.substring(5),
    count: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="month" tick={{ fontSize: 11, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--card-foreground)", fontSize: "12px" }}
          formatter={(value: number | undefined) => [value ?? 0, "入库"]}
        />
        <Area type="monotone" dataKey="count" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Rating distribution bar chart (user ratings 1-10)
export function RatingDistChart({ data }: { data: { rating: number; count: number }[] }) {
  const full = Array.from({ length: 10 }, (_, i) => {
    const r = i + 1;
    const found = data.find((d) => d.rating === r);
    return { rating: String(r), count: found?.count || 0 };
  });

  if (data.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">暂无评分数据</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={full} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="rating" tick={{ fontSize: 11, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, className: "fill-muted-foreground" }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--card-foreground)", fontSize: "12px" }}
          formatter={(value: number | undefined) => [value ?? 0, "部"]}
        />
        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} fillOpacity={0.8} />
      </BarChart>
    </ResponsiveContainer>
  );
}
