"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Check, Loader2 } from "lucide-react";
import { getImageUrl } from "@/lib/tmdb";
import { addMediaFromTmdb } from "@/app/admin/_actions/media";
import { toast } from "sonner";
import type { TmdbSearchResult, TmdbMediaDetails } from "@/lib/tmdb";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [searchType, setSearchType] = useState<"multi" | "movie" | "tv">("multi");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tmdb/search?query=${encodeURIComponent(query)}&type=${searchType}`
      );
      const data = await res.json();
      setResults(
        data.results?.filter(
          (r: TmdbSearchResult) =>
            r.media_type !== "person" &&
            (r.media_type === "movie" || r.media_type === "tv" || r.title || r.name)
        ) || []
      );
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
      // Fetch full details
      const detailsRes = await fetch(`/api/tmdb/details/${type}/${result.id}`);
      const details: TmdbMediaDetails = await detailsRes.json();

      const res = await addMediaFromTmdb(details, type as "movie" | "tv");
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("添加成功");
        setAddedIds((prev) => new Set(prev).add(result.id));
      }
    } catch {
      toast.error("添加失败");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">搜索添加</h1>

      <div className="flex gap-2">
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
        <Input
          placeholder="搜索影视名称..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          搜索
        </Button>
      </div>

      <div className="grid gap-3">
        {results.map((result) => {
          const title = result.title || result.name || "Unknown";
          const originalTitle = result.original_title || result.original_name;
          const date = result.release_date || result.first_air_date;
          const type = result.media_type || (result.title ? "movie" : "tv");
          const isAdded = addedIds.has(result.id);

          return (
            <Card key={`${type}-${result.id}`}>
              <CardContent className="flex gap-4 p-4">
                <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded">
                  <Image
                    src={getImageUrl(result.poster_path, "w185")}
                    alt={title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium">{title}</h3>
                      {originalTitle && originalTitle !== title && (
                        <p className="text-sm text-muted-foreground">{originalTitle}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {type === "movie" ? "电影" : "剧集"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {date && <span>{date.substring(0, 4)}</span>}
                    {result.vote_average > 0 && <span>⭐ {result.vote_average.toFixed(1)}</span>}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {result.overview || "暂无简介"}
                  </p>
                </div>
                <div className="flex items-center">
                  <Button
                    size="sm"
                    variant={isAdded ? "secondary" : "default"}
                    disabled={addingId === result.id || isAdded}
                    onClick={() => handleAdd(result)}
                  >
                    {addingId === result.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isAdded ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {isAdded ? "已添加" : "添加"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {results.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-10">
            输入关键词搜索 TMDB 影视数据
          </p>
        )}
      </div>
    </div>
  );
}
