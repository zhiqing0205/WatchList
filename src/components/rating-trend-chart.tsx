"use client";

import { Star } from "lucide-react";
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
  currentRating,
  className,
}: {
  data: RatingPoint[];
  currentRating?: number | null;
  className?: string;
}) {
  // No data at all — show current rating + hint
  if (data.length === 0) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <div className="text-sm">
            <span className="font-medium">{currentRating != null ? currentRating.toFixed(1) : "-"}</span>
            <span className="ml-2 text-xs text-muted-foreground">暂无历史数据，将在定时任务后开始记录</span>
          </div>
        </div>
      </div>
    );
  }

  // Only 1 data point — show the single value
  if (data.length === 1) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
          <Star className="h-4 w-4 text-yellow-500" />
          <div className="text-sm">
            <span className="font-medium">{data[0].voteAverage.toFixed(1)}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              首次记录于 {formatDate(data[0].recordedAt)}，更多数据将在后续刷新中采集
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2+ data points — show line chart
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
