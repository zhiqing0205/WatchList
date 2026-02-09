"use client";

import { useState } from "react";
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
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getImageUrl } from "@/lib/tmdb";
import {
  updateMediaItem,
  updateTvProgress,
  updateMovieProgress,
  setMediaTags,
} from "@/app/admin/_actions/media";
import type { MediaItem, Tag, TvProgress, MovieProgress } from "@/db/schema";

interface EditFormProps {
  item: MediaItem & {
    progress: TvProgress | MovieProgress | null;
    tags: Tag[];
  };
  allTags: Tag[];
}

export function MediaEditForm({ item, allTags }: EditFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Media fields
  const [status, setStatus] = useState<string>(item.status);
  const [rating, setRating] = useState(item.rating?.toString() || "");
  const [notes, setNotes] = useState(item.notes || "");
  const [playUrl, setPlayUrl] = useState(item.playUrl || "");
  const [isVisible, setIsVisible] = useState(item.isVisible !== false);

  // Tags
  const [selectedTags, setSelectedTags] = useState<number[]>(
    item.tags.map((t) => t.id)
  );

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

  const seasonDetails: { season_number: number; episode_count: number; name: string }[] =
    tvProg?.seasonDetails ? JSON.parse(tvProg.seasonDetails) : [];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Poster + Info */}
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
              {item.releaseDate && ` · ${item.releaseDate.substring(0, 4)}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
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
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  style={
                    selectedTags.includes(tag.id)
                      ? { backgroundColor: tag.color || undefined }
                      : { borderColor: tag.color || undefined }
                  }
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </Badge>
              ))}
              {allTags.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无标签，请先创建标签</p>
              )}
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
  );
}
