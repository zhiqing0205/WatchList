"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

// Use Tailwind class on SVG text so it adapts to light/dark theme
function ThemedTick({ x, y, payload, textAnchor, width }: any) {
  const maxChars = Math.floor((width || 90) / 6.5);
  let label = payload.value || "";
  if (label.length > maxChars) {
    label = label.slice(0, maxChars - 1) + "…";
  }
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor || "end"}
      className="fill-muted-foreground text-[11px]"
    >
      {label}
    </text>
  );
}

interface StatusPieProps {
  byStatus: Record<string, number>;
  total: number;
  tvCount: number;
  movieCount: number;
}

export function StatusPieChart({ byStatus, total, tvCount, movieCount }: StatusPieProps) {
  const data = Object.entries(byStatus).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    color: STATUS_COLORS[status] || "#94a3b8",
  }));

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <div className="relative h-36 w-36 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={65}
              dataKey="value"
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground">总计</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-sm">
            <span
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
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

interface GenreBarProps {
  data: { genre: string; count: number }[];
}

export function GenreBarChart({ data }: GenreBarProps) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">暂无数据</p>;

  const chartHeight = Math.max(data.length * 28 + 8, 160);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 2, bottom: 2 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="genre"
          width={100}
          tick={<ThemedTick width={100} />}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--card-foreground)",
          }}
          cursor={{ fill: "var(--accent)", opacity: 0.3 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3b82f6" barSize={16} name="数量" />
      </BarChart>
    </ResponsiveContainer>
  );
}
