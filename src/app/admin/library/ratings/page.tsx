export const dynamic = "force-dynamic";

import { getAllRatingHistory } from "@/app/admin/_actions/media";
import { RatingHistoryFeed } from "../_components/rating-history-feed";

export default async function RatingHistoryPage() {
  const data = await getAllRatingHistory({ page: 1, limit: 20 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">评分历史</h1>
      <RatingHistoryFeed initialItems={data.items} total={data.total} />
    </div>
  );
}
