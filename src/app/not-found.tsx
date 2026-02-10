import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">页面未找到</p>
      <Button asChild variant="outline">
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
