// Centralized status configuration
// All status labels, colors, icons, and ordering defined in one place

export const STATUS_VALUES = [
  "airing",
  "upcoming",
  "watching",
  "completed",
  "planned",
  "on_hold",
  "dropped",
] as const;

export type StatusValue = (typeof STATUS_VALUES)[number];

export const STATUS_LABELS: Record<StatusValue, string> = {
  airing: "热映中",
  upcoming: "待播",
  watching: "在看",
  completed: "已看",
  planned: "想看",
  on_hold: "搁置",
  dropped: "弃剧",
};

// Tailwind background classes for badges
export const STATUS_BADGE_COLORS: Record<StatusValue, string> = {
  airing: "bg-orange-500",
  upcoming: "bg-indigo-500",
  watching: "bg-blue-500",
  completed: "bg-green-500",
  planned: "bg-yellow-500",
  on_hold: "bg-gray-500",
  dropped: "bg-red-500",
};

// HEX colors for charts
export const STATUS_HEX_COLORS: Record<StatusValue, string> = {
  airing: "#f97316",
  upcoming: "#6366f1",
  watching: "#3b82f6",
  completed: "#22c55e",
  planned: "#eab308",
  on_hold: "#6b7280",
  dropped: "#ef4444",
};

// Dropdown config with dot and background styling
export const STATUS_DROPDOWN_CONFIG: {
  value: StatusValue;
  label: string;
  dot: string;
  bg: string;
}[] = [
  { value: "airing", label: "热映中", dot: "bg-orange-500", bg: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  { value: "upcoming", label: "待播", dot: "bg-indigo-500", bg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { value: "watching", label: "在看", dot: "bg-blue-500", bg: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { value: "planned", label: "想看", dot: "bg-yellow-500", bg: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  { value: "completed", label: "已看", dot: "bg-green-500", bg: "bg-green-500/10 text-green-600 border-green-500/30" },
  { value: "on_hold", label: "搁置", dot: "bg-gray-500", bg: "bg-gray-500/10 text-gray-500 border-gray-500/30" },
  { value: "dropped", label: "弃剧", dot: "bg-red-500", bg: "bg-red-500/10 text-red-600 border-red-500/30" },
];

// Default status ordering for homepage grouped view
export const HOMEPAGE_STATUS_ORDER: StatusValue[] = [
  "airing",
  "upcoming",
  "watching",
  "planned",
  "completed",
  "on_hold",
];

// Filter bar status options (without "dropped")
export const FILTER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "airing", label: "热映中" },
  { value: "upcoming", label: "待播" },
  { value: "watching", label: "在看" },
  { value: "completed", label: "已看" },
  { value: "planned", label: "想看" },
  { value: "on_hold", label: "搁置" },
];
