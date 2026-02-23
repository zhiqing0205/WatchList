"use client";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />

      {/* Animated blobs */}
      <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] animate-blob rounded-full bg-primary/[0.03] blur-3xl" />
      <div className="animation-delay-2000 absolute -right-[10%] top-[20%] h-[45%] w-[45%] animate-blob rounded-full bg-chart-1/[0.04] blur-3xl" />
      <div className="animation-delay-4000 absolute -bottom-[10%] left-[20%] h-[50%] w-[50%] animate-blob rounded-full bg-chart-2/[0.03] blur-3xl" />
      <div className="animation-delay-6000 absolute right-[10%] top-[60%] h-[35%] w-[35%] animate-blob rounded-full bg-chart-4/[0.03] blur-3xl" />

      {/* Subtle noise overlay for texture */}
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
      }} />
    </div>
  );
}
