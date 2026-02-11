export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { getMediaItemsWithProgress } from "@/app/admin/_actions/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/pagination";
import { Plus } from "lucide-react";
import { LibraryList } from "./_components/library-list";
import { LibrarySearch } from "./_components/library-search";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

interface Props {
  searchParams: Promise<{ page?: string; status?: string; type?: string; search?: string }>;
}

export default async function LibraryPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const { items, totalPages } = await getMediaItemsWithProgress({
    page,
    status: params.status,
    mediaType: params.type,
    search: params.search,
    limit: 20,
  });

  const urlParams = new URLSearchParams();
  if (params.status) urlParams.set("status", params.status);
  if (params.type) urlParams.set("type", params.type);
  if (params.search) urlParams.set("search", params.search);
  const baseUrl = `/admin/library${urlParams.toString() ? `?${urlParams.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">影视管理</h1>
        <Button asChild>
          <Link href="/admin/search">
            <Plus className="mr-2 h-4 w-4" />
            添加影视
          </Link>
        </Button>
      </div>

      {/* Search bar */}
      <Suspense>
        <LibrarySearch />
      </Suspense>

      {/* Filter links */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/library">
          <Badge variant={!params.status && !params.type ? "default" : "outline"}>全部</Badge>
        </Link>
        {Object.entries(statusLabels).map(([value, label]) => (
          <Link key={value} href={`/admin/library?status=${value}`}>
            <Badge variant={params.status === value ? "default" : "outline"}>
              {label}
            </Badge>
          </Link>
        ))}
        <span className="mx-2 border-l" />
        <Link href="/admin/library?type=tv">
          <Badge variant={params.type === "tv" ? "default" : "outline"}>剧集</Badge>
        </Link>
        <Link href="/admin/library?type=movie">
          <Badge variant={params.type === "movie" ? "default" : "outline"}>电影</Badge>
        </Link>
      </div>

      {/* Media list with checkboxes */}
      <LibraryList items={items} />

      <Pagination currentPage={page} totalPages={totalPages} baseUrl={baseUrl} />
    </div>
  );
}
