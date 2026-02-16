export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getMediaItemById, getAllTags, getRatingHistory } from "@/app/admin/_actions/media";
import { getMediaDetails } from "@/lib/tmdb";
import { MediaEditForm } from "./_components/edit-form";
import { RatingTrendChart } from "@/components/rating-trend-chart";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditMediaPage({ params }: Props) {
  const { id } = await params;
  const item = await getMediaItemById(Number(id));

  if (!item) notFound();

  const allTags = await getAllTags();

  // Fetch cast from TMDB
  let cast: { id: number; name: string; character: string; profile_path: string | null }[] = [];
  try {
    const details = await getMediaDetails(
      item.mediaType as "movie" | "tv",
      item.tmdbId
    );
    cast = details.credits?.cast?.slice(0, 20) || [];
  } catch {
    // TMDB fetch may fail, cast is optional
  }

  const ratingHistoryData = await getRatingHistory(item.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">编辑: {item.title}</h1>
      {ratingHistoryData.length >= 2 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">TMDB 评分趋势</p>
          <RatingTrendChart data={ratingHistoryData} className="max-w-md" />
        </div>
      )}
      <MediaEditForm item={item} allTags={allTags} cast={cast} />
    </div>
  );
}
