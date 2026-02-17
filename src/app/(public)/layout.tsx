import Link from "next/link";
import { Film, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { PublicSearch } from "@/components/public-search";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 bg-transparent">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
        <div className="container relative mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Film className="h-5 w-5 text-primary" />
            追剧清单
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-4 text-sm sm:flex">
              <Link
                href="/"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                全部
              </Link>
              <Link
                href="/?type=tv"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                剧集
              </Link>
              <Link
                href="/?type=movie"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                电影
              </Link>
            </nav>
            <PublicSearch />
            <ThemeToggle />
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href="/admin">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="relative z-10">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-md" />
        <div className="container relative mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          追剧清单 &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
