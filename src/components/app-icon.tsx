export function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="app-icon-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#app-icon-bg)" />
      <path d="M196 148 L372 256 L196 364Z" fill="white" opacity={0.95} />
      <rect x="120" y="400" width="272" height="14" rx="7" fill="white" opacity={0.25} />
      <rect x="120" y="400" width="176" height="14" rx="7" fill="white" opacity={0.9} />
    </svg>
  );
}
