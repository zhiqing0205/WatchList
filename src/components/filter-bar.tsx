"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tag } from "@/db/schema";

const statusFilters = [
  { value: "", label: "全部" },
  { value: "watching", label: "在看" },
  { value: "completed", label: "已看" },
  { value: "planned", label: "想看" },
  { value: "on_hold", label: "搁置" },
];

const typeFilters = [
  { value: "", label: "全部" },
  { value: "tv", label: "剧集" },
  { value: "movie", label: "电影" },
];

export function FilterBar({ tags }: { tags: Tag[] }) {
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "";

  function buildUrl(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    return `/?${params.toString()}`;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">类型:</span>
        {typeFilters.map((filter) => (
          <Link key={filter.value} href={buildUrl("type", filter.value)}>
            <Badge
              variant={currentType === filter.value ? "default" : "outline"}
              className="cursor-pointer"
            >
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground mr-1">状态:</span>
        {statusFilters.map((filter) => (
          <Link key={filter.value} href={buildUrl("status", filter.value)}>
            <Badge
              variant={currentStatus === filter.value ? "default" : "outline"}
              className="cursor-pointer"
            >
              {filter.label}
            </Badge>
          </Link>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">标签:</span>
          {tags.map((tag) => (
            <Link key={tag.id} href={`/tags/${tag.slug}`}>
              <Badge
                variant="outline"
                className="cursor-pointer"
                style={{ borderColor: tag.color || undefined }}
              >
                {tag.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
