"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

export type SortField = "date" | "rating" | "episodes";

const sortFieldDefs: { field: SortField; label: string }[] = [
  { field: "date", label: "播出时间" },
  { field: "rating", label: "评分" },
  { field: "episodes", label: "集数" },
];

export function SortButtons() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSort = (searchParams.get("sort") || "date") as SortField;
  const currentDir = searchParams.get("dir") || "desc";

  const handleToggle = (field: SortField) => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("sort", field);
      params.set("dir", currentDir === "desc" ? "asc" : "desc");
    } else {
      params.set("sort", field);
      params.set("dir", "desc");
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
