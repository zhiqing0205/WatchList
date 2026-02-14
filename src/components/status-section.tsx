"use client";

import { useState, useMemo } from "react";
import { Eye, CheckCircle, Clock, Pause } from "lucide-react";
import { MediaGrid, type MediaCardItem } from "@/components/media-card";
import {
  type SortState,
  SortButtons,
  toggleSortState,
  sortItems,
} from "@/components/sort-controls";

const statusIcons: Record<string, React.ReactNode> = {
  watching: <Eye className="h-5 w-5 text-blue-400" />,
  completed: <CheckCircle className="h-5 w-5 text-green-400" />,
  planned: <Clock className="h-5 w-5 text-yellow-400" />,
  on_hold: <Pause className="h-5 w-5 text-gray-400" />,
};

interface StatusSectionProps {
  status: string;
  label: string;
  items: MediaCardItem[];
  total: number;
}

export function StatusSection({ status, label, items, total }: StatusSectionProps) {
  const [sort, setSort] = useState<SortState>({ field: "date", dir: "desc" });

  const sortedItems = useMemo(() => sortItems(items, sort), [items, sort]);

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
        <SortButtons
          sort={sort}
          onToggle={(f) => setSort((prev) => toggleSortState(prev, f))}
        />
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
