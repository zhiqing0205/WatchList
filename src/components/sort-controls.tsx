"use client";

import { useState, useMemo } from "react";
import { ArrowDownUp } from "lucide-react";
import { MediaGrid, type MediaCardItem } from "@/components/media-card";

export type SortField = "rating" | "episodes" | "date";
type SortDir = "asc" | "desc";
export type SortState = { field: SortField; dir: SortDir } | null;

export function getTotalEpisodes(item: MediaCardItem): number {
  if (item.mediaType === "movie") return 1;
  if (!item.tvProgress?.seasonDetails) return 0;
  try {
    const seasons: { season_number: number; episode_count: number }[] =
      JSON.parse(item.tvProgress.seasonDetails);
    return seasons
      .filter((s) => s.season_number > 0)
      .reduce((sum, s) => sum + (s.episode_count || 0), 0);
  } catch {
    return 0;
  }
}

export function getRating(item: MediaCardItem): number {
  return item.rating || item.voteAverage || 0;
}

export function getDate(item: MediaCardItem): string {
  return item.releaseDate || "";
}

const sortFieldDefs: { field: SortField; label: string }[] = [
  { field: "date", label: "播出时间" },
  { field: "rating", label: "评分" },
  { field: "episodes", label: "集数" },
];

export function toggleSortState(prev: SortState, field: SortField): SortState {
  if (!prev || prev.field !== field) return { field, dir: "desc" };
  if (prev.dir === "desc") return { field, dir: "asc" };
  return null;
}

export function sortItems(items: MediaCardItem[], sort: SortState): MediaCardItem[] {
  if (!sort) return items;
  const sorted = [...items];
  const { field, dir } = sort;
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "rating") cmp = getRating(a) - getRating(b);
    else if (field === "episodes") cmp = getTotalEpisodes(a) - getTotalEpisodes(b);
    else if (field === "date") cmp = getDate(a).localeCompare(getDate(b));
    return dir === "desc" ? -cmp : cmp;
  });
  return sorted;
}

export function SortButtons({
  sort,
  onToggle,
}: {
  sort: SortState;
  onToggle: (field: SortField) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {sortFieldDefs.map(({ field, label }) => {
        const active = sort?.field === field;
        return (
          <button
            key={field}
            onClick={() => onToggle(field)}
            className={`inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {label}
            {active && (
              <ArrowDownUp
                className="h-3 w-3"
                style={{
                  transform: sort.dir === "asc" ? "scaleY(-1)" : undefined,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** MediaGrid wrapped with sort controls — for the filtered (non-grouped) view */
export function SortedMediaGrid({ items }: { items: MediaCardItem[] }) {
  const [sort, setSort] = useState<SortState>({ field: "date", dir: "desc" });

  const sortedItems = useMemo(() => sortItems(items, sort), [items, sort]);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <SortButtons
          sort={sort}
          onToggle={(f) => setSort((prev) => toggleSortState(prev, f))}
        />
      </div>
      <MediaGrid items={sortedItems} />
    </div>
  );
}
