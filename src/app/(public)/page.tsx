export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getMediaItemsWithProgress, getAllTags } from "@/app/admin/_actions/media";
import { MediaGrid } from "@/components/media-card";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  searchParams: Promise<{
    status?: string;
    type?: string;
    page?: string;
  }>;
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status = params.status || undefined;
  const mediaType = params.type || undefined;

  const [{ items, totalPages }, tags] = await Promise.all([
    getMediaItemsWithProgress({ status, mediaType, page, limit: 20, visibleOnly: true }),
    getAllTags(),
  ]);

  const urlParams = new URLSearchParams();
  if (status) urlParams.set("status", status);
  if (mediaType) urlParams.set("type", mediaType);
  const baseUrl = `/${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <FilterBar tags={tags} />
      </Suspense>
      <div className="mt-6">
        <MediaGrid items={items} />
      </div>
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
