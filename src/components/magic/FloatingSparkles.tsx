import { useMemo } from "react";

interface FloatingSparklesProps {
  /** Visual density. Capped internally for performance. */
  count?: number;
  className?: string;
}

/**
 * Decorative drifting sparkles for premium loading states.
 * Pure CSS — no JS loop. Respects prefers-reduced-motion.
 * Count is capped at 8 to keep paints cheap on mobile.
 */
export const FloatingSparkles = ({ count = 6, className = "" }: FloatingSparklesProps) => {
  const safeCount = Math.min(count, 8);

  const sparkles = useMemo(
    () =>
      Array.from({ length: safeCount }).map((_, i) => ({
        id: i,
        left: 10 + Math.random() * 80,
        top: 10 + Math.random() * 80,
        size: 3 + Math.random() * 5,
        delay: Math.random() * 3,
        duration: 4 + Math.random() * 2,
      })),
    [safeCount]
  );

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden ${className}`}
      aria-hidden
    >
      {sparkles.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-gold-soft animate-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            boxShadow: `0 0 ${s.size * 2}px hsl(45 100% 80% / 0.6)`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
};
