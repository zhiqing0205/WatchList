"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

export type SortField = "date" | "rating" | "episodes";

const sortFieldDefs: { field: SortField; label: string }[] = [
  { field: "date", label: "播出时间" },
  { field: "rating", label: "评分" },
  { field: "episodes", label: "集数" },
];

export function SortButtons({ statusKey }: { statusKey?: string } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sortParam = statusKey ? `sort_${statusKey}` : "sort";
  const dirParam = statusKey ? `dir_${statusKey}` : "dir";
  const currentSort = (searchParams.get(sortParam) || "date") as SortField;
  const currentDir = searchParams.get(dirParam) || "desc";

  const handleToggle = (field: SortField) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set(sortParam, field);
      params.set(dirParam, currentDir === "desc" ? "asc" : "desc");
    } else {
      params.set(sortParam, field);
      params.set(dirParam, "desc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1">
      {sortFieldDefs.map(({ field, label }) => {
        const active = currentSort === field;
        return (
          <button
            key={field}
            onClick={() => handleToggle(field)}
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
                  transform: currentDir === "asc" ? "scaleY(-1)" : undefined,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
