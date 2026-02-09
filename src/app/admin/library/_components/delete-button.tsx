"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { deleteMediaItem } from "@/app/admin/_actions/media";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DeleteMediaButton({ id, title }: { id: number; title: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`确定要删除「${title}」吗？`)) return;
    setLoading(true);
    try {
      await deleteMediaItem(id);
      toast.success("已删除");
      router.refresh();
    } catch {
      toast.error("删除失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4 text-destructive" />
      )}
    </Button>
  );
}
