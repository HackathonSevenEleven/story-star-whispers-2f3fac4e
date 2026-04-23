import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Mic, BookOpen, Moon as MoonIcon, Heart, Globe2, Shield, Star, Volume2 as Volume2Icon, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StarField } from "@/components/magic/StarField";
import { Moon } from "@/components/magic/Moon";
import { Clouds } from "@/components/magic/Clouds";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const intervalRef = useRef<number | null>(null);
  const ESTIMATED_SECONDS = 272; // matches "4:32" label

  useEffect(() => {
    document.title = "Lullaby — Bedtime stories in your own voice";
  }, []);

  const stopPreview = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    }
    setIsPlaying(false);
  };

  useEffect(() => {
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePreview = () => {
    if (isPlaying) {
      stopPreview();
      return;
    }
    const text = t("hero.snippet");
    setProgress(0);
    if (!("speechSynthesis" in window)) {
      // No TTS support — animate the progress bar only
      setIsPlaying(true);
      const start = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        const p = Math.min(1, elapsed / ESTIMATED_SECONDS);
        setProgress(p);
        if (p >= 1) stopPreview();
      }, 200) as unknown as number;
      return;
    }
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang || "en";
    utt.rate = 0.92;
    utt.pitch = 1;
    utt.onstart = () => {
      setIsPlaying(true);
      const start = Date.now();
      const estSec = Math.max(8, Math.min(ESTIMATED_SECONDS, text.length / 13));
      intervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        setProgress(Math.min(1, elapsed / estSec));
      }, 150);
    };
    utt.onend = () => {
      setProgress(1);
      stopPreview();
    };
    utt.onerror = () => stopPreview();
    window.speechSynthesis.speak(utt);
  };

  return (
    <div className="relative min-h-screen bg-night text-foreground overflow-x-hidden">
      <StarField density={120} />

      {/* NAV */}
      <nav className="relative z-30 container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative w-9 h-9">
            <div className="absolute inset-0 bg-aurora rounded-full blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-9 h-9 rounded-full bg-aurora flex items-center justify-center">
              <MoonIcon className="w-5 h-5 text-night" strokeWidth={2.5} />
            </div>
          </div>
          <span className="font-display text-2xl font-bold text-gradient-gold">Lullaby</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <Button onClick={() => navigate("/app")} className="bg-aurora text-night hover:opacity-90 font-semibold rounded-full px-6">
              {t("nav.openDashboard")}
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-foreground/80 hover:text-foreground rounded-full">
                <Link to="/auth">{t("nav.signIn")}</Link>
              </Button>
              <Button asChild className="bg-aurora text-night hover:opacity-90 font-semibold rounded-full px-6 shadow-dream">
                <Link to="/auth?mode=signup">{t("nav.startFree")}</Link>
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 container pt-12 pb-32 lg:pt-20 lg:pb-40">
        <Clouds className="opacity-40" />
        <div className="absolute right-0 top-10 w-32 h-32 lg:w-48 lg:h-48 lg:right-20">
          <Moon />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glass border border-accent/20 mb-8"
          >
            <Sparkles className="w-4 h-4 text-accent animate-twinkle" />
            <span className="text-sm text-foreground/80 font-medium">{t("hero.badge")}</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight"
          >
            {t("hero.title1")}{" "}
            <span className="text-gradient-aurora">{t("hero.title2")}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-8 text-lg md:text-xl text-foreground/70 leading-relaxed max-w-2xl mx-auto"
          >
            {t("hero.desc")}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              onClick={() => navigate(user ? "/app" : "/auth?mode=signup")}
              size="lg"
              className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-8 h-14 text-base shadow-dream glow-pink"
            >
              <Sparkles className="w-5 h-5 mr-1" />
              {t("hero.cta")}
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="text-foreground/80 hover:text-foreground hover:bg-foreground/5 rounded-full px-6 h-14"
            >
              <a href="#how-it-works">{t("hero.see")}</a>
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex items-center justify-center gap-6 text-sm text-foreground/50"
          >
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> {t("hero.tag.safe")}</span>
            <span className="flex items-center gap-1.5"><Globe2 className="w-4 h-4" /> {t("hero.tag.langs")}</span>
            <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> {t("hero.tag.loved")}</span>
          </motion.div>
        </div>

        {/* Floating story preview card */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="relative mt-20 max-w-3xl mx-auto"
        >
          <div className="absolute inset-0 bg-aurora rounded-3xl blur-3xl opacity-30" />
          <div className="relative bg-glass border border-foreground/10 rounded-3xl p-6 md:p-8 shadow-dream">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-amber-400 flex items-center justify-center text-2xl shadow-soft">
                🌙
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs text-accent font-semibold uppercase tracking-wider">{t("hero.tonight")}</p>
                <h3 className="font-display text-xl font-bold">{t("hero.storyTitle")}</h3>
              </div>
              <div className="hidden md:flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>
            </div>
            <p className="text-left text-foreground/70 leading-relaxed italic">
              "{t("hero.snippet")}"
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={togglePreview}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
                aria-pressed={isPlaying}
                className="w-10 h-10 rounded-full bg-aurora flex items-center justify-center shadow-soft cursor-pointer hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-accent/60"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 text-night" fill="currentColor" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5 text-night">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-aurora rounded-full transition-[width] duration-150 ease-linear"
                  style={{ width: `${Math.max(2, progress * 100)}%` }}
                />
              </div>
              <span className="text-xs text-foreground/50 tabular-nums">
                {isPlaying || progress > 0
                  ? `${Math.floor((progress * ESTIMATED_SECONDS) / 60)}:${String(Math.floor((progress * ESTIMATED_SECONDS) % 60)).padStart(2, "0")}`
                  : "4:32"}
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="relative z-10 container py-20 lg:py-32">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">{t("how.eyebrow")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">{t("how.title")}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {[
            { icon: Mic, title: t("how.s1.title"), desc: t("how.s1.desc"), color: "from-pink-400 to-fuchsia-400" },
            { icon: BookOpen, title: t("how.s2.title"), desc: t("how.s2.desc"), color: "from-purple-400 to-indigo-400" },
            { icon: MoonIcon, title: t("how.s3.title"), desc: t("how.s3.desc"), color: "from-amber-300 to-pink-300" },
          ].map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="group relative"
            >
              <div className="relative bg-glass border border-foreground/10 rounded-3xl p-8 h-full hover:border-accent/30 transition-all hover:-translate-y-1 hover:shadow-dream">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-soft group-hover:scale-110 transition-transform`}>
                  <step.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-foreground/70 leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* DEMO SHOWCASE — replaces pricing for hackathon */}
      <section id="demo" className="relative z-10 container py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">{t("demo.eyebrow")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">{t("demo.title")}</h2>
          <p className="mt-4 text-foreground/70 text-lg">{t("demo.desc")}</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {/* Feature A — Prompt to story */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative bg-glass border border-foreground/10 rounded-3xl p-8 hover:border-accent/30 transition-all hover:-translate-y-1 hover:shadow-dream"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center mb-5 shadow-soft">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-3">{t("demo.a.title")}</h3>
            <p className="text-foreground/70 leading-relaxed mb-5">{t("demo.a.desc")}</p>
            <div className="bg-foreground/5 border border-foreground/10 rounded-2xl p-4 text-sm text-foreground/70 italic">
              "{t("demo.a.example")}"
            </div>
          </motion.div>

          {/* Feature B — Voice choice */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative bg-glass border border-accent/30 rounded-3xl p-8 glow-gold hover:-translate-y-1 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-amber-300 flex items-center justify-center mb-5 shadow-soft">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-display text-2xl font-bold mb-3">{t("demo.b.title")}</h3>
            <p className="text-foreground/70 leading-relaxed mb-5">{t("demo.b.desc")}</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/30">
                <div className="w-8 h-8 rounded-full bg-aurora flex items-center justify-center shrink-0">
                  <Mic className="w-3.5 h-3.5 text-night" />
                </div>
                <span className="text-sm font-semibold">{t("demo.b.voice1")}</span>
                <span className="ml-auto text-xs text-accent font-bold uppercase">★</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-foreground/5 border border-foreground/10">
                <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                  <Volume2Icon className="w-3.5 h-3.5 text-foreground/60" />
                </div>
                <span className="text-sm">{t("demo.b.voice2")}</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="text-center mt-12">
          <Button
            onClick={() => navigate(user ? "/app/create" : "/auth?mode=signup")}
            size="lg"
            className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-8 h-14 text-base shadow-dream"
          >
            <Sparkles className="w-5 h-5 mr-1" />
            {t("demo.cta")}
          </Button>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="relative z-10 container py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">{t("test.eyebrow")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">{t("test.title")}</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { quote: "I work nights. Now my daughter still hears my voice every bedtime. I cried the first time I heard it.", name: "Aisha M.", role: "Mom of two" },
            { quote: "The stories are genuinely beautiful. My son begs for a new one every single night.", name: "Marcus T.", role: "Dad in Seattle" },
            { quote: "Grandma lives across the ocean. We cloned her voice and now she reads to him every night.", name: "Elena R.", role: "Mom of one" },
          ].map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-glass border border-foreground/10 rounded-3xl p-6 hover:border-pink/40 transition-all"
            >
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, k) => <Star key={k} className="w-4 h-4 fill-accent text-accent" />)}
              </div>
              <p className="text-foreground/85 leading-relaxed italic">"{item.quote}"</p>
              <div className="mt-4">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-foreground/50">{item.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 container py-20 lg:py-28 max-w-3xl">
        <div className="text-center mb-12">
          <p className="text-accent font-semibold uppercase tracking-wider text-sm mb-3">{t("faq.eyebrow")}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">{t("faq.title")}</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {[
            { q: "Is voice cloning safe and private?", a: "Your voice sample is private and only used to generate stories for you. We never share your voice or use it to train public models." },
            { q: "How long does cloning take?", a: "About 60 seconds. Record or upload a 30-second clean sample of yourself reading a paragraph, and your voice is ready instantly." },
            { q: "Are the stories really safe for kids?", a: "Yes. Every story is generated with strict safety guidelines: no violence, no scary content, always positive values, and a calm sleepy ending." },
          { q: "What languages are supported?", a: "15+ languages including English, Spanish, French, German, Italian, Portuguese, Japanese, Mandarin, Hindi, Arabic, and more." },
        ].map((item) => (
            <AccordionItem key={item.q} value={item.q} className="bg-glass border border-foreground/10 rounded-2xl px-6">
              <AccordionTrigger className="text-left hover:no-underline font-display text-lg font-semibold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-foreground/70 leading-relaxed">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="relative z-10 container py-20">
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="absolute inset-0 bg-aurora rounded-[3rem] blur-3xl opacity-30" />
          <div className="relative bg-glass border border-accent/30 rounded-[3rem] p-12 lg:p-16 shadow-dream">
            <Moon className="w-20 h-20 mx-auto mb-6" />
            <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
              {t("cta.title1")}{" "}
              <span className="text-gradient-aurora">{t("cta.title2")}</span>
            </h2>
            <p className="mt-6 text-foreground/70 text-lg max-w-xl mx-auto">
              {t("cta.desc")}
            </p>
            <Button
              onClick={() => navigate(user ? "/app" : "/auth?mode=signup")}
              size="lg"
              className="mt-8 bg-aurora text-night hover:opacity-90 font-bold rounded-full px-10 h-14 text-base shadow-dream glow-pink"
            >
              <Sparkles className="w-5 h-5 mr-1" />
              {t("cta.button")}
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 container py-10 border-t border-foreground/10 mt-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-foreground/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-aurora flex items-center justify-center">
              <MoonIcon className="w-3.5 h-3.5 text-night" />
            </div>
            <span className="font-display font-semibold text-foreground/70">Lullaby</span>
            <span>· {t("footer.tag")}</span>
          </div>
          <p>© {new Date().getFullYear()} Lullaby</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
