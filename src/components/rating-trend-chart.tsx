"use client";

import { Star } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
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
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avg = round1(scores.reduce((a, b) => a + b, 0) / scores.length);
  const padding = 0.3;
  const yMin = round1(Math.max(0, round1(Math.floor(minScore * 10) / 10) - padding));
  const yMax = round1(Math.min(10, round1(Math.ceil(maxScore * 10) / 10) + padding));

  // Find indices of min/max points
  const minIdx = scores.indexOf(minScore);
  const maxIdx = scores.lastIndexOf(maxScore);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 14, right: 28, left: -10, bottom: 0 }}>
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
            tickFormatter={(v: number) => v.toFixed(1)}
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
          <ReferenceLine
            y={avg}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{
              value: `avg ${avg.toFixed(1)}`,
              position: "right",
              fontSize: 9,
              fill: "var(--muted-foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const cx = props.cx as number | undefined;
              const cy = props.cy as number | undefined;
              const index = props.index as number;
              const payload = props.payload as { score: number };
              if (cx == null || cy == null) return <g key={index} />;
              const isMin = index === minIdx && minScore !== maxScore;
              const isMax = index === maxIdx && minScore !== maxScore;
              if (isMin || isMax) {
                return (
                  <g key={index}>
                    <circle cx={cx} cy={cy} r={3.5} fill={isMax ? "#22c55e" : "#ef4444"} stroke="white" strokeWidth={1.5} />
                    <text x={cx} y={cy - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={isMax ? "#22c55e" : "#ef4444"}>
                      {round1(payload.score).toFixed(1)}
                    </text>
                  </g>
                );
              }
              return <circle key={index} cx={cx} cy={cy} r={2} fill="var(--primary)" />;
            }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
