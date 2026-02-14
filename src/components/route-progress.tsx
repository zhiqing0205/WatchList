"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navKeyRef = useRef(`${pathname}?${searchParams.toString()}`);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    cleanup();
    setVisible(true);
  }, [cleanup]);

  const finishLoading = useCallback(() => {
    cleanup();
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 150);
  }, [cleanup]);

  // Detect navigation completion
  useEffect(() => {
    const newKey = `${pathname}?${searchParams.toString()}`;
    if (newKey !== navKeyRef.current) {
      navKeyRef.current = newKey;
      finishLoading();
    }
  }, [pathname, searchParams, finishLoading]);

  // Intercept clicks on internal links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      if (anchor.target === "_blank" || anchor.download) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const currentKey = `${pathname}?${searchParams.toString()}`;
        const newKey = `${url.pathname}?${url.searchParams.toString()}`;
        if (newKey !== currentKey) {
          startLoading();
        }
      } catch {
        // Invalid URL, ignore
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams, startLoading]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-[2px] transition-opacity duration-150">
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card/90 px-8 py-6 shadow-2xl backdrop-blur-md">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">加载中...</span>
      </div>
    </div>
  );
}
