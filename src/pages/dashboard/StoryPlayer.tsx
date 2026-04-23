import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Play, Pause, Square, Heart, Download, Loader2, SkipBack, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { StarField } from "@/components/magic/StarField";
import { Moon } from "@/components/magic/Moon";
import { AudioVisualizer } from "@/components/magic/AudioVisualizer";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
// FloatingSparkles intentionally not used here — keep player calm.
import { formatDuration } from "@/lib/story-config";

interface Story {
  id: string; title: string; child_name: string; text: string | null;
  cover_gradient: string; duration_seconds: number | null;
  is_favorite: boolean; audio_path: string | null; language: string;
  voice_id: string | null;
}

const StoryPlayer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldAutoplay = searchParams.get("autoplay") === "1";
  const [story, setStory] = useState<Story | null>(null);
  const [voiceLabel, setVoiceLabel] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const player = useAudioPlayer();
  const audioRef = player.currentAudioRef;

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("stories").select("*").eq("id", id).maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) { toast.error("Story not found"); navigate("/app"); return; }
        setStory(data);
        document.title = `${data.title} — Lullaby`;
        // Fetch the persisted voice label so the user sees which voice narrated this story.
        if (data.voice_id) {
          const { data: v } = await supabase.from("voices")
            .select("label").eq("id", data.voice_id).maybeSingle();
          if (v?.label) setVoiceLabel(v.label);
        }
        if (data.audio_path) {
          const { data: signed } = await supabase.storage
            .from("story-audio").createSignedUrl(data.audio_path, 3600);
          if (signed) setAudioUrl(signed.signedUrl);
        }
        setLoadingAudio(false);
      });
  }, [id, user, navigate]);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    let last = 0;
    const tick = () => {
      const now = performance.now();
      // Throttle to ~4 fps for the time label — smooth enough, far cheaper.
      if (now - last < 250) return;
      last = now;
      setCurrent(a.currentTime);
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    };
    const onLoaded = () => {
      setDuration(a.duration);
      // Auto-start playback when arriving from story creation — the emotional payoff.
      if (shouldAutoplay) {
        a.play().then(() => setPlaying(true)).catch(() => {
          // Browser blocked autoplay — user will tap play. No-op.
        });
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", tick);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnd);
    };
  }, [audioUrl, shouldAutoplay, audioRef]);

  const togglePlay = () => {
    const a = audioRef.current; if (!a) return;
    if (playing) { a.pause(); }
    else { a.play().catch(() => { /* user gesture / autoplay block */ }); }
  };

  const stopPlayback = () => {
    player.stop();
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    a.currentTime = pct * duration;
  };

  const skip = (delta: number) => {
    const a = audioRef.current; if (!a || !duration) return;
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
  };

  const toggleFav = async () => {
    if (!story) return;
    const next = !story.is_favorite;
    setStory({ ...story, is_favorite: next });
    await supabase.from("stories").update({ is_favorite: next }).eq("id", story.id);
    toast.success(next ? "Added to favorites" : "Removed from favorites");
  };

  const download = () => {
    if (!audioUrl || !story) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `${story.title.replace(/[^a-z0-9]+/gi, "-")}.mp3`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  if (!story) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-night">
        <StarField />
        <Loader2 className="w-8 h-8 animate-spin text-accent relative" />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${story.cover_gradient} opacity-25`} />
      <div className="absolute inset-0 bg-night/70" />
      <StarField density={40} />

      <div className="relative z-10 container max-w-2xl py-6 lg:py-10">
        <Button onClick={() => navigate("/app")} variant="ghost"
          className="mb-6 rounded-full hover:bg-foreground/10 text-foreground/80">
          <ArrowLeft className="w-4 h-4" /> Back to library
        </Button>

        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-44 h-44 sm:w-52 sm:h-52 mb-7"
          >
            {/* single soft halo, only while playing */}
            {playing && (
              <div className={`absolute -inset-4 bg-gradient-to-br ${story.cover_gradient} rounded-3xl blur-2xl opacity-40 animate-pulse-glow`} />
            )}
            <div className={`relative w-full h-full rounded-3xl bg-gradient-to-br ${story.cover_gradient} shadow-dream flex items-center justify-center overflow-hidden`}>
              <Moon className="w-20 h-20" />
            </div>
          </motion.div>

          <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-2">For {story.child_name}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight max-w-xl">{story.title}</h1>
          {voiceLabel && (
            <p className="mt-2 text-xs text-foreground/60 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              Narrated by {voiceLabel}
            </p>
          )}
        </div>

        {/* Player */}
        <div className="bg-glass border border-foreground/10 rounded-3xl p-5 sm:p-6 mb-6">
          {loadingAudio ? (
            <div className="py-6 text-center text-foreground/60"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading audio…</div>
          ) : !audioUrl ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-foreground/70">Audio isn't ready for this story yet.</p>
              <Button onClick={() => navigate("/app")} variant="ghost" className="rounded-full hover:bg-foreground/10">
                Back to library
              </Button>
            </div>
          ) : (
            <>
              <audio ref={audioRef} src={audioUrl} preload="metadata" crossOrigin="anonymous" />

              {/* Live frequency visualizer — only animates while playing */}
              <div className="mb-4 px-1 opacity-90">
                <AudioVisualizer audioRef={audioRef} playing={playing} />
              </div>

              {/* Scrub bar */}
              <div onClick={handleSeek}
                className="h-2 rounded-full bg-foreground/10 overflow-hidden cursor-pointer group relative touch-none">
                <div className="h-full bg-aurora rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-xs text-foreground/60 mt-2 tabular-nums">
                <span>{formatDuration(Math.floor(current))}</span>
                <span>{formatDuration(Math.floor(duration || story.duration_seconds || 0))}</span>
              </div>

              {/* Transport controls — 48px tap targets */}
              <div className="flex items-center justify-center gap-6 mt-5">
                <button
                  onClick={() => skip(-15)}
                  className="w-12 h-12 rounded-full bg-foreground/5 active:bg-foreground/15 hover:bg-foreground/10 flex items-center justify-center transition-colors"
                  aria-label="Skip back 15 seconds"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-[72px] h-[72px] rounded-full bg-aurora flex items-center justify-center shadow-dream active:scale-95 transition-transform shrink-0"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing
                    ? <Pause className="w-8 h-8 text-night fill-night" />
                    : <Play className="w-8 h-8 text-night fill-night ml-1" />}
                </button>
                <button
                  onClick={() => skip(15)}
                  className="w-12 h-12 rounded-full bg-foreground/5 active:bg-foreground/15 hover:bg-foreground/10 flex items-center justify-center transition-colors"
                  aria-label="Skip forward 15 seconds"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              <div className="flex justify-center mt-4">
                <button
                  onClick={stopPlayback}
                  className="inline-flex items-center gap-2 px-4 h-9 rounded-full bg-foreground/5 hover:bg-foreground/10 active:bg-foreground/15 text-sm text-foreground/80 transition-colors"
                  aria-label="Stop playback"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop
                </button>
              </div>

              <div className="flex justify-center gap-2 mt-5 pt-4 border-t border-foreground/10">
                <Button onClick={toggleFav} variant="ghost" size="sm" className="rounded-full hover:bg-foreground/10">
                  <Heart className={`w-4 h-4 transition-colors ${story.is_favorite ? "fill-pink text-pink" : ""}`} />
                  {story.is_favorite ? "Favorited" : "Favorite"}
                </Button>
                <Button onClick={download} variant="ghost" size="sm" className="rounded-full hover:bg-foreground/10">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Story text */}
        {story.text && (
          <div className="bg-glass border border-foreground/10 rounded-3xl p-6 lg:p-8">
            <h2 className="font-display text-xl font-bold mb-4 text-accent">The story</h2>
            <div className="prose prose-invert max-w-none font-display text-base leading-relaxed text-foreground/85 whitespace-pre-wrap">
              {story.text}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoryPlayer;
