import { useEffect, useRef } from "react";

interface WaveformProps {
  active: boolean;
  stream?: MediaStream | null;
  bars?: number;
  className?: string;
}

/**
 * Live audio waveform driven by an active MediaStream.
 * Falls back to a gentle idle animation when no stream is provided.
 */
export const Waveform = ({ active, stream, bars = 28, className = "" }: WaveformProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      // idle gentle animation
      const els = containerRef.current?.querySelectorAll<HTMLDivElement>("[data-bar]");
      els?.forEach((el, i) => {
        el.style.transition = "height 600ms ease-in-out";
        el.style.height = `${20 + Math.sin(i) * 10}%`;
      });
      return;
    }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(buffer);
      const els = containerRef.current?.querySelectorAll<HTMLDivElement>("[data-bar]");
      if (els) {
        els.forEach((el, i) => {
          const v = buffer[i % buffer.length] / 255; // 0..1
          const h = Math.max(8, v * 100);
          el.style.height = `${h}%`;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { source.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    };
  }, [active, stream]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center gap-1 h-16 w-full max-w-xs ${className}`}
      aria-hidden
    >
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          data-bar
          className="w-1.5 rounded-full bg-aurora transition-[height] duration-100"
          style={{
            height: "20%",
            opacity: 0.6 + (Math.sin(i) + 1) * 0.2,
          }}
        />
      ))}
    </div>
  );
};
