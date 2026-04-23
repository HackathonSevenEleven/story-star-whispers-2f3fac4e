import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Moon as MoonIcon, Sparkles, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { StarField } from "@/components/magic/StarField";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const Auth = () => {
  const [params] = useSearchParams();
  const initialMode = params.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    document.title = `${mode === "signup" ? "Sign up" : mode === "forgot" ? "Reset password" : "Sign in"} — Lullaby`;
  }, [mode]);

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  const friendlyError = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid_credentials"))
      return "That email and password don't match. Try again or reset your password.";
    if (m.includes("email not confirmed"))
      return "This account needs confirmation. Try signing up again with a different email — sign-up is now instant.";
    if (m.includes("already registered") || m.includes("already exists"))
      return "An account with this email already exists. Try signing in instead.";
    if (m.includes("password") && (m.includes("6") || m.includes("short")))
      return "Password must be at least 6 characters.";
    if (m.includes("rate") || m.includes("too many"))
      return "Too many attempts. Please wait a minute and try again.";
    if (m.includes("network") || m.includes("failed to fetch"))
      return "Connection issue. Check your internet and try again.";
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        // Auto-confirm is on — a session is returned immediately.
        if (data.session) {
          toast.success("Welcome to Lullaby ✨", { description: "You're signed in — let's create your first story." });
          navigate("/app");
        } else {
          // Fallback: immediately sign in (covers brief auto-confirm delays).
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
          if (signInErr) throw signInErr;
          toast.success("Welcome to Lullaby ✨");
          navigate("/app");
        }
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back 🌙");
        navigate("/app");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your inbox", { description: "We sent you a reset link." });
        setMode("login");
      }
    } catch (err) {
      toast.error(mode === "login" ? "Couldn't sign you in" : mode === "signup" ? "Couldn't create your account" : "Couldn't send reset link", {
        description: friendlyError((err as Error).message),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-night text-foreground flex items-center justify-center p-4 overflow-hidden">
      <StarField density={100} />

      <Link to="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-foreground/70 hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">{t("auth.back")}</span>
      </Link>

      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="absolute inset-0 bg-aurora rounded-3xl blur-3xl opacity-20" />
        <div className="relative bg-glass border border-foreground/10 rounded-3xl p-8 shadow-dream">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative w-14 h-14 mb-4">
              <div className="absolute inset-0 bg-aurora rounded-full blur-md opacity-60" />
              <div className="relative w-14 h-14 rounded-full bg-aurora flex items-center justify-center">
                <MoonIcon className="w-7 h-7 text-night" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="font-display text-3xl font-bold">
              {mode === "signup" ? t("auth.signup.title") : mode === "forgot" ? t("auth.forgot.title") : t("auth.login.title")}
            </h1>
            <p className="text-foreground/60 mt-2">
              {mode === "signup"
                ? t("auth.signup.sub")
                : mode === "forgot"
                ? t("auth.forgot.sub")
                : t("auth.login.sub")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input
                  id="name" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Sam"
                  className="bg-foreground/5 border-foreground/15 rounded-xl h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="bg-foreground/5 border-foreground/15 rounded-xl h-11"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-accent hover:underline"
                    >
                      {t("auth.forgot")}
                    </button>
                  )}
                </div>
                <Input
                  id="password" type="password" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-foreground/5 border-foreground/15 rounded-xl h-11"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-aurora text-night hover:opacity-90 font-bold rounded-xl h-12 shadow-soft"
            >
              {loading ? t("auth.loading") : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {mode === "signup" ? t("auth.signup.cta") : mode === "forgot" ? t("auth.forgot.cta") : t("auth.login.cta")}
                </>
              )}
            </Button>

            {mode === "signup" && (
              <p className="text-xs text-center text-foreground/50">
                No email confirmation needed — you'll be signed in instantly.
              </p>
            )}
          </form>

          <div className="mt-6 text-center text-sm text-foreground/60">
            {mode === "signup" ? (
              <>{t("auth.haveAccount")}{" "}
                <button onClick={() => setMode("login")} className="text-accent font-semibold hover:underline">{t("auth.login.cta")}</button>
              </>
            ) : mode === "login" ? (
              <>{t("auth.newHere")}{" "}
                <button onClick={() => setMode("signup")} className="text-accent font-semibold hover:underline">{t("auth.createAccount")}</button>
              </>
            ) : (
              <button onClick={() => setMode("login")} className="text-accent font-semibold hover:underline">{t("auth.backToLogin")}</button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
