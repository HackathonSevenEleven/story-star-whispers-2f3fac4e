import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Play, Heart, Trash2, Download, Plus, Moon, Clock, BookHeart, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDuration } from "@/lib/story-config";

interface Story {
  id: string;
  title: string;
  child_name: string;
  cover_gradient: string;
  duration_seconds: number | null;
  is_favorite: boolean;
  audio_path: string | null;
  created_at: string;
  language: string;
}

// Group stories by relative date — turns a flat list into a "memory timeline".
const groupByDate = (stories: Story[]) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  const groups: Record<string, Story[]> = { Today: [], Yesterday: [], "This week": [], Earlier: [] };
  for (const s of stories) {
    const d = new Date(s.created_at);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= weekAgo) groups["This week"].push(s);
    else groups.Earlier.push(s);
  }
  return groups;
};

const MyStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Tonight's story — Lullaby";
    if (!user) return;
    supabase
      .from("stories")
      .select("id,title,child_name,cover_gradient,duration_seconds,is_favorite,audio_path,created_at,language")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) { toast.error("Could not load stories"); return; }
        const list = data ?? [];
        // First-time users: skip the empty library and drop them straight into the guided story flow.
        if (list.length === 0 && !sessionStorage.getItem("lullaby_onboarded")) {
          sessionStorage.setItem("lullaby_onboarded", "1");
          navigate("/app/create", { replace: true });
          return;
        }
        setStories(list);
      });
  }, [user, navigate]);

  const toggleFav = async (s: Story) => {
    setStories((prev) => prev?.map((x) => x.id === s.id ? { ...x, is_favorite: !x.is_favorite } : x) ?? null);
    await supabase.from("stories").update({ is_favorite: !s.is_favorite }).eq("id", s.id);
  };

  const handleDelete = async (s: Story) => {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    setStories((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
    if (s.audio_path) await supabase.storage.from("story-audio").remove([s.audio_path]);
    await supabase.from("stories").delete().eq("id", s.id);
    toast.success("Story removed from your storybook");
  };

  const handleDownload = async (s: Story) => {
    if (!s.audio_path) return;
    const { data, error } = await supabase.storage.from("story-audio").createSignedUrl(s.audio_path, 60);
    if (error || !data) { toast.error("Download failed"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = `${s.title.replace(/[^a-z0-9]+/gi, "-")}.mp3`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Derived: the most recent story powers the "Continue yesterday's story" card.
  const lastStory = stories && stories.length > 0 ? stories[0] : null;

  // Time-aware greeting — anchors the app to the bedtime moment.
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 18 || h < 4) return { lead: "Good evening", hint: "Bedtime is near — they'll expect your story tonight." };
    if (h >= 12) return { lead: "Good afternoon", hint: "A quiet moment to set up tonight's story." };
    return { lead: "Good morning", hint: "Make this part of your child's nightly routine." };
  }, []);

  // Persist last story's recipe so CreateStory can pre-fill in <30 seconds on the next visit.
  const handleContinue = (s: Story) => {
    try {
      localStorage.setItem("lullaby_last_story", JSON.stringify({
        childName: s.child_name,
        cover_gradient: s.cover_gradient,
      }));
    } catch { /* storage may be blocked — defaults still work */ }
    navigate("/app/create?reuse=1");
  };

  const handleNewTonight = () => {
    if (lastStory) {
      try {
        localStorage.setItem("lullaby_last_story", JSON.stringify({
          childName: lastStory.child_name,
        }));
      } catch { /* noop */ }
    }
    navigate("/app/create");
  };

  // Frequently-replayed = favorites. Surface them as "Bedtime classics".
  const classics = stories?.filter((s) => s.is_favorite) ?? [];
  const groups = stories ? groupByDate(stories) : null;

  return (
    <div className="container max-w-6xl py-8 lg:py-12">
      {/* TONIGHT'S STORY HERO — the daily ritual cue */}
      {stories && stories.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-accent/30 bg-glass mb-10 p-6 sm:p-8 lg:p-10 shadow-dream"
        >
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-aurora opacity-20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-center">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Moon className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Tonight's story</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
                {greeting.lead} — ready for tonight's bedtime?
              </h1>
              <p className="text-foreground/70 mt-3 max-w-xl text-sm sm:text-base">
                {greeting.hint}
              </p>
              <p className="text-xs text-foreground/50 mt-3 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Most parents create tonight's story around 8–9 PM.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  onClick={handleNewTonight}
                  className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-12 shadow-soft"
                >
                  <Sparkles className="w-4 h-4" /> Create tonight's story
                </Button>
                {lastStory && (
                  <Button
                    onClick={() => handleContinue(lastStory)}
                    variant="ghost"
                    className="rounded-full hover:bg-foreground/10 h-12 px-5 border border-foreground/15"
                  >
                    Same character, new adventure <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Yesterday's story — one-tap continuity */}
            {lastStory && (
              <button
                onClick={() => navigate(`/app/story/${lastStory.id}?autoplay=1`)}
                className="group text-left w-full lg:w-72 shrink-0 rounded-2xl border border-foreground/10 bg-night/30 hover:border-accent/40 hover:bg-night/50 transition-all p-4 active:scale-[0.99]"
                aria-label={`Replay last story: ${lastStory.title}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`relative w-14 h-14 rounded-xl bg-gradient-to-br ${lastStory.cover_gradient} flex items-center justify-center shrink-0`}>
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">Last night</p>
                    <p className="font-display font-bold leading-tight line-clamp-1">{lastStory.title}</p>
                    <p className="text-xs text-foreground/60 mt-0.5">For {lastStory.child_name} · tap to replay</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </motion.section>
      )}

      {/* STORYBOOK HEADER */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookHeart className="w-5 h-5 text-accent" />
            <h2 className="font-display text-2xl md:text-3xl font-bold">Your storybook</h2>
          </div>
          <p className="text-foreground/60 text-sm">Your very own family storybook — a memory for every night.</p>
        </div>
        {stories && stories.length > 0 && (
          <Button asChild variant="ghost" className="rounded-full hover:bg-foreground/10 border border-foreground/15 h-11 px-5">
            <Link to="/app/create"><Plus className="w-4 h-4" /> New story</Link>
          </Button>
        )}
      </div>

      {stories === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 mx-auto rounded-full bg-aurora/20 flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-accent" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Your storybook is waiting</h2>
          <p className="text-foreground/60 mb-6">Cast your first spell — your child is waiting for tonight's story.</p>
          <Button asChild className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-12">
            <Link to="/app/create"><Sparkles className="w-4 h-4" /> Create tonight's story</Link>
          </Button>
          <p className="text-xs text-foreground/50 mt-6">🔒 Your stories are private — only you can see them.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* BEDTIME CLASSICS — favorites surfaced as a memory shelf */}
          {classics.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink fill-pink" />
                <h3 className="font-display text-lg font-bold">Bedtime classics</h3>
                <span className="text-xs text-foreground/50">· your child's favorites</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {classics.slice(0, 3).map((s, i) => (
                  <StoryCard key={s.id} story={s} index={i}
                    onPlay={() => navigate(`/app/story/${s.id}`)}
                    onFav={() => toggleFav(s)}
                    onDownload={() => handleDownload(s)}
                    onDelete={() => handleDelete(s)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* TIMELINE BY DATE — feels like a diary, not a folder */}
          {groups && Object.entries(groups).map(([label, list]) =>
            list.length === 0 ? null : (
              <section key={label}>
                <h3 className="font-display text-lg font-bold mb-3 text-foreground/80">{label}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {list.map((s, i) => (
                    <StoryCard key={s.id} story={s} index={i}
                      onPlay={() => navigate(`/app/story/${s.id}`)}
                      onFav={() => toggleFav(s)}
                      onDownload={() => handleDownload(s)}
                      onDelete={() => handleDelete(s)}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
};

// Extracted card so the timeline + classics share one source of truth.
const StoryCard = ({
  story: s, index: i, onPlay, onFav, onDownload, onDelete,
}: {
  story: Story; index: number;
  onPlay: () => void; onFav: () => void; onDownload: () => void; onDelete: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.2) }}
    className="group relative bg-glass border border-foreground/10 rounded-3xl overflow-hidden hover:border-accent/40 transition-all hover:-translate-y-1 hover:shadow-dream cursor-pointer"
    onClick={onPlay}
  >
    <div className={`relative h-40 bg-gradient-to-br ${s.cover_gradient} flex items-center justify-center`}>
      <div className="absolute inset-0 bg-night/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-3 right-3 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onFav(); }}
          className="w-9 h-9 rounded-full bg-night/40 backdrop-blur-md flex items-center justify-center hover:bg-night/60 transition"
          aria-label="Favorite"
        >
          <Heart className={`w-4 h-4 ${s.is_favorite ? "fill-pink text-pink" : "text-white"}`} />
        </button>
      </div>
      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
        <Play className="w-7 h-7 text-white fill-white ml-1" />
      </div>
    </div>
    <div className="p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-display text-lg font-bold leading-tight line-clamp-1">{s.title}</h3>
        <span className="text-xs text-foreground/50 shrink-0">{formatDuration(s.duration_seconds)}</span>
      </div>
      <p className="text-sm text-foreground/60">For {s.child_name}</p>
      <div className="mt-4 flex items-center gap-2 opacity-90">
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          disabled={!s.audio_path}
          className="rounded-full h-10 px-4 text-xs hover:bg-foreground/10"
        ><Download className="w-4 h-4" /> Download</Button>
        <Button
          size="sm" variant="ghost"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete story"
          className="rounded-full h-10 w-10 p-0 hover:bg-destructive/20 hover:text-destructive ml-auto"
        ><Trash2 className="w-4 h-4" /></Button>
      </div>
    </div>
  </motion.div>
);

export default MyStories;
