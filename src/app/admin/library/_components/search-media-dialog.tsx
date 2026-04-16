"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { getImageUrl } from "@/lib/tmdb";
import { addMediaFromTmdb, checkMediaInLibrary } from "@/app/admin/_actions/media";
import { toast } from "sonner";
import type { TmdbSearchResult, TmdbMediaDetails } from "@/lib/tmdb";

export function AddMediaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [libraryIds, setLibraryIds] = useState<Set<number>>(new Set());
  const [searchType, setSearchType] = useState<"multi" | "movie" | "tv">("multi");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(query)}&type=${searchType}`
      );
      const data = await res.json();
      const filtered =
        data.results?.filter(
          (r: TmdbSearchResult) =>
            r.media_type !== "person" &&
            (r.media_type === "movie" || r.media_type === "tv" || r.title || r.name)
        ) || [];
      setResults(filtered);

      if (filtered.length > 0) {
        const tmdbIds = filtered.map((r: TmdbSearchResult) => r.id);
        const map = await checkMediaInLibrary(tmdbIds);
        setLibraryIds(new Set(Object.keys(map).map(Number)));
      } else {
        setLibraryIds(new Set());
      }
      setAddedIds(new Set());
    } catch {
      toast.error("搜索失败");
    } finally {
      setLoading(false);
    }
  }, [query, searchType]);

  const handleAdd = async (result: TmdbSearchResult) => {
    const type =
      result.media_type === "movie" || result.media_type === "tv"
        ? result.media_type
        : searchType === "multi"
          ? (result.title ? "movie" : "tv")
          : searchType;

    setAddingId(result.id);
    try {
      const detailsRes = await fetch(`/api/tmdb/details/${type}/${result.id}`);
      const details: TmdbMediaDetails = await detailsRes.json();

      const res = await addMediaFromTmdb(details, type as "movie" | "tv");
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("添加成功");
        setAddedIds((prev) => new Set(prev).add(result.id));
        router.refresh();
      }
    } catch {
      toast.error("添加失败");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setQuery("");
        setResults([]);
        setAddedIds(new Set());
        setLibraryIds(new Set());
      }
    }}>
      <DialogTrigger asChild>
        <Button size="sm" className="sm:size-default">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">添加影视</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>搜索添加影视</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            {[
              { value: "multi", label: "全部" },
              { value: "movie", label: "电影" },
              { value: "tv", label: "剧集" },
            ].map((t) => (
              <Button
                key={t.value}
                variant={searchType === t.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSearchType(t.value as "multi" | "movie" | "tv")}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-1 gap-2 min-w-0">
            <Input
              placeholder="搜索影视名称..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1">
          {results.map((result) => {
            const title = result.title || result.name || "Unknown";
            const originalTitle = result.original_title || result.original_name;
            const date = result.release_date || result.first_air_date;
            const type = result.media_type || (result.title ? "movie" : "tv");
            const isAdded = addedIds.has(result.id);
            const inLibrary = libraryIds.has(result.id);
            const isInLib = isAdded || inLibrary;

            return (
              <div
                key={`${type}-${result.id}`}
                className="flex gap-3 rounded-lg border p-2.5 sm:p-3"
              >
                <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded sm:h-24 sm:w-16">
                  <Image
                    src={getImageUrl(result.poster_path, "w185")}
                    alt={title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium">{title}</h3>
                      {originalTitle && originalTitle !== title && (
                        <p className="truncate text-xs text-muted-foreground">{originalTitle}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                      {type === "movie" ? "电影" : "剧集"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {date && <span>{date.substring(0, 4)}</span>}
                    {result.vote_average > 0 && <span>⭐ {result.vote_average.toFixed(1)}</span>}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground hidden sm:block">
                    {result.overview || "暂无简介"}
                  </p>
                </div>
                <div className="flex items-center flex-shrink-0">
                  <Button
                    size="sm"
                    variant={isInLib ? "secondary" : "default"}
                    disabled={addingId === result.id || isInLib}
                    onClick={() => handleAdd(result)}
                    className="h-8 px-2.5"
                  >
                    {addingId === result.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isInLib ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    <span className="ml-1 text-xs">{isInLib ? "已在库中" : "添加"}</span>
                  </Button>
                </div>
              </div>
            );
          })}
          {results.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-10">
              输入关键词搜索 TMDB 影视数据
            </p>
          )}
          {loading && results.length === 0 && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
