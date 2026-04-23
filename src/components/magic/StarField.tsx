import { useMemo } from "react";

interface StarFieldProps {
  density?: number;
  className?: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  bright: boolean;
}

/**
 * Twinkling parallax-friendly star field used as a background.
 * Pure CSS animations — zero runtime cost.
 */
export const StarField = ({ density = 80, className = "" }: StarFieldProps) => {
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: density }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 4,
      duration: Math.random() * 3 + 2,
      bright: Math.random() > 0.85,
    }));
  }, [density]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {/* Aurora glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-aurora opacity-20 blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-0 -right-40 w-[600px] h-[600px] rounded-full bg-dream opacity-15 blur-3xl animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Stars */}
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-moon animate-twinkle"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            boxShadow: s.bright ? "0 0 8px hsl(var(--moon))" : undefined,
            opacity: s.bright ? 1 : 0.6,
          }}
        />
      ))}
    </div>
  );
};
