"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getAllTags, createTag, updateTag, deleteTag, getMediaItemsByTagId } from "@/app/admin/_actions/media";
import { getImageUrl } from "@/lib/tmdb";
import type { Tag } from "@/db/schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "")
    .replace(/\-\-+/g, "-")
    .trim();
}

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

interface TagMediaItem {
  id: number;
  title: string;
  mediaType: string;
  posterPath: string | null;
  status: string;
}

export default function LibraryTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // New tag form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [adding, setAdding] = useState(false);

  // Expanded tag media
  const [expandedTag, setExpandedTag] = useState<number | null>(null);
  const [tagMedia, setTagMedia] = useState<TagMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const loadTags = async () => {
    const data = await getAllTags();
    setTags(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleToggleExpand = async (tagId: number) => {
    if (expandedTag === tagId) {
      setExpandedTag(null);
      setTagMedia([]);
      return;
    }
    setExpandedTag(tagId);
    setLoadingMedia(true);
    try {
      const items = await getMediaItemsByTagId(tagId);
      setTagMedia(items);
    } catch {
      toast.error("加载失败");
      setTagMedia([]);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const slug = slugify(newName) || `tag-${Date.now()}`;
      await createTag({ name: newName.trim(), slug, color: newColor });
      toast.success("标签创建成功");
      setNewName("");
      await loadTags();
    } catch {
      toast.error("创建失败");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除标签「${name}」吗？`)) return;
    try {
      await deleteTag(id);
      toast.success("已删除");
      if (expandedTag === id) {
        setExpandedTag(null);
        setTagMedia([]);
      }
      await loadTags();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleUpdateColor = async (id: number, color: string) => {
    try {
      await updateTag(id, { color });
      await loadTags();
    } catch {
      toast.error("更新失败");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/library" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">标签管理</h1>
        </div>
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/library" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">标签管理</h1>
        <p className="text-sm text-muted-foreground">
          标签初始从 TMDB 分类创建，后续自定义修改不会被元数据更新覆盖
        </p>
      </div>

      {/* Create tag */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">创建标签</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-2 flex-1">
              <Label>标签名称</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入标签名称"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <Input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-10 w-16 p-1"
              />
            </div>
            <Button onClick={handleCreate} disabled={adding}>
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              创建
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tag list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">已有标签 ({tags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无标签</p>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => {
                const isExpanded = expandedTag === tag.id;
                return (
                  <div key={tag.id} className="rounded-md border">
                    <div className="flex items-center gap-3 p-3">
                      <button
                        onClick={() => handleToggleExpand(tag.id)}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        title="查看关联影视"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <Badge
                        variant="outline"
                        style={{ borderColor: tag.color || undefined, color: tag.color || undefined }}
                      >
                        {tag.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{tag.slug}</span>
                      <div className="ml-auto flex items-center gap-2">
                        <Input
                          type="color"
                          value={tag.color || "#6366f1"}
                          onChange={(e) => handleUpdateColor(tag.id, e.target.value)}
                          className="h-8 w-12 p-0.5"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag.id, tag.name)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {/* Expanded media list */}
                    {isExpanded && (
                      <div className="border-t bg-muted/30 px-3 py-2">
                        {loadingMedia ? (
                          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            加载中...
                          </div>
                        ) : tagMedia.length === 0 ? (
                          <p className="py-2 text-sm text-muted-foreground">暂无关联影视</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              共 {tagMedia.length} 部关联影视
                            </p>
                            {tagMedia.map((item) => (
                              <Link
                                key={item.id}
                                href={`/admin/library/${item.id}`}
                                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
                              >
                                <div className="relative h-10 w-7 flex-shrink-0 overflow-hidden rounded">
                                  <Image
                                    src={getImageUrl(item.posterPath, "w92")}
                                    alt={item.title}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <span className="truncate text-sm font-medium">
                                  {item.title}
                                </span>
                                <Badge variant="outline" className="ml-auto flex-shrink-0 text-[10px]">
                                  {item.mediaType === "tv" ? "剧集" : "电影"}
                                </Badge>
                                <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                                  {statusLabels[item.status] || item.status}
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
