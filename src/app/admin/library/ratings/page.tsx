export const dynamic = "force-dynamic";

import { getAllRatingHistory } from "@/app/admin/_actions/media";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Film, TrendingUp } from "lucide-react";
import { RatingHistoryFeed } from "../_components/rating-history-feed";

export default async function RatingHistoryPage() {
  const data = await getAllRatingHistory({ page: 1, limit: 20 });

  // Count records with changes
  const changedCount = data.items.filter(
    (r) => r.previousVoteAverage != null && Math.round(r.voteAverage * 10) !== Math.round((r.previousVoteAverage as number) * 10)
  ).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">评分历史</h1>
        <span className="text-sm text-muted-foreground">共 {data.total} 条</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">评分记录</p>
              <p className="text-lg font-bold leading-none mt-0.5">{data.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">有变化</p>
              <p className="text-lg font-bold leading-none mt-0.5">{changedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">涉及影视</p>
              <p className="text-lg font-bold leading-none mt-0.5">{data.distinctMediaCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feed */}
      <div className="max-w-4xl mx-auto">
        <RatingHistoryFeed initialItems={data.items} total={data.total} />
      </div>
    </div>
  );
}
