export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getMediaItemById, getAllTags } from "@/app/admin/_actions/media";
import { MediaEditForm } from "./_components/edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditMediaPage({ params }: Props) {
  const { id } = await params;
  const item = await getMediaItemById(Number(id));

  if (!item) notFound();

  const allTags = await getAllTags();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">编辑: {item.title}</h1>
      <MediaEditForm item={item} allTags={allTags} />
    </div>
  );
}
