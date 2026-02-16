"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RatingPoint {
  voteAverage: number;
  recordedAt: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function RatingTrendChart({
  data,
  className,
}: {
  data: RatingPoint[];
  className?: string;
}) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    date: formatDate(d.recordedAt),
    score: d.voteAverage,
  }));

  const scores = chartData.map((d) => d.score);
  const min = Math.floor(Math.min(...scores) * 10) / 10;
  const max = Math.ceil(Math.max(...scores) * 10) / 10;
  const padding = 0.2;
  const yMin = Math.max(0, min - padding);
  const yMax = Math.min(10, max + padding);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, className: "fill-muted-foreground" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 10, className: "fill-muted-foreground" }}
            tickLine={false}
            axisLine={false}
            tickCount={3}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              color: "var(--card-foreground)",
              fontSize: "12px",
            }}
            formatter={(value: number | undefined) => [value != null ? value.toFixed(1) : "-", "评分"]}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--primary)" }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
