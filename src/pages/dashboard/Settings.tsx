import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LANGUAGES } from "@/lib/story-config";
import { Sparkles, LogOut } from "lucide-react";

const Settings = () => {
  const { user, signOut } = useAuth();
  const ctx = useOutletContext<{ refreshCredits: () => void; credits: number | null }>();
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Settings — Lullaby";
    if (!user) return;
    supabase.from("profiles").select("display_name,preferred_language")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? "");
          setLanguage(data.preferred_language ?? "en");
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles")
      .update({ display_name: displayName, preferred_language: language })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Save failed");
    else toast.success("Saved ✨");
  };

  return (
    <div className="container max-w-2xl py-8 lg:py-12">
      <h1 className="font-display text-4xl md:text-5xl font-bold mb-2">Settings</h1>
      <p className="text-foreground/60 mb-8">Tune your storytelling experience.</p>

      <div className="space-y-6">
        <div className="bg-glass border border-foreground/10 rounded-3xl p-6 space-y-5">
          <h2 className="font-display text-xl font-bold">Profile</h2>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="bg-foreground/5 border-foreground/15 rounded-xl h-11" />
          </div>
          <div className="space-y-2">
            <Label>Preferred story language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="bg-foreground/5 border-foreground/15 rounded-xl h-11"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving}
            className="bg-aurora text-night hover:opacity-90 font-bold rounded-full px-6 h-11">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>

        <div className="bg-glass border border-accent/30 rounded-3xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-aurora flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-night" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl font-bold">Free credits</h2>
              <p className="text-foreground/60 text-sm mt-1">{ctx?.credits ?? 0} stories remaining on your free trial.</p>
              <p className="text-xs text-foreground/50 mt-3">Subscriptions and credit packs are coming soon.</p>
            </div>
          </div>
        </div>

        <div className="bg-glass border border-destructive/30 rounded-3xl p-6">
          <h2 className="font-display text-xl font-bold mb-2">Sign out</h2>
          <p className="text-foreground/60 text-sm mb-4">You'll need to sign back in to access your stories.</p>
          <Button onClick={signOut} variant="ghost" className="rounded-full hover:bg-destructive/10 text-destructive">
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
