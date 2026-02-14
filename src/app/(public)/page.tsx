export const dynamic = "force-dynamic";

import { Suspense } from "react";
import {
  getMediaItemsWithProgress,
  getMediaItemsGroupedByStatus,
  getAllTags,
} from "@/app/admin/_actions/media";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusSection } from "@/components/status-section";
import { SortedMediaGrid } from "@/components/sort-controls";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  on_hold: "搁置",
  dropped: "弃剧",
};

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

  const tags = await getAllTags();

  // If filters are applied, show flat paginated view
  const isFiltered = !!status || !!mediaType || page > 1;

  if (isFiltered) {
    const { items, totalPages } = await getMediaItemsWithProgress({
      status,
      mediaType,
      page,
      limit: 20,
      visibleOnly: true,
    });

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
          <SortedMediaGrid items={items} />
        </div>
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          baseUrl={baseUrl}
        />
      </div>
    );
  }

  // Default: grouped by status
  const groups = await getMediaItemsGroupedByStatus({
    mediaType,
    visibleOnly: true,
    limit: 15,
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <FilterBar tags={tags} hideStatus />
      </Suspense>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg">暂无影视内容</p>
          <p className="text-sm">稍后再来看看吧</p>
        </div>
      ) : (
        <div className="mt-6 space-y-10">
          {groups.map((group) => (
            <StatusSection
              key={group.status}
              status={group.status}
              label={statusLabels[group.status] || group.status}
              items={group.items}
              total={group.total}
            />
          ))}
        </div>
      )}
    </div>
  );
}
