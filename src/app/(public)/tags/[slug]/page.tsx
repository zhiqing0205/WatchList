export const dynamic = "force-dynamic";

import { getMediaByTag } from "@/app/admin/_actions/media";
import { MediaGrid } from "@/components/media-card";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Number(sp.page) || 1;

  const { items, totalPages, tag } = await getMediaByTag(slug, page);

  if (!tag) notFound();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">标签: </h1>
        <Badge
          variant="outline"
          className="text-base"
          style={{ borderColor: tag.color || undefined, color: tag.color || undefined }}
        >
          {tag.name}
        </Badge>
      </div>
      <MediaGrid items={items} />
      <Pagination currentPage={page} totalPages={totalPages} baseUrl={`/tags/${slug}`} />
    </div>
  );
}
