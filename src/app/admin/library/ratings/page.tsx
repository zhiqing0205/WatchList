export const dynamic = "force-dynamic";

import { getAllRatingHistory } from "@/app/admin/_actions/media";
import { RatingHistoryFeed } from "../_components/rating-history-feed";

export default async function RatingHistoryPage() {
  const data = await getAllRatingHistory({ page: 1, limit: 20 });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold sm:text-2xl">评分历史</h1>
        <span className="text-sm text-muted-foreground">共 {data.total} 条</span>
      </div>
      <RatingHistoryFeed initialItems={data.items} total={data.total} />
    </div>
  );
}
