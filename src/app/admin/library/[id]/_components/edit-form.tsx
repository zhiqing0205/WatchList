"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Loader2, Plus, X, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/tmdb";
import {
  updateMediaItem,
  updateTvProgress,
  updateMovieProgress,
  setMediaTags,
  createTag,
  deleteTag,
  checkMediaInLibrary,
  importMediaByTmdbId,
} from "@/app/admin/_actions/media";
import type { MediaItem, Tag, TvProgress, MovieProgress } from "@/db/schema";

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

interface EditFormProps {
  item: MediaItem & {
    progress: TvProgress | MovieProgress | null;
    tags: Tag[];
  };
  allTags: Tag[];
  cast: CastMember[];
}

export function MediaEditForm({ item, allTags: initialTags, cast }: EditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Media fields
  const [status, setStatus] = useState<string>(item.status);
  const [rating, setRating] = useState(item.rating?.toString() || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [playUrl, setPlayUrl] = useState(item.playUrl || "");
  const [isVisible, setIsVisible] = useState(item.isVisible !== false);

  // Tags
  const [allTags, setAllTags] = useState<Tag[]>(initialTags);
  const [selectedTags, setSelectedTags] = useState<number[]>(
    item.tags.map((t) => t.id)
  );
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);

  // Tag delete confirmation
  const [tagToDelete, setTagToDelete] = useState<{ id: number; name: string } | null>(null);

  // TV Progress
  const tvProg = item.mediaType === "tv" && item.progress && "currentSeason" in item.progress
    ? item.progress as TvProgress
    : null;
  const [currentSeason, setCurrentSeason] = useState(tvProg?.currentSeason?.toString() || "1");
  const [currentEpisode, setCurrentEpisode] = useState(tvProg?.currentEpisode?.toString() || "0");

  // Movie Progress
  const movieProg = item.mediaType === "movie" && item.progress && "watched" in item.progress
    ? item.progress as MovieProgress
    : null;
  const [watched, setWatched] = useState(movieProg?.watched || false);

  // Filmography dialog
  const [selectedPerson, setSelectedPerson] = useState<CastMember | null>(null);
  const [credits, setCredits] = useState<PersonCredit[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [displayCount, setDisplayCount] = useState(20);
  const [libraryMap, setLibraryMap] = useState<Record<number, number>>({});
  const [importing, setImporting] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlePersonClick = async (person: CastMember) => {
    setSelectedPerson(person);
    setCreditsLoading(true);
    setDisplayCount(20);
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

      if (sortedCredits.length > 0) {
        const tmdbIds = sortedCredits.map((c: PersonCredit) => c.id);
        const uniqueIds = [...new Set(tmdbIds)] as number[];
        const map = await checkMediaInLibrary(uniqueIds);
        setLibraryMap(map);
      }
    } catch {
      toast.error("获取演员作品失败");
    } finally {
      setCreditsLoading(false);
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

  // Infinite scroll handler for filmography
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setDisplayCount((prev) => Math.min(prev + 20, credits.length));
    }
  }, [credits.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, selectedPerson]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMediaItem(item.id, {
        status: status as "watching" | "completed" | "planned" | "dropped" | "on_hold",
        rating: rating ? Number(rating) : null,
        notes: notes || null,
        playUrl: playUrl || null,
        isVisible,
      });

      if (item.mediaType === "tv" && tvProg) {
        await updateTvProgress(item.id, {
          currentSeason: Number(currentSeason),
          currentEpisode: Number(currentEpisode),
        });
      }

      if (item.mediaType === "movie") {
        await updateMovieProgress(item.id, watched);
      }

      await setMediaTags(item.id, selectedTags);

      toast.success("保存成功");
      router.refresh();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setAddingTag(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\w\-]/g, "") || `tag-${Date.now()}`;
      const tag = await createTag({ name, slug, color: "#6366f1" });
      setAllTags((prev) => [...prev, tag]);
      setSelectedTags((prev) => [...prev, tag.id]);
      setNewTagName("");
      toast.success(`标签「${name}」已创建`);
    } catch {
      toast.error("创建标签失败");
    } finally {
      setAddingTag(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      await deleteTag(tagToDelete.id);
      setAllTags((prev) => prev.filter((t) => t.id !== tagToDelete.id));
      setSelectedTags((prev) => prev.filter((id) => id !== tagToDelete.id));
      toast.success("标签已删除");
    } catch {
      toast.error("删除失败");
    } finally {
      setTagToDelete(null);
    }
  };

  const seasonDetails: { season_number: number; episode_count: number; name: string }[] =
    tvProg?.seasonDetails ? JSON.parse(tvProg.seasonDetails) : [];

  return (
    <>
      {/* Tag delete confirmation */}
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除标签「{tagToDelete?.name}」？将从所有影视条目中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteTag}>
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column: Poster + Synopsis + Cast in one card */}
        <div>
          <Card>
            <CardContent className="p-4">
              <div className="relative mx-auto aspect-[2/3] w-full max-w-[200px] overflow-hidden rounded-lg">
                <Image
                  src={getImageUrl(item.posterPath)}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="mt-4 space-y-1 text-center">
                <h2 className="font-semibold">{item.title}</h2>
                {item.originalTitle && item.originalTitle !== item.title && (
                  <p className="text-sm text-muted-foreground">{item.originalTitle}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {item.mediaType === "tv" ? "剧集" : "电影"}
                  {item.releaseDate && ` · ${item.releaseDate}`}
                </p>
              </div>

              {/* Synopsis */}
              {item.overview && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-2 text-sm font-medium">简介</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.overview}
                  </p>
                </div>
              )}

              {/* Cast */}
              {cast.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="mb-3 text-sm font-medium">演员</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {cast.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handlePersonClick(member)}
                        className="flex items-center gap-2 rounded-md p-1.5 text-left transition-colors hover:bg-accent"
                      >
                        <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                          {member.profile_path ? (
                            <Image
                              src={getImageUrl(member.profile_path, "w92")}
                              alt={member.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                              {member.name[0]}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium leading-tight">
                            {member.name}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {member.character}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Edit Form */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="watching">在看</SelectItem>
                      <SelectItem value="completed">已看</SelectItem>
                      <SelectItem value="planned">想看</SelectItem>
                      <SelectItem value="on_hold">搁置</SelectItem>
                      <SelectItem value="dropped">弃剧</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>评分 (1-10)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    placeholder="留空不评分"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>播放链接</Label>
                <Input
                  value={playUrl}
                  onChange={(e) => setPlayUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>笔记</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="写点什么..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={isVisible} onCheckedChange={setIsVisible} />
                <Label>在前台显示</Label>
              </div>
            </CardContent>
          </Card>

          {/* TV Progress */}
          {item.mediaType === "tv" && tvProg && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">观看进度</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>当前季</Label>
                    <Select value={currentSeason} onValueChange={setCurrentSeason}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          { length: tvProg.totalSeasons || 1 },
                          (_, i) => i + 1
                        ).map((s) => {
                          const sd = seasonDetails.find((d) => d.season_number === s);
                          return (
                            <SelectItem key={s} value={String(s)}>
                              第 {s} 季{sd ? ` (${sd.episode_count} 集)` : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>当前集</Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentEpisode}
                      onChange={(e) => setCurrentEpisode(e.target.value)}
                    />
                  </div>
                </div>
                {/* Episode grid */}
                {seasonDetails.length > 0 && (
                  <div>
                    <Label className="mb-2 block">集数概览 (第 {currentSeason} 季)</Label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(
                        {
                          length:
                            seasonDetails.find(
                              (d) => d.season_number === Number(currentSeason)
                            )?.episode_count || 0,
                        },
                        (_, i) => i + 1
                      ).map((ep) => (
                        <button
                          key={ep}
                          type="button"
                          onClick={() => setCurrentEpisode(String(ep))}
                          className={`flex h-8 w-8 items-center justify-center rounded text-xs font-medium transition-colors ${
                            ep <= Number(currentEpisode)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {ep}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Movie Progress */}
          {item.mediaType === "movie" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">观看状态</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Switch checked={watched} onCheckedChange={setWatched} />
                  <Label>{watched ? "已观看" : "未观看"}</Label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">标签</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <div key={tag.id} className="group relative inline-flex">
                    <Badge
                      variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                      className="cursor-pointer pr-1.5"
                      style={
                        selectedTags.includes(tag.id)
                          ? { backgroundColor: tag.color || undefined }
                          : { borderColor: tag.color || undefined }
                      }
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                      <button
                        type="button"
                        className="ml-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTagToDelete({ id: tag.id, name: tag.name });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                ))}
                {allTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无标签</p>
                )}
              </div>
              {/* Inline create tag */}
              <div className="flex items-center gap-2">
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="添加自定义标签..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={addingTag || !newTagName.trim()}
                  onClick={handleCreateTag}
                >
                  {addingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            保存
          </Button>
        </div>
      </div>

      {/* Filmography dialog */}
      <Dialog
        open={!!selectedPerson}
        onOpenChange={(open) => !open && setSelectedPerson(null)}
      >
        <DialogContent className="flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-3">
              {selectedPerson?.profile_path && (
                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-muted">
                  <Image
                    src={getImageUrl(selectedPerson.profile_path, "w92")}
                    alt=""
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <span>{selectedPerson?.name}</span>
                {!creditsLoading && credits.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {credits.length} 部作品
                  </span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--muted-foreground) / 0.3) transparent" }}
          >
            {creditsLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">加载中...</p>
              </div>
            ) : credits.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">
                暂无作品信息
              </p>
            ) : (
              <div className="divide-y">
                {credits.slice(0, displayCount).map((credit, idx) => {
                  const title = credit.title || credit.name || "Unknown";
                  const year = (
                    credit.release_date || credit.first_air_date
                  )?.substring(0, 4);
                  const inLibrary = libraryMap[credit.id] !== undefined;

                  return (
                    <div
                      key={`${credit.id}-${credit.media_type}-${idx}`}
                      className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-accent/50"
                    >
                      <div className="relative h-[72px] w-12 flex-shrink-0 overflow-hidden rounded-md bg-muted shadow-sm">
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
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            {credit.media_type === "tv" ? "剧集" : "电影"}
                          </Badge>
                          {year && <span>{year}</span>}
                          {credit.vote_average > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              {credit.vote_average.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {credit.character && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                            饰 {credit.character}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0">
                        {inLibrary ? (
                          <Badge
                            variant="secondary"
                            className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/15"
                          >
                            <Check className="h-3 w-3" />
                            已在库中
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleImport(credit)}
                            disabled={importing.has(credit.id)}
                          >
                            {importing.has(credit.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Plus className="h-3 w-3" />
                            )}
                            导入
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!creditsLoading && displayCount < credits.length && (
              <div className="flex justify-center border-t py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
