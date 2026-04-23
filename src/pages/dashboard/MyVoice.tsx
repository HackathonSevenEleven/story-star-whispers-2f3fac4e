import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Square, Upload, CheckCircle2, Loader2, Trash2, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Waveform } from "@/components/magic/Waveform";
// FloatingSparkles intentionally not used during cloning — clarity > magic.

interface Voice {
  id: string;
  elevenlabs_voice_id: string;
  label: string;
  is_active: boolean;
  sample_path: string | null;
  created_at: string;
}

const MyVoice = () => {
  const { user } = useAuth();
  const [voice, setVoice] = useState<Voice | null | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [label, setLabel] = useState("My Voice");
  const [cloning, setCloning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "My voice — Lullaby";
    if (!user) return;
    supabase
      .from("voices").select("*").eq("user_id", user.id).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setVoice(data));
  }, [user]);

  // Preview the saved voice sample so the user can confirm their voice persisted.
  const previewVoice = async () => {
    if (!voice?.sample_path) {
      toast.info("No preview available", { description: "The original recording sample isn't stored." });
      return;
    }
    const { data, error } = await supabase.storage
      .from("voice-samples").createSignedUrl(voice.sample_path, 300);
    if (error || !data) {
      toast.error("Couldn't load preview");
      return;
    }
    const audio = new Audio(data.signedUrl);
    audio.play().catch(() => toast.error("Tap again to play"));
  };

  const startRecording = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      const mr = new MediaRecorder(s);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => {
        setSeconds((sec) => {
          if (sec >= 60) { stopRecording(); return sec; }
          return sec + 1;
        });
      }, 1000);
    } catch (e) {
      toast.error("Microphone access required", { description: (e as Error).message });
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecordedBlob(file);
    setRecordedUrl(URL.createObjectURL(file));
  };

  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      resolve(s.split(",")[1]);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

  const handleClone = async () => {
    if (!recordedBlob) return;
    setCloning(true);
    try {
      const audioBase64 = await blobToBase64(recordedBlob);
      const { data, error } = await supabase.functions.invoke("clone-voice", {
        body: { audioBase64, mimeType: recordedBlob.type, label },
      });

      // Extract JSON body from non-2xx response (Supabase wraps it in error.context)
      let payload: any = data;
      if (error) {
        const ctx = (error as any).context;
        if (ctx && typeof ctx.json === "function") {
          try { payload = await ctx.json(); } catch { /* ignore */ }
        } else if (ctx && typeof ctx.text === "function") {
          try { payload = JSON.parse(await ctx.text()); } catch { /* ignore */ }
        }
      }

      const errCode: string = payload?.code ?? "";
      const errMsg: string = payload?.error ?? (error as Error | null)?.message ?? "";
      const errDetail: string = payload?.detail ?? "";
      const normalized = `${errCode} ${errMsg} ${errDetail}`.toLowerCase();

      if (error || payload?.error) {
        if (
          normalized.includes("voice_clone_plan_required") ||
          normalized.includes("paid_plan_required") ||
          normalized.includes("can_not_use_instant_voice_cloning") ||
          normalized.includes("does not include instant voice cloning") ||
          normalized.includes("voice cloning requires a paid")
        ) {
          toast.error("Voice cloning requires a paid ElevenLabs plan", {
            description: "Upgrade your ElevenLabs subscription to enable instant voice cloning, then try again.",
          });
        } else if (
          normalized.includes("voice_clone_permission_missing") ||
          normalized.includes("create_instant_voice_clone") ||
          normalized.includes("missing_permissions")
        ) {
          toast.error("Voice cloning isn't enabled on the current backend key", {
            description: "Update the ElevenLabs API key so it includes instant voice cloning access, then try again.",
          });
        } else if (normalized.includes("elevenlabs_unavailable") || normalized.includes("voice cloning unavailable")) {
          toast.error("Voice cloning unavailable on free mode", {
            description: "You can still narrate stories using free preset/browser voices.",
          });
        } else {
          toast.error("Cloning failed", { description: errMsg || errDetail || "Please try again." });
        }
        return;
      }

      setVoice(payload.voice);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedBlob(null);
      setRecordedUrl(null);
      setSeconds(0);
      toast.success("Your voice is ready", { description: "Try it on a new bedtime story." });
    } catch (e) {
      toast.error("Cloning failed", { description: (e as Error).message });
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Your voice</h1>
        <p className="text-foreground/70 mt-2">
          Your child will hear <em>you</em> tell every story — even when you're not in the room. Record once, narrate forever.
        </p>
        <p className="text-xs text-foreground/50 mt-3 inline-flex items-center gap-1.5">
          🔒 Your recording is private and only used to narrate your stories.
        </p>
      </div>

      {voice === undefined ? (
        <Skeleton className="h-32 rounded-3xl" />
      ) : voice ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-glass border border-accent/30 rounded-3xl p-6 mb-8 glow-gold"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-aurora flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-night" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-accent font-semibold uppercase tracking-wider">Active voice</p>
              <h3 className="font-display text-xl font-bold truncate">{voice.label}</h3>
              <p className="text-sm text-foreground/60">
                Saved {new Date(voice.created_at).toLocaleDateString()} · used for every new story
              </p>
            </div>
            {voice.sample_path && (
              <Button
                onClick={previewVoice}
                variant="ghost"
                size="sm"
                className="rounded-full hover:bg-foreground/10 shrink-0"
              >
                <Play className="w-4 h-4" /> Preview
              </Button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="bg-glass border border-foreground/10 rounded-3xl p-6 mb-8">
          <p className="text-foreground/70">No voice yet — record a 30-second sample below to get started.</p>
        </div>
      )}

      <div className="bg-glass border border-foreground/10 rounded-3xl p-6 lg:p-8">
        <h2 className="font-display text-2xl font-bold mb-1">{voice ? "Re-record your voice" : "Record your voice"}</h2>
        <p className="text-sm text-foreground/60 mb-6">
          Speak naturally for ~30 seconds in a quiet room. Read a few sentences — even a favorite bedtime line works.
        </p>

        <div className="flex flex-col items-center gap-5 py-4">
          {/* Mic + progress ring (single focal element) */}
          <div className="relative w-36 h-36 flex items-center justify-center">
            {recording && (
              <svg className="absolute inset-0 -rotate-90 motion-reduce:hidden" viewBox="0 0 144 144" aria-hidden>
                <circle cx="72" cy="72" r="66" fill="none"
                  stroke="hsl(var(--foreground) / 0.08)" strokeWidth="3" />
                <circle cx="72" cy="72" r="66" fill="none"
                  stroke="hsl(var(--accent))" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 66}
                  strokeDashoffset={2 * Math.PI * 66 * (1 - seconds / 60)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
              </svg>
            )}
            <button
              type="button"
              onClick={recording ? stopRecording : startRecording}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
                recording
                  ? "bg-destructive/15 ring-2 ring-destructive/40"
                  : "bg-aurora shadow-dream hover:shadow-[0_24px_70px_-18px_hsl(265_70%_30%/0.7)]"
              }`}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording
                ? <Square className="w-8 h-8 text-destructive fill-destructive" />
                : <Mic className="w-10 h-10 text-night" strokeWidth={2.5} />}
            </button>
          </div>

          {/* Live waveform — only while recording */}
          {recording && (
            <div className="w-full flex justify-center">
              <Waveform active stream={stream} />
            </div>
          )}

          <div className="text-center min-h-[3rem]">
            {recording ? (
              <>
                <p className="font-display text-2xl font-bold tabular-nums">{seconds}s <span className="text-foreground/40 text-base font-sans">/ 60s</span></p>
                <p className="text-sm text-foreground/60 mt-1">Tap to stop when done</p>
              </>
            ) : recordedBlob ? (
              <p className="text-sm text-foreground/70">Sample ready · {Math.round(recordedBlob.size / 1024)} KB</p>
            ) : (
              <p className="text-sm text-foreground/60">Tap the mic to start</p>
            )}
          </div>

          {!recording && !recordedBlob && (
            <label className="cursor-pointer">
              <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} />
              <span className="text-sm text-accent hover:underline inline-flex items-center gap-1">
                <Upload className="w-3.5 h-3.5" /> or upload a file
              </span>
            </label>
          )}
        </div>

        {recordedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-4 pt-5 mt-2 border-t border-foreground/10"
          >
            <audio src={recordedUrl} controls className="w-full" />
            <div className="space-y-2">
              <Label htmlFor="voice-label">Voice label</Label>
              <Input id="voice-label" value={label} onChange={(e) => setLabel(e.target.value)}
                className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                  setRecordedBlob(null); setRecordedUrl(null); setSeconds(0);
                }}
                variant="ghost" className="rounded-full hover:bg-foreground/10"
                disabled={cloning}
              ><Trash2 className="w-4 h-4" /> Discard</Button>
              <Button
                onClick={handleClone} disabled={cloning}
                className="flex-1 bg-aurora text-night hover:opacity-90 font-bold rounded-full h-12 shadow-soft"
              >
                {cloning ? (<><Loader2 className="w-4 h-4 animate-spin" /> Cloning your voice…</>) :
                  (<><Sparkles className="w-4 h-4" /> Clone my voice</>)}
              </Button>
            </div>
            {cloning && (
              <p className="text-xs text-center text-foreground/50">This takes about 10–20 seconds.</p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MyVoice;
