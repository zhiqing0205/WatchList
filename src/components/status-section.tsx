"use client";

import { useState, useMemo } from "react";
import { Eye, CheckCircle, Clock, Pause, ArrowUpDown } from "lucide-react";
import { MediaGrid, type MediaCardItem } from "@/components/media-card";

const statusIcons: Record<string, React.ReactNode> = {
  watching: <Eye className="h-5 w-5 text-blue-400" />,
  completed: <CheckCircle className="h-5 w-5 text-green-400" />,
  planned: <Clock className="h-5 w-5 text-yellow-400" />,
  on_hold: <Pause className="h-5 w-5 text-gray-400" />,
};

type SortKey = "default" | "rating_desc" | "rating_asc" | "episodes_desc" | "episodes_asc";

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "rating_desc", label: "评分 ↓" },
  { value: "rating_asc", label: "评分 ↑" },
  { value: "episodes_desc", label: "集数 ↓" },
  { value: "episodes_asc", label: "集数 ↑" },
];

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

interface StatusSectionProps {
  status: string;
  label: string;
  items: MediaCardItem[];
  total: number;
}

export function StatusSection({ status, label, items, total }: StatusSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const sortedItems = useMemo(() => {
    if (sortKey === "default") return items;
    const sorted = [...items];
    switch (sortKey) {
      case "rating_desc":
        sorted.sort((a, b) => getRating(b) - getRating(a));
        break;
      case "rating_asc":
        sorted.sort((a, b) => getRating(a) - getRating(b));
        break;
      case "episodes_desc":
        sorted.sort((a, b) => getTotalEpisodes(b) - getTotalEpisodes(a));
        break;
      case "episodes_asc":
        sorted.sort((a, b) => getTotalEpisodes(a) - getTotalEpisodes(b));
        break;
    }
    return sorted;
  }, [items, sortKey]);

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
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortKey(opt.value)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${
                  sortKey === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
