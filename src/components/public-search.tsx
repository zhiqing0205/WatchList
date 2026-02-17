"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export function PublicSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync query from URL when params change
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  // Auto-open if there's already a query
  useEffect(() => {
    if (searchParams.get("q")) setOpen(true);
  }, [searchParams]);

  const navigate = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value.trim());
      } else {
        params.delete("q");
      }
      params.delete("page");
      // Always navigate to homepage for search
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      navigate(value);
    }, 400);
  };

  const handleClear = () => {
    setQuery("");
    if (timerRef.current) clearTimeout(timerRef.current);
    navigate("");
    inputRef.current?.focus();
  };

  const handleToggle = () => {
    if (open && !query) {
      setOpen(false);
    } else {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (query) {
        handleClear();
      } else {
        setOpen(false);
      }
    }
  };

  // Close on blur if empty
  const handleBlur = () => {
    if (!query) {
      setTimeout(() => setOpen(false), 200);
    }
  };

  return (
    <div className="relative flex items-center">
      {open ? (
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="搜索..."
              className="h-8 w-36 rounded-md border bg-background/80 pl-8 pr-7 text-sm outline-none backdrop-blur-sm transition-all placeholder:text-muted-foreground focus:w-48 focus:ring-1 focus:ring-primary sm:w-44 sm:focus:w-56"
            />
            {query && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={handleToggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="搜索"
        >
          <Search className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
