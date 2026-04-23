import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowLeft, ArrowRight, Loader2, Mic, RefreshCw, Wand2, Volume2, Square, Play } from "lucide-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LANGUAGES, MOODS, AGE_RANGES, LENGTHS, randomGradient } from "@/lib/story-config";
import { Link } from "react-router-dom";
// FloatingSparkles intentionally not used in loading states — calm > magical.

interface Voice {
  id: string;
  elevenlabs_voice_id: string;
  label: string;
}

type Step = "voice" | "details" | "story" | "audio" | "done";

const PRESET_VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah (warm)" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda (gentle)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (soft)" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George (calm)" },
];

const CreateStory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ctx = useOutletContext<{ refreshCredits: () => void; credits: number | null }>();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("voice");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [usingPreset, setUsingPreset] = useState(false);

  // Reuse banner — shown when last night's settings are auto-applied.
  const [reusedFrom, setReusedFrom] = useState<string | null>(null);

  // form — pre-filled with warm defaults so a tired parent can hit "Write" in 5 seconds.
  const [childName, setChildName] = useState("Mia");
  const [title, setTitle] = useState("The Moonlit Garden");
  const [theme, setTheme] = useState("A friendly dragon teaches Mia how to grow a garden of stars under the moonlight.");
  const [mood, setMood] = useState("sleepy");
  const [ageRange, setAgeRange] = useState("4-6");
  const [language, setLanguage] = useState("en");
  const [length, setLength] = useState("short");

  // results
  const [storyText, setStoryText] = useState("");
  const [storyId, setStoryId] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [browserNarration, setBrowserNarration] = useState(false);
  const [generating, setGenerating] = useState(false);
  const player = useAudioPlayer();

  useEffect(() => {
    document.title = "Create a story — Lullaby";
    if (!user) return;

    // Load voices + the most recent story in parallel for instant pre-fill.
    const voicesP = supabase.from("voices").select("id,elevenlabs_voice_id,label")
      .eq("user_id", user.id).eq("is_active", true);
    const lastP = supabase.from("stories")
      .select("child_name,theme,mood,age_range,language,length,voice_id,title")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    Promise.all([voicesP, lastP]).then(([{ data: voiceData }, { data: last }]) => {
      const userVoices = voiceData ?? [];
      setVoices(userVoices);

      // Pre-fill form from yesterday's story — the heart of the habit loop.
      if (last) {
        if (last.child_name) setChildName(last.child_name);
        if (last.theme) setTheme(last.theme);
        if (last.mood) setMood(last.mood);
        if (last.age_range) setAgeRange(last.age_range);
        if (last.language) setLanguage(last.language);
        if (last.length) setLength(last.length);
        // Suggest a fresh title — same character, new adventure.
        setTitle(`A new adventure for ${last.child_name}`);
        setReusedFrom(last.child_name);
      }

      // Pick last-used voice (matches yesterday's narration), else first available, else preset.
      const lastVoiceRow = last?.voice_id
        ? userVoices.find((v) => v.id === last.voice_id)
        : null;
      if (lastVoiceRow) {
        setSelectedVoice(lastVoiceRow.elevenlabs_voice_id);
        setUsingPreset(false);
      } else if (userVoices.length > 0) {
        setSelectedVoice(userVoices[0].elevenlabs_voice_id);
        setUsingPreset(false);
      } else {
        setSelectedVoice(PRESET_VOICES[0].id);
        setUsingPreset(true);
      }

      // If the user clicked "Continue yesterday's story" on the dashboard,
      // skip the voice step — voice is already pre-selected from last night.
      if (searchParams.get("reuse") === "1" && last) {
        setStep("details");
      }
    });
  }, [user, searchParams]);


  const friendlyGenError = (msg: string): string => {
    const m = (msg || "").toLowerCase();
    if (m.includes("no_credits") || m.includes("no credits")) return "You've used all 3 free stories. Paid plans launch soon.";
    if (m.includes("rate") || m.includes("429")) return "We're a bit busy right now. Please try again in a moment.";
    if (m.includes("network") || m.includes("failed to fetch")) return "Connection issue. Check your internet and try again.";
    if (m.includes("502") || m.includes("503") || m.includes("timeout")) return "Our story service hiccuped. Tap regenerate to try again.";
    return msg || "Please try again.";
  };

  const handleGenerateStory = async () => {
    if (!childName.trim() || !title.trim()) {
      toast.error("Add your child's name and a story title");
      return;
    }
    if (ctx?.credits !== null && (ctx?.credits ?? 0) <= 0) {
      toast.error("Out of free stories", { description: "Paid plans coming soon — thanks for your patience!" });
      return;
    }
    // Kill any prior narration BEFORE starting a new generation — zero overlap.
    player.stop();
    setBrowserNarration(false);
    setGenerating(true);
    setStep("story");
    try {
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: { childName, title, theme, mood, ageRange, language, length },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStoryText(data.text);
      ctx?.refreshCredits();
    } catch (e) {
      toast.error("Couldn't write the story", { description: friendlyGenError((e as Error).message) });
      setStep("details");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => { player.stop(); await handleGenerateStory(); };

  const speakStoryInBrowser = () => {
    if (!storyText.trim()) return;
    if (!("speechSynthesis" in globalThis)) {
      toast.error("Browser narration not supported on this device");
      return;
    }
    player.speak(storyText, language);
    setBrowserNarration(true);
  };

  const stopNarration = () => {
    player.stop();
    setBrowserNarration(false);
  };

  const handleGenerateAudio = async () => {
    if (!storyText.trim() || !user) return;
    // Stop any previous narration before starting a new one — no overlapping audio.
    player.stop();
    setBrowserNarration(false);
    setGenerating(true);
    setStep("audio");
    try {
      // 1. Create story row
      const voiceRowId = usingPreset
        ? null
        : voices.find((v) => v.elevenlabs_voice_id === selectedVoice)?.id ?? null;

      const { data: insertData, error: insErr } = await supabase
        .from("stories")
        .insert({
          user_id: user.id, voice_id: voiceRowId, title, child_name: childName,
          theme, mood, age_range: ageRange, language, length,
          prompt: theme, text: storyText, cover_gradient: randomGradient(),
        })
        .select("id").single();
      if (insErr) throw insErr;
      const newId = insertData.id;
      setStoryId(newId);

      // 2. Call audio function
      const { data: audioData, error: audioErr } = await supabase.functions.invoke("generate-audio", {
        body: { storyId: newId, text: storyText, voiceId: selectedVoice },
      });
      if (audioErr) throw audioErr;
      if (audioData?.error) throw new Error(audioData.error);

      if (audioData?.fallback === "browser_tts") {
        setAudioUrl(null);
        setBrowserNarration(true);
        setStep("done");
        speakStoryInBrowser();
        toast.success("Story ready with free browser narration", {
          description: "Using your device's built-in voice because ElevenLabs is unavailable.",
        });
        return;
      }

      // 3. Build playable URL from base64
      const url = `data:audio/mpeg;base64,${audioData.audioBase64}`;
      setAudioUrl(url);
      setBrowserNarration(false);
      setStep("done");
      toast.success("Your story is ready ✨", { description: "It's saved to your library too." });
    } catch (e) {
      toast.error("Couldn't record the narration", {
        description: friendlyGenError((e as Error).message) + " Your story text is safe — try narrating again.",
      });
      setStep("story");
    } finally {
      setGenerating(false);
    }
  };

  const noCredits = ctx?.credits !== null && (ctx?.credits ?? 0) <= 0;

  return (
    <div className="container max-w-3xl py-8 lg:py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-4xl md:text-5xl font-bold">Create a story</h1>
        <div className="flex items-center gap-1.5 text-sm text-foreground/60">
          <Sparkles className="w-4 h-4 text-accent" />
          {ctx?.credits ?? "—"} left
        </div>
      </div>

      {/* Progress — labeled steps */}
      {(() => {
        const order: Step[] = ["voice", "details", "story", "audio", "done"];
        const currentIdx = order.indexOf(step);
        const labels = ["Pick a voice", "Add details", "Read the story", "Record narration", "Ready ✨"];
        return (
          <div className="mb-8">
            <div className="flex items-center gap-1.5 mb-2">
              {order.map((s, i) => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i <= currentIdx ? "bg-aurora" : "bg-foreground/10"
                }`} />
              ))}
            </div>
            <p className="text-xs text-foreground/50 tabular-nums">
              Step {currentIdx + 1} of {order.length} · <span className="text-foreground/80">{labels[currentIdx]}</span>
            </p>
          </div>
        );
      })()}

      {/* Reuse banner — invisible until last night's settings are applied. One-tap "start fresh". */}
      {reusedFrom && step !== "done" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 px-4 py-3"
        >
          <div className="w-9 h-9 rounded-full bg-aurora/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">Reusing last night's settings for {reusedFrom}</p>
            <p className="text-xs text-foreground/60 mt-0.5">Same character, voice, and mood — just tap "Write the story".</p>
          </div>
          <button
            onClick={() => {
              setReusedFrom(null);
              setChildName("Mia");
              setTitle("The Moonlit Garden");
              setTheme("A friendly dragon teaches Mia how to grow a garden of stars under the moonlight.");
              setMood("sleepy"); setAgeRange("4-6"); setLanguage("en"); setLength("short");
            }}
            className="text-xs text-foreground/60 hover:text-foreground underline shrink-0 px-3 py-2 min-h-[40px]"
          >
            Start fresh
          </button>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* STEP 1: VOICE */}
        {step === "voice" && (
          <motion.div key="voice"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-glass border border-foreground/10 rounded-3xl p-6 lg:p-8 space-y-6"
          >
            <div>
              <h2 className="font-display text-2xl font-bold mb-1">Choose a voice</h2>
              <p className="text-sm text-foreground/60">
                Your child will hear this voice telling tonight's story. Clone yours for the deepest connection — or pick a soothing preset to start.
              </p>
            </div>

            {voices.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Your cloned voice</p>
                {voices.map((v) => (
                  <button
                    key={v.id} onClick={() => { setSelectedVoice(v.elevenlabs_voice_id); setUsingPreset(false); }}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                      selectedVoice === v.elevenlabs_voice_id && !usingPreset
                        ? "border-accent bg-accent/10 glow-gold"
                        : "border-foreground/10 hover:border-foreground/30"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-aurora flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4 text-night" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{v.label}</p>
                      <p className="text-xs text-foreground/60">Your magical cloned voice</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">Or pick a preset voice</p>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_VOICES.map((v) => (
                  <button
                    key={v.id} onClick={() => { setSelectedVoice(v.id); setUsingPreset(true); }}
                    className={`p-3 rounded-xl border text-sm text-left transition-all ${
                      selectedVoice === v.id && usingPreset
                        ? "border-accent bg-accent/10"
                        : "border-foreground/10 hover:border-foreground/30"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5 inline mr-1.5 text-accent" />
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {voices.length === 0 && (
              <div className="p-4 rounded-2xl bg-pink/10 border border-pink/30">
                <p className="text-sm text-foreground/80">
                  💡 No cloned voice yet?{" "}
                  <Link to="/app/voice" className="text-accent font-semibold underline">
                    Clone yours in 60 seconds →
                  </Link>
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep("details")} disabled={!selectedVoice}
                className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-11">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: DETAILS */}
        {step === "details" && (
          <motion.div key="details"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-glass border border-foreground/10 rounded-3xl p-6 lg:p-8 space-y-5"
          >
            <div>
              <h2 className="font-display text-2xl font-bold mb-1">Story details</h2>
              <p className="text-sm text-foreground/60">
                We've filled in an example to get you started — tweak anything, or hit "Write the story" to use it as-is. Takes about 10 seconds.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="child">Child's name *</Label>
                <Input id="child" value={childName} onChange={(e) => setChildName(e.target.value)}
                  placeholder="Mia" className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Story title *</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="The Moonlit Garden" className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme" className="flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-accent" />
                Your story prompt
                <span className="text-xs text-foreground/50 font-normal ml-1">— describe anything you want!</span>
              </Label>
              <Textarea id="theme" value={theme} onChange={(e) => setTheme(e.target.value)}
                placeholder="A friendly dragon teaches Mia how to grow a garden of stars under the moonlight…"
                rows={4} className="bg-foreground/5 border-foreground/15 rounded-xl resize-none" />
            </div>

            <div>
              <Label className="mb-2 block">Mood</Label>
              <div className="grid grid-cols-5 gap-2">
                {MOODS.map((m) => (
                  <button key={m.value} type="button" onClick={() => setMood(m.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      mood === m.value ? "border-accent bg-accent/10 glow-gold" : "border-foreground/10 hover:border-foreground/30"
                    }`}
                  >
                    <div className="text-2xl">{m.emoji}</div>
                    <div className="text-xs mt-1 font-medium">{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Age range</Label>
                <Select value={ageRange} onValueChange={setAgeRange}>
                  <SelectTrigger className="bg-foreground/5 border-foreground/15 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGE_RANGES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Length</Label>
                <Select value={length} onValueChange={setLength}>
                  <SelectTrigger className="bg-foreground/5 border-foreground/15 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label} · {l.desc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-foreground/5 border-foreground/15 rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {noCredits && (
              <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-sm">
                You've used your 3 free stories. Paid plans launch soon — thank you for being early!
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button onClick={() => setStep("voice")} variant="ghost" className="rounded-full hover:bg-foreground/10">
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button onClick={handleGenerateStory} disabled={generating || noCredits}
                className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-11 shadow-soft">
                <Wand2 className="w-4 h-4" /> Write the story
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: STORY TEXT */}
        {step === "story" && (
          <motion.div key="story"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-glass border border-foreground/10 rounded-3xl p-6 lg:p-8 space-y-5"
          >
            <div>
              <h2 className="font-display text-2xl font-bold mb-1">{generating ? "Writing the story" : "Your story"}</h2>
              <p className="text-sm text-foreground/60">{generating ? `Imagining ${childName}'s adventure — about 10 seconds.` : "Edit it, regenerate, or send it to be narrated."}</p>
            </div>

            {generating ? (
              <div className="py-10 space-y-3" aria-busy="true" aria-live="polite">
                {/* Calm shimmer skeleton — feels like the story is appearing */}
                {[100, 92, 96, 88, 94, 90, 70].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded-full bg-foreground/5 overflow-hidden relative"
                    style={{ width: `${w}%` }}
                  >
                    <div
                      className="absolute inset-0 animate-shimmer"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs text-foreground/50 pt-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Casting characters and finding the magic…</span>
                </div>
              </div>
            ) : (
              <>
                <Textarea value={storyText} onChange={(e) => setStoryText(e.target.value)}
                  rows={14} className="bg-foreground/5 border-foreground/15 rounded-xl font-display text-base leading-relaxed" />
                <div className="flex flex-wrap justify-between gap-3">
                  <Button onClick={() => setStep("details")} variant="ghost" className="rounded-full hover:bg-foreground/10">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </Button>
                  <div className="flex gap-2">
                    <Button onClick={handleRegenerate} variant="ghost" className="rounded-full hover:bg-foreground/10">
                      <RefreshCw className="w-4 h-4" /> Regenerate
                    </Button>
                    {player.isPlaying ? (
                      <Button onClick={stopNarration} variant="ghost" className="rounded-full hover:bg-foreground/10">
                        <Square className="w-4 h-4" /> Stop narration
                      </Button>
                    ) : (
                      <Button onClick={speakStoryInBrowser} variant="ghost" className="rounded-full hover:bg-foreground/10">
                        <Volume2 className="w-4 h-4" /> Play in browser (free)
                      </Button>
                    )}
                    <Button onClick={handleGenerateAudio}
                      className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-11 shadow-soft">
                      <Volume2 className="w-4 h-4" /> Narrate this
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* STEP 4: AUDIO GEN */}
        {step === "audio" && (
          <motion.div key="audio"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-glass border border-foreground/10 rounded-3xl p-10 sm:p-12 text-center"
            aria-busy="true" aria-live="polite"
          >
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-aurora rounded-full blur-xl opacity-50 animate-pulse-glow" />
              <div className="relative w-20 h-20 rounded-full bg-aurora flex items-center justify-center shadow-dream">
                <Volume2 className="w-9 h-9 text-night" />
              </div>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2">Recording the narration</h2>
            <p className="text-foreground/60 text-sm">Bringing {childName}'s story to life · 10–30 seconds</p>
            <div className="mt-6 max-w-xs mx-auto h-1 rounded-full bg-foreground/10 overflow-hidden">
              <div className="h-full animate-shimmer" />
            </div>
          </motion.div>
        )}

        {/* STEP 5: DONE */}
        {step === "done" && storyId && (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-glass border border-accent/40 rounded-3xl p-8 text-center glow-gold"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-aurora flex items-center justify-center shadow-dream">
              <Sparkles className="w-10 h-10 text-night" />
            </div>
            <h2 className="font-display text-3xl font-bold mb-2">It's ready ✨</h2>
            <p className="text-foreground/70 mb-1">Tonight's bedtime story for {childName}.</p>
            <p className="text-sm text-foreground/55 mb-6">
              {audioUrl
                ? "Press play — and create a memory that lasts beyond bedtime."
                : "Using free browser narration mode for this story."}
            </p>
            {audioUrl ? (
              <div className="mb-6 flex flex-col items-center gap-3">
                <audio
                  ref={player.currentAudioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                  onPlay={() => setBrowserNarration(false)}
                />
                <Button
                  onClick={() => player.stop()}
                  variant="secondary"
                  className="rounded-full"
                >
                  <Square className="w-4 h-4" /> Stop narration
                </Button>
              </div>
            ) : (
              <div className="mb-6 flex flex-col items-center gap-3">
                {player.isPlaying ? (
                  <Button onClick={stopNarration} variant="secondary" className="rounded-full">
                    <Square className="w-4 h-4" /> Stop narration
                  </Button>
                ) : (
                  <Button onClick={speakStoryInBrowser} variant="secondary" className="rounded-full">
                    <Play className="w-4 h-4" /> Play browser narration
                  </Button>
                )}
                {browserNarration && player.isPlaying && (
                  <p className="text-xs text-foreground/60">
                    Narration is playing through your device voice.
                  </p>
                )}
              </div>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <Button onClick={() => navigate(`/app/story/${storyId}?autoplay=1`)}
                className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-11">
                Open in player
              </Button>
              <Button onClick={() => {
                player.stop();
                setStep("voice"); setStoryText(""); setStoryId(null); setAudioUrl(null);
                setBrowserNarration(false);
                setChildName("Mia"); setTitle("The Moonlit Garden");
                setTheme("A friendly dragon teaches Mia how to grow a garden of stars under the moonlight.");
              }} variant="ghost" className="rounded-full hover:bg-foreground/10">
                Create another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateStory;
