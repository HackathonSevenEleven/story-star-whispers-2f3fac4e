import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Unified audio player that manages a single HTMLAudioElement instance
 * AND any active browser SpeechSynthesis utterance. Guarantees:
 *   - Only ONE audio source plays at a time
 *   - stop() fully terminates playback (pause + reset + clear src)
 *   - Starting new playback automatically stops the previous one
 *   - In-flight fetches can be aborted via the returned AbortController
 */
export interface UseAudioPlayer {
  isPlaying: boolean;
  currentAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
  /** Play a URL (or data: URI). Stops any prior playback first. */
  play: (src: string) => Promise<void>;
  /** Resume the current audio if paused. */
  resume: () => Promise<void>;
  pause: () => void;
  /** Hard stop: pause, reset position, clear src, cancel speech, abort fetch. */
  stop: () => void;
  /** Speak text via the browser's SpeechSynthesis. Stops any prior playback. */
  speak: (text: string, lang?: string) => void;
  /** AbortController exposed for callers doing their own streaming fetch. */
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useAudioPlayer(): UseAudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const detachListeners = useCallback((a: HTMLAudioElement) => {
    a.onplay = null;
    a.onpause = null;
    a.onended = null;
    a.onerror = null;
  }, []);

  const stop = useCallback(() => {
    // 1. Cancel any in-flight fetch
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* noop */ }
      abortRef.current = null;
    }
    // 2. Cancel browser speech synthesis
    if (typeof globalThis !== "undefined" && "speechSynthesis" in globalThis) {
      try { globalThis.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    // 3. Hard-stop the audio element
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch { /* noop */ }
      try { a.currentTime = 0; } catch { /* noop */ }
      detachListeners(a);
      try { a.removeAttribute("src"); a.load(); } catch { /* noop */ }
    }
    // 4. Revoke any object URL we created
    if (objectUrlRef.current) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch { /* noop */ }
      objectUrlRef.current = null;
    }
    setIsPlaying(false);
  }, [detachListeners]);

  const play = useCallback(async (src: string) => {
    stop(); // ensure single instance
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    if (src.startsWith("blob:")) objectUrlRef.current = src;

    a.onplay = () => setIsPlaying(true);
    a.onpause = () => setIsPlaying(false);
    a.onended = () => setIsPlaying(false);
    a.onerror = () => setIsPlaying(false);

    a.src = src;
    try {
      await a.play();
    } catch {
      setIsPlaying(false);
    }
  }, [stop]);

  const resume = useCallback(async () => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    try { await a.play(); } catch { /* noop */ }
  }, []);

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    if (typeof globalThis !== "undefined" && "speechSynthesis" in globalThis) {
      try { globalThis.speechSynthesis.pause(); } catch { /* noop */ }
    }
    setIsPlaying(false);
  }, []);

  const speak = useCallback((text: string, lang = "en") => {
    if (!text.trim()) return;
    if (typeof globalThis === "undefined" || !("speechSynthesis" in globalThis)) return;
    stop(); // single source of truth
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = 0.92;
    utt.pitch = 1;
    utt.onstart = () => setIsPlaying(true);
    utt.onend = () => setIsPlaying(false);
    utt.onerror = () => setIsPlaying(false);
    globalThis.speechSynthesis.speak(utt);
  }, [stop]);

  // Cleanup on unmount — never let audio outlive the component.
  useEffect(() => {
    return () => { stop(); };
  }, [stop]);

  return {
    isPlaying,
    currentAudioRef: audioRef,
    play,
    resume,
    pause,
    stop,
    speak,
    abortControllerRef: abortRef,
  };
}
