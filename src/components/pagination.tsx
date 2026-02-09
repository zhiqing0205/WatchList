import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}

export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const separator = baseUrl.includes("?") ? "&" : "?";

  return (
    <div className="flex items-center justify-center gap-2 py-8">
      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={currentPage <= 1}
      >
        <Link
          href={currentPage > 1 ? `${baseUrl}${separator}page=${currentPage - 1}` : "#"}
          aria-disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
          上一页
        </Link>
      </Button>
      <span className="text-sm text-muted-foreground">
        {currentPage} / {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        asChild
        disabled={currentPage >= totalPages}
      >
        <Link
          href={currentPage < totalPages ? `${baseUrl}${separator}page=${currentPage + 1}` : "#"}
          aria-disabled={currentPage >= totalPages}
        >
          下一页
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
