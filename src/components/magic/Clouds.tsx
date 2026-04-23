import { motion } from "framer-motion";

/**
 * Drifting clouds in the background of a hero. Decorative.
 */
export const Clouds = ({ className = "" }: { className?: string }) => {
  const Cloud = ({ delay, top, scale = 1, opacity = 0.3 }: { delay: number; top: string; scale?: number; opacity?: number }) => (
    <motion.div
      className="absolute"
      style={{ top, opacity }}
      initial={{ x: "-20%" }}
      animate={{ x: "120%" }}
      transition={{ duration: 60, delay, repeat: Infinity, ease: "linear" }}
      aria-hidden
    >
      <svg width={200 * scale} height={80 * scale} viewBox="0 0 200 80" fill="none">
        <ellipse cx="60" cy="50" rx="50" ry="22" fill="hsl(258 50% 85%)" />
        <ellipse cx="100" cy="40" rx="55" ry="28" fill="hsl(280 50% 88%)" />
        <ellipse cx="140" cy="50" rx="45" ry="20" fill="hsl(258 50% 85%)" />
      </svg>
    </motion.div>
  );

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden blur-sm ${className}`} aria-hidden>
      <Cloud delay={0} top="15%" scale={1} opacity={0.15} />
      <Cloud delay={20} top="40%" scale={1.4} opacity={0.1} />
      <Cloud delay={40} top="70%" scale={0.8} opacity={0.12} />
    </div>
  );
};
