"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Search,
  Library,
  Settings,
  LogOut,
  Film,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { href: "/admin/search", label: "搜索添加", icon: Search },
  { href: "/admin/library", label: "影视管理", icon: Library },
  { href: "/admin/logs", label: "系统日志", icon: ScrollText },
  { href: "/admin/settings", label: "系统设置", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - fixed */}
      <aside className="hidden w-64 flex-shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 flex-shrink-0">
          <Film className="h-5 w-5 text-primary" />
          <span className="font-semibold">追剧清单</span>
          <span className="ml-auto text-xs text-muted-foreground">管理后台</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 flex-shrink-0">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Film className="h-4 w-4" />
            前台首页
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-3 text-muted-foreground"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Main content - scrollable */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-4 border-b px-4 flex-shrink-0 md:hidden">
          <Film className="h-5 w-5 text-primary" />
          <span className="font-semibold">追剧清单</span>
          <nav className="ml-auto flex items-center gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md p-2",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
