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
  AreaChart,
  Area,
  CartesianGrid,
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
    <div className="flex items-center gap-4">
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
      <div className="flex flex-col gap-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-semibold">{d.value}</span>
          </div>
        ))}
        <div className="mt-1 border-t pt-1.5 text-[11px] text-muted-foreground">
          剧集 {tvCount} · 电影 {movieCount}
        </div>
      </div>
    </div>
  );
}

interface GenreBarProps {
  data: { genre: string; count: number }[];
}

export function GenreBarChart({ data }: GenreBarProps) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">暂无数据</p>;

  return (
    <ResponsiveContainer width="100%" height={data.length * 28 + 8}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="genre"
          width={72}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: "hsl(var(--accent) / 0.3)" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3b82f6" barSize={16} name="数量" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface RatingBarProps {
  data: { rating: number; count: number }[];
}

export function RatingBarChart({ data }: RatingBarProps) {
  // Fill in all ratings 1-10
  const full = Array.from({ length: 10 }, (_, i) => {
    const r = i + 1;
    const found = data.find((d) => d.rating === r);
    return { rating: `${r}`, count: found?.count || 0 };
  });

  if (data.length === 0) return <p className="text-sm text-muted-foreground">暂无评分</p>;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={full} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
        <XAxis
          dataKey="rating"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: "hsl(var(--accent) / 0.3)" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#eab308" barSize={20} name="数量" />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface MonthlyAreaProps {
  data: { month: string; count: number }[];
}

export function MonthlyAreaChart({ data }: MonthlyAreaProps) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">暂无数据</p>;

  const display = data.map((d) => ({
    ...d,
    label: d.month.slice(5), // "MM" from "YYYY-MM"
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={display} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(l) => `${l}月`}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          fill="url(#colorCount)"
          strokeWidth={2}
          name="新增"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
