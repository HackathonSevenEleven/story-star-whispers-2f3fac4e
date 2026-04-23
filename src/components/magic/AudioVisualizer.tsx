import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  /** A ref-stable audio element. Pass `audioRef` (the React ref object), not `audioRef.current`. */
  audioRef: React.RefObject<HTMLAudioElement>;
  playing: boolean;
  bars?: number;
  className?: string;
}

const sourceCache = new WeakMap<
  HTMLAudioElement,
  { ctx: AudioContext; analyser: AnalyserNode }
>();

/**
 * Lightweight live frequency visualizer.
 * - Reads `audioRef.current` from a ref so it never receives stale `null`.
 * - Stops the RAF loop when paused (zero CPU at rest).
 * - Reuses one MediaElementSource per audio element.
 * - Writes directly to DOM (no React state per frame).
 */
export const AudioVisualizer = ({ audioRef, playing, bars = 36, className = "" }: AudioVisualizerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    const container = containerRef.current;
    if (!audio || !container) return;

    // Idle: settle bars to a calm baseline.
    const settleIdle = () => {
      const els = container.querySelectorAll<HTMLDivElement>("[data-bar]");
      els.forEach((el, i) => {
        el.style.height = `${12 + Math.sin(i * 0.5) * 6}%`;
      });
    };

    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      settleIdle();
      return;
    }

    // Lazily create / reuse the audio graph.
    let entry = sourceCache.get(audio);
    if (!entry) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64; // smaller = cheaper
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        analyser.connect(ctx.destination);
        entry = { ctx, analyser };
        sourceCache.set(audio, entry);
      } catch {
        settleIdle();
        return;
      }
    }

    const { ctx, analyser } = entry;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const els = container.querySelectorAll<HTMLDivElement>("[data-bar]");

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      els.forEach((el, i) => {
        const v = buffer[i % buffer.length] / 255;
        el.style.height = `${Math.max(8, v * 100)}%`;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [audioRef, playing]);

  return (
    <div
      ref={containerRef}
      className={`flex items-end justify-center gap-[3px] h-10 w-full motion-reduce:hidden ${className}`}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          data-bar
          className="w-[3px] rounded-full bg-gradient-to-t from-pink/70 via-accent/80 to-gold-soft transition-[height] duration-100 ease-out"
          style={{ height: "12%" }}
        />
      ))}
    </div>
  );
};
