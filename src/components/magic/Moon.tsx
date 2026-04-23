import { motion } from "framer-motion";

/**
 * A glowing crescent moon with a soft halo. Decorative.
 */
export const Moon = ({ className = "" }: { className?: string }) => {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <div className="absolute inset-0 bg-moon rounded-full blur-3xl opacity-50 scale-150" />
      <svg viewBox="0 0 100 100" className="relative w-full h-full drop-shadow-[0_0_30px_hsl(var(--moon)/0.6)]">
        <defs>
          <radialGradient id="moonGrad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="hsl(50 100% 95%)" />
            <stop offset="60%" stopColor="hsl(45 100% 80%)" />
            <stop offset="100%" stopColor="hsl(40 90% 70%)" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="url(#moonGrad)" />
        <circle cx="65" cy="42" r="3" fill="hsl(40 60% 65% / 0.4)" />
        <circle cx="42" cy="58" r="4" fill="hsl(40 60% 65% / 0.35)" />
        <circle cx="58" cy="65" r="2.5" fill="hsl(40 60% 65% / 0.3)" />
      </svg>
    </motion.div>
  );
};
