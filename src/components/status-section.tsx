import { Suspense } from "react";
import { Eye, CheckCircle, Clock, Pause, Radio } from "lucide-react";
import { MediaGrid, type MediaCardItem } from "@/components/media-card";
import { SortButtons } from "@/components/sort-controls";
import type { StatusValue } from "@/lib/status";

const statusIcons: Partial<Record<StatusValue, React.ReactNode>> = {
  airing: <Radio className="h-5 w-5 text-orange-400" />,
  watching: <Eye className="h-5 w-5 text-blue-400" />,
  completed: <CheckCircle className="h-5 w-5 text-green-400" />,
  planned: <Clock className="h-5 w-5 text-yellow-400" />,
  on_hold: <Pause className="h-5 w-5 text-gray-400" />,
};

interface StatusSectionProps {
  status: string;
  label: string;
  items: MediaCardItem[];
  total: number;
}

export function StatusSection({ status, label, items, total }: StatusSectionProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          {statusIcons[status as StatusValue]}
          {label}
          <span className="text-sm font-normal text-muted-foreground">
            {total}
          </span>
        </h2>
        <Suspense fallback={null}>
          <SortButtons statusKey={status} />
        </Suspense>
      </div>
      <MediaGrid
        items={items}
        maxRows={3}
        overflowHref={`/?status=${status}`}
        overflowTotal={total}
      />
    </section>
  );
}
