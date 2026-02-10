"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/tmdb";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  checkMediaInLibrary,
  importMediaByTmdbId,
} from "@/app/admin/_actions/media";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface PersonCredit {
  id: number;
  title?: string;
  name?: string;
  media_type: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  character?: string;
}

interface Props {
  cast: CastMember[];
  isLoggedIn: boolean;
}

const PAGE_SIZE = 20;

export function CastSection({ cast, isLoggedIn }: Props) {
  const [selectedPerson, setSelectedPerson] = useState<CastMember | null>(null);
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [libraryMap, setLibraryMap] = useState<Record<number, number>>({});
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePersonClick = async (person: CastMember) => {
    setSelectedPerson(person);
    setLoading(true);
    setDisplayCount(PAGE_SIZE);
    setCredits([]);
    setLibraryMap({});

    try {
      const res = await fetch(`/api/tmdb/person/${person.id}/credits`);
      const data = await res.json();
      const sortedCredits = (data.cast || [])
        .filter(
          (c: PersonCredit) =>
            c.poster_path &&
            (c.media_type === "movie" || c.media_type === "tv")
        )
        .sort(
          (a: PersonCredit, b: PersonCredit) =>
            (b.vote_average || 0) - (a.vote_average || 0)
        );
      setCredits(sortedCredits);

      if (isLoggedIn && sortedCredits.length > 0) {
        const tmdbIds = sortedCredits.map((c: PersonCredit) => c.id);
        // Deduplicate
        const uniqueIds = [...new Set(tmdbIds)] as number[];
        const map = await checkMediaInLibrary(uniqueIds);
        setLibraryMap(map);
      }
    } catch {
      toast.error("获取演员作品失败");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (credit: PersonCredit) => {
    const mediaType = credit.media_type as "movie" | "tv";

    setImporting((prev) => new Set(prev).add(credit.id));
    try {
      const result = await importMediaByTmdbId(credit.id, mediaType);
      if (result.success) {
        toast.success("导入成功");
        setLibraryMap((prev) => ({ ...prev, [credit.id]: result.id! }));
      } else if (result.error) {
        toast.info(result.error);
        if (result.id)
          setLibraryMap((prev) => ({ ...prev, [credit.id]: result.id! }));
      }
    } catch {
      toast.error("导入失败");
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(credit.id);
        return next;
      });
    }
  };

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, credits.length));
    }
  }, [credits.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, selectedPerson]);

  if (cast.length === 0) return null;

  return (
    <>
      <div className="container mx-auto px-4 pb-8 md:px-10">
        <h2 className="mb-4 text-lg font-semibold text-white/80">演员</h2>
        {/* Wrapping grid of actors */}
        <div className="flex flex-wrap gap-4">
          {cast.map((person) => (
            <button
              key={person.id}
              onClick={() => handlePersonClick(person)}
              className="group/actor w-20 cursor-pointer text-center"
            >
              <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-muted ring-2 ring-white/10 transition-all duration-300 group-hover/actor:scale-110 group-hover/actor:ring-primary/50">
                {person.profile_path ? (
                  <Image
                    src={getImageUrl(person.profile_path, "w185")}
                    alt={person.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                    {person.name.charAt(0)}
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-xs font-medium text-white/80">
                {person.name}
              </p>
              <p className="line-clamp-1 text-[10px] text-white/50">
                {person.character}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Filmography dialog */}
      <Dialog
        open={!!selectedPerson}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
      >
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>{selectedPerson?.name} 的作品</DialogTitle>
          </DialogHeader>
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto pr-2"
          >
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : credits.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                暂无作品信息
              </p>
            ) : (
              credits.slice(0, displayCount).map((credit, idx) => {
                const title = credit.title || credit.name || "Unknown";
                const year = (
                  credit.release_date || credit.first_air_date
                )?.substring(0, 4);
                const inLibrary = libraryMap[credit.id] !== undefined;

                return (
                  <div
                    key={`${credit.id}-${credit.media_type}-${idx}`}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    <div className="relative h-16 w-11 flex-shrink-0 overflow-hidden rounded bg-muted">
                      {credit.poster_path && (
                        <Image
                          src={getImageUrl(credit.poster_path, "w92")}
                          alt={title}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {credit.media_type === "tv" ? "剧集" : "电影"}
                        {year && ` · ${year}`}
                        {credit.vote_average
                          ? ` · ${credit.vote_average.toFixed(1)}`
                          : ""}
                      </p>
                      {credit.character && (
                        <p className="text-xs text-muted-foreground">
                          饰 {credit.character}
                        </p>
                      )}
                    </div>
                    {isLoggedIn && (
                      <div className="flex-shrink-0">
                        {inLibrary ? (
                          <Badge variant="secondary" className="gap-1">
                            <Check className="h-3 w-3" />
                            已在库中
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImport(credit)}
                            disabled={importing.has(credit.id)}
                          >
                            {importing.has(credit.id) ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="mr-1 h-3 w-3" />
                            )}
                            导入
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {!loading && displayCount < credits.length && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
