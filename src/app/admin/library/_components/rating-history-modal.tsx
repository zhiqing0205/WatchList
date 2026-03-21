"use client";

import { useState, useEffect } from "react";
import { Star, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { getRatingHistory } from "@/app/admin/_actions/media";

interface RatingHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaItemId: number;
  title: string;
  currentRating: number | null;
}

interface RatingPoint {
  id: number;
  voteAverage: number;
  recordedAt: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "Z");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function RatingHistoryModal({
  open,
  onOpenChange,
  mediaItemId,
  title,
  currentRating,
}: RatingHistoryModalProps) {
  const [data, setData] = useState<RatingPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getRatingHistory(mediaItemId)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [open, mediaItemId]);

  const chartData = data.map((d) => ({
    date: formatShortDate(d.recordedAt),
    score: d.voteAverage,
  }));

  const scores = chartData.map((d) => d.score);
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const maxScore = scores.length > 0 ? Math.max(...scores) : 10;
  const avg = scores.length > 0 ? round1(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const padding = 0.3;
  const yMin = round1(Math.max(0, round1(Math.floor(minScore * 10) / 10) - padding));
  const yMax = round1(Math.min(10, round1(Math.ceil(maxScore * 10) / 10) + padding));

  // Find indices of min/max points
  const minIdx = scores.indexOf(minScore);
  const maxIdx = scores.lastIndexOf(maxScore);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-yellow-500" />
            {title} - 评分历史
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p>暂无评分历史</p>
            <p className="mt-1 text-xs">评分数据将在定时任务后开始记录</p>
            {currentRating != null && (
              <p className="mt-3 text-lg font-semibold">{currentRating.toFixed(1)}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Line chart */}
            {data.length >= 2 && (
              <div className="rounded-lg border bg-card p-3">
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 14, right: 32, left: -10, bottom: 0 }}>
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
                      tickCount={4}
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
                      formatter={(value: number | undefined) => [
                        value != null ? value.toFixed(1) : "-",
                        "评分",
                      ]}
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
                              <circle cx={cx} cy={cy} r={4} fill={isMax ? "#22c55e" : "#ef4444"} stroke="white" strokeWidth={1.5} />
                              <text x={cx} y={cy - 10} textAnchor="middle" fontSize={10} fontWeight={600} fill={isMax ? "#22c55e" : "#ef4444"}>
                                {round1(payload.score).toFixed(1)}
                              </text>
                            </g>
                          );
                        }
                        return <circle key={index} cx={cx} cy={cy} r={3} fill="var(--primary)" />;
                      }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Table */}
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">时间</th>
                    <th className="px-3 py-2 text-right font-medium">评分</th>
                    <th className="px-3 py-2 text-right font-medium">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((point, idx) => {
                    const reversedIdx = data.length - 1 - idx;
                    const prev = reversedIdx > 0 ? data[reversedIdx - 1] : null;
                    const diff = prev
                      ? point.voteAverage - prev.voteAverage
                      : null;
                    const diffRounded = diff !== null ? round1(diff) : null;

                    return (
                      <tr
                        key={point.id}
                        className="border-t transition-colors hover:bg-accent/50"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {formatDate(point.recordedAt)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium">
                          {point.voteAverage.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {diffRounded === null ? (
                            <span className="text-xs text-muted-foreground">--</span>
                          ) : diffRounded > 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
                              <TrendingUp className="h-3 w-3" />
                              +{diffRounded.toFixed(1)}
                            </span>
                          ) : diffRounded < 0 ? (
                            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-500">
                              <TrendingDown className="h-3 w-3" />
                              {diffRounded.toFixed(1)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                              <Minus className="h-3 w-3" />
                              0.0
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
