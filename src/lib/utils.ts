import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a UTC datetime string (from SQLite) to a Date in UTC+8.
 * SQLite stores `datetime('now')` as UTC without timezone suffix.
 */
function toCST(dateStr: string): Date {
  return new Date(dateStr + "Z");
}

/**
 * Format a UTC datetime string as relative time or absolute date in UTC+8.
 */
export function formatDateTimeCST(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = toCST(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Format a UTC datetime string as short date+time in UTC+8.
 * e.g. "01-15 14:30"
 */
export function formatShortDateCST(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = toCST(dateStr);
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
