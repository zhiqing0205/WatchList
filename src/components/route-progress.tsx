"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

const SHOW_DELAY = 200; // Only show overlay if navigation takes longer than this

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navKeyRef = useRef(`${pathname}?${searchParams.toString()}`);

  const cleanup = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startLoading = useCallback(() => {
    cleanup();
    // Delay showing the overlay — fast navigations won't trigger it
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY);
  }, [cleanup]);

  const finishLoading = useCallback(() => {
    cleanup();
    // If overlay is visible, hide it after a brief moment
    // If it hasn't appeared yet, the cleanup() already cancelled the timer
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, 100);
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
