/** Pulsing placeholder block; pass size/color/shape via className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse motion-reduce:animate-none ${className}`}
    />
  );
}
