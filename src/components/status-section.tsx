"use client";

import { useState, useMemo } from "react";
import { Eye, CheckCircle, Clock, Pause, ArrowDownUp } from "lucide-react";
import { MediaGrid, type MediaCardItem } from "@/components/media-card";

const statusIcons: Record<string, React.ReactNode> = {
  watching: <Eye className="h-5 w-5 text-blue-400" />,
  completed: <CheckCircle className="h-5 w-5 text-green-400" />,
  planned: <Clock className="h-5 w-5 text-yellow-400" />,
  on_hold: <Pause className="h-5 w-5 text-gray-400" />,
};

type SortField = "rating" | "episodes" | "date";
type SortDir = "asc" | "desc";
type SortState = { field: SortField; dir: SortDir } | null;

function getTotalEpisodes(item: MediaCardItem): number {
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

function getRating(item: MediaCardItem): number {
  return item.rating || item.voteAverage || 0;
}

function getDate(item: MediaCardItem): string {
  return item.releaseDate || "";
}

const sortFields: { field: SortField; label: string }[] = [
  { field: "rating", label: "评分" },
  { field: "date", label: "上映时间" },
  { field: "episodes", label: "集数" },
];

interface StatusSectionProps {
  status: string;
  label: string;
  items: MediaCardItem[];
  total: number;
}

export function StatusSection({ status, label, items, total }: StatusSectionProps) {
  const [sort, setSort] = useState<SortState>({ field: "date", dir: "desc" });

  const toggleSort = (field: SortField) => {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, dir: "desc" };
      if (prev.dir === "desc") return { field, dir: "asc" };
      return null;
    });
  };

  const sortedItems = useMemo(() => {
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
  }, [items, sort]);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          {statusIcons[status]}
          {label}
          <span className="text-sm font-normal text-muted-foreground">
            {total}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          {sortFields.map(({ field, label: fieldLabel }) => {
            const active = sort?.field === field;
            return (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {fieldLabel}
                {active && (
                  <ArrowDownUp className="h-3 w-3" style={{ transform: sort.dir === "asc" ? "scaleY(-1)" : undefined }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <MediaGrid
        items={sortedItems}
        maxRows={3}
        overflowHref={`/?status=${status}`}
        overflowTotal={total}
      />
    </section>
  );
}
