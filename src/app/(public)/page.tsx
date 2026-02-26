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
import { SortButtons } from "@/components/sort-controls";
import { MediaGrid } from "@/components/media-card";

const statusLabels: Record<string, string> = {
  airing: "热映中",
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
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const status = params.status || undefined;
  const mediaType = params.type || undefined;
  const search = params.q || undefined;
  const sort = params.sort || "date";
  const dir = params.dir || "desc";

  const tags = await getAllTags();

  // If filters are applied, show flat paginated view
  const isFiltered = !!status || !!mediaType || !!search || page > 1;

  if (isFiltered) {
    const { items, totalPages } = await getMediaItemsWithProgress({
      status,
      mediaType,
      search,
      page,
      limit: 20,
      visibleOnly: true,
      sortField: sort,
      sortDir: dir,
    });

    const urlParams = new URLSearchParams();
    if (status) urlParams.set("status", status);
    if (mediaType) urlParams.set("type", mediaType);
    if (search) urlParams.set("q", search);
    if (sort !== "date") urlParams.set("sort", sort);
    if (dir !== "desc") urlParams.set("dir", dir);
    const baseUrl = `/${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

    return (
      <div className="container mx-auto px-4 py-6">
        <Suspense fallback={<Skeleton className="h-20 w-full" />}>
          <FilterBar tags={tags} />
        </Suspense>
        {search && (
          <p className="mt-4 text-sm text-muted-foreground">
            搜索「{search}」找到 {items.length === 0 ? "0" : totalPages > 1 ? `${totalPages} 页` : `${items.length}`} 个结果
          </p>
        )}
        <div className="mt-6">
          <div className="mb-4 flex justify-end">
            <Suspense fallback={null}>
              <SortButtons />
            </Suspense>
          </div>
          <MediaGrid items={items} />
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
    sortField: sort,
    sortDir: dir,
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
        <>
          <div className="mt-6 flex justify-end">
            <Suspense fallback={null}>
              <SortButtons />
            </Suspense>
          </div>
          <div className="mt-4 space-y-10">
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
        </>
      )}
    </div>
  );
}
