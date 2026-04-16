export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { getMediaItemsWithProgress } from "@/app/admin/_actions/media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Tags } from "lucide-react";
import { LibraryList } from "./_components/library-list";
import { LibrarySearch } from "./_components/library-search";
import { AddMediaButton } from "./_components/search-media-dialog";
import { STATUS_LABELS } from "@/lib/status";

interface Props {
  searchParams: Promise<{ page?: string; status?: string; type?: string; search?: string; genre?: string; tag?: string }>;
}

export default async function LibraryPage({ searchParams }: Props) {
  const params = await searchParams;
  const { items, total } = await getMediaItemsWithProgress({
    page: 1,
    status: params.status,
    mediaType: params.type,
    search: params.search,
    genre: params.genre,
    tag: params.tag,
    limit: 20,
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold sm:text-2xl">影视管理</h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button asChild variant="outline" size="sm" className="sm:size-default">
            <Link href="/admin/library/tags">
              <Tags className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">标签管理</span>
            </Link>
          </Button>
          <AddMediaButton />
        </div>
      </div>

      {/* Search bar */}
      <Suspense>
        <LibrarySearch />
      </Suspense>

      {/* Filter links */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <Link href="/admin/library">
          <Badge variant={!params.status && !params.type ? "default" : "outline"}>全部</Badge>
        </Link>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
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
        {params.genre && (
          <>
            <span className="mx-2 border-l" />
            <Link href="/admin/library">
              <Badge variant="default" className="gap-1">
                类型: {params.genre} ✕
              </Badge>
            </Link>
          </>
        )}
        {params.tag && (
          <>
            <span className="mx-2 border-l" />
            <Link href="/admin/library">
              <Badge variant="default" className="gap-1">
                标签: {params.tag} ✕
              </Badge>
            </Link>
          </>
        )}
      </div>

      {/* Media list with infinite scroll */}
      <LibraryList
        initialItems={items}
        total={total}
        filterStatus={params.status}
        filterType={params.type}
        filterSearch={params.search}
        filterGenre={params.genre}
        filterTag={params.tag}
      />
    </div>
  );
}
