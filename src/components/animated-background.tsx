"use client";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Light mode blobs — warm, muted tones */}
      <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] animate-blob rounded-full opacity-20 blur-[100px] dark:opacity-0" style={{ background: "#f0abfc" }} />
      <div className="animation-delay-2000 absolute -right-[5%] top-[20%] h-[45%] w-[45%] animate-blob rounded-full opacity-15 blur-[100px] dark:opacity-0" style={{ background: "#93c5fd" }} />
      <div className="animation-delay-4000 absolute -bottom-[10%] left-[20%] h-[50%] w-[50%] animate-blob rounded-full opacity-15 blur-[100px] dark:opacity-0" style={{ background: "#6ee7b7" }} />
      <div className="animation-delay-6000 absolute right-[10%] top-[60%] h-[35%] w-[35%] animate-blob rounded-full opacity-20 blur-[100px] dark:opacity-0" style={{ background: "#fde68a" }} />

      {/* Dark mode blobs — deeper, richer tones */}
      <div className="absolute -left-[10%] -top-[10%] h-[50%] w-[50%] animate-blob rounded-full opacity-0 blur-[100px] dark:opacity-15" style={{ background: "#7c3aed" }} />
      <div className="animation-delay-2000 absolute -right-[5%] top-[20%] h-[45%] w-[45%] animate-blob rounded-full opacity-0 blur-[100px] dark:opacity-10" style={{ background: "#2563eb" }} />
      <div className="animation-delay-4000 absolute -bottom-[10%] left-[20%] h-[50%] w-[50%] animate-blob rounded-full opacity-0 blur-[100px] dark:opacity-10" style={{ background: "#0d9488" }} />
      <div className="animation-delay-6000 absolute right-[10%] top-[60%] h-[35%] w-[35%] animate-blob rounded-full opacity-0 blur-[100px] dark:opacity-15" style={{ background: "#c026d3" }} />
    </div>
  );
}
