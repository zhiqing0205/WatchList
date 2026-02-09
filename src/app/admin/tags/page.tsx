"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAllTags, createTag, updateTag, deleteTag } from "@/app/admin/_actions/media";
import type { Tag } from "@/db/schema";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "")
    .replace(/\-\-+/g, "-")
    .trim();
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // New tag form
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [adding, setAdding] = useState(false);

  const loadTags = async () => {
    const data = await getAllTags();
    setTags(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTags();
  }, []);

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
    return <div className="space-y-6"><h1 className="text-2xl font-bold">标签管理</h1><p>加载中...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">标签管理</h1>

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
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
