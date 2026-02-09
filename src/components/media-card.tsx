import Image from "next/image";
import Link from "next/link";
import { getImageUrl } from "@/lib/tmdb";
import { Badge } from "@/components/ui/badge";
import type { MediaItem } from "@/db/schema";

const statusLabels: Record<string, string> = {
  watching: "在看",
  completed: "已看",
  planned: "想看",
  dropped: "弃剧",
  on_hold: "搁置",
};

const statusColors: Record<string, string> = {
  watching: "bg-blue-500",
  completed: "bg-green-500",
  planned: "bg-yellow-500",
  dropped: "bg-red-500",
  on_hold: "bg-gray-500",
};

export function MediaCard({ item }: { item: MediaItem }) {
  return (
    <Link href={`/media/${item.id}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        <Image
          src={getImageUrl(item.posterPath)}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="absolute left-2 top-2">
          <Badge
            variant="secondary"
            className={`${statusColors[item.status]} text-white border-0 text-xs`}
          >
            {statusLabels[item.status]}
          </Badge>
        </div>
        {item.rating && (
          <div className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-yellow-400">
            {item.rating}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="text-xs text-white/80">
            {item.mediaType === "tv" ? "剧集" : "电影"}
            {item.releaseDate && ` · ${item.releaseDate.substring(0, 4)}`}
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        <h3 className="line-clamp-1 text-sm font-medium leading-tight">
          {item.title}
        </h3>
        {item.voteAverage !== null && item.voteAverage !== undefined && (
          <p className="text-xs text-muted-foreground">
            ⭐ {item.voteAverage.toFixed(1)}
          </p>
        )}
      </div>
    </Link>
  );
}

export function MediaGrid({ items }: { items: MediaItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg">暂无影视内容</p>
        <p className="text-sm">稍后再来看看吧</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </div>
  );
}
