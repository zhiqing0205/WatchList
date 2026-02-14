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
    <div className="fixed top-0 left-0 right-0 z-[100] h-1">
      <div
        className="relative h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition:
            progress === 100
              ? "width 0.2s ease-out"
              : "width 0.4s ease-out",
          boxShadow: "0 0 8px 2px hsl(var(--primary) / 0.6)",
        }}
      >
        {/* Shimmer highlight */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.2s ease-in-out infinite",
          }}
        />
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
