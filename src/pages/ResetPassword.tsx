import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Moon as MoonIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { StarField } from "@/components/magic/StarField";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Set a new password — Lullaby";
    // Supabase puts the recovery token in the URL hash; detect it.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      // If user lands here without a recovery hash, just allow updating
      setReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated 🌙");
      navigate("/app");
    } catch (err) {
      toast.error("Could not update password", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-night text-foreground flex items-center justify-center p-4 overflow-hidden">
      <StarField density={100} />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-glass border border-foreground/10 rounded-3xl p-8 shadow-dream"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-aurora flex items-center justify-center mb-4">
            <MoonIcon className="w-7 h-7 text-night" />
          </div>
          <h1 className="font-display text-3xl font-bold">Set a new password</h1>
        </div>
        {ready && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p1">New password</Label>
              <Input id="p1" type="password" minLength={6} required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2">Confirm password</Label>
              <Input id="p2" type="password" minLength={6} required
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
            </div>
            <Button type="submit" disabled={loading}
              className="w-full bg-aurora text-night hover:opacity-90 font-bold rounded-xl h-12">
              {loading ? "Saving…" : (<><Sparkles className="w-4 h-4" /> Update password</>)}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
