"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navKeyRef = useRef(`${pathname}?${searchParams.toString()}`);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    cleanup();
    setProgress(15);
    setVisible(true);
    // Slowly increment toward 90%
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const increment = p < 50 ? 3 : p < 70 ? 2 : 0.5;
        return Math.min(90, p + increment);
      });
    }, 200);
  }, [cleanup]);

  const finishProgress = useCallback(() => {
    cleanup();
    setProgress(100);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, [cleanup]);

  // Detect navigation completion
  useEffect(() => {
    const newKey = `${pathname}?${searchParams.toString()}`;
    if (newKey !== navKeyRef.current) {
      navKeyRef.current = newKey;
      finishProgress();
    }
  }, [pathname, searchParams, finishProgress]);

  // Intercept clicks on internal links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || !anchor.href) return;
      // Skip external links, download links, new tab links
      if (anchor.target === "_blank" || anchor.download) return;
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        const currentKey = `${pathname}?${searchParams.toString()}`;
        const newKey = `${url.pathname}?${url.searchParams.toString()}`;
        if (newKey !== currentKey) {
          startProgress();
        }
      } catch {
        // Invalid URL, ignore
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, searchParams, startProgress]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-primary shadow-sm shadow-primary/50"
        style={{
          width: `${progress}%`,
          transition:
            progress === 100
              ? "width 0.2s ease-out"
              : "width 0.4s ease-out",
        }}
      />
    </div>
  );
}
