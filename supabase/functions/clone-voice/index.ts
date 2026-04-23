// Edge function: clone-voice
// Accepts a base64-encoded audio sample, calls ElevenLabs Instant Voice Clone,
// stores the resulting voice_id on the user's voices table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({
        error: "Voice cloning unavailable",
        code: "ELEVENLABS_UNAVAILABLE",
        detail: "Set ELEVENLABS_API_KEY to enable custom voice cloning.",
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json();
    const { audioBase64, mimeType, label } = body as {
      audioBase64: string; mimeType?: string; label?: string;
    };
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: "audioBase64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // decode base64
    const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
    const ext = (mimeType ?? "audio/webm").includes("mp3") ? "mp3"
              : (mimeType ?? "audio/webm").includes("wav") ? "wav"
              : (mimeType ?? "audio/webm").includes("mpeg") ? "mp3"
              : "webm";
    const blob = new Blob([binary], { type: mimeType ?? "audio/webm" });

    // Upload sample to storage (private)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const samplePath = `${user.id}/sample-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("voice-samples")
      .upload(samplePath, blob, { contentType: mimeType ?? "audio/webm", upsert: true });
    if (uploadErr) console.error("sample upload error", uploadErr);

    // Send to ElevenLabs Instant Voice Clone (multipart)
    const form = new FormData();
    form.append("name", label || `Parent voice ${new Date().toISOString().slice(0,10)}`);
    form.append("files", blob, `sample.${ext}`);
    form.append("description", "Cloned via Lullaby for personalized bedtime stories");

    const evRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });
    if (!evRes.ok) {
      const errText = await evRes.text();
      console.error("ElevenLabs clone failed", evRes.status, errText);

      const lowered = errText.toLowerCase();
      if (
        lowered.includes("paid_plan_required") ||
        lowered.includes("can_not_use_instant_voice_cloning") ||
        lowered.includes("does not include instant voice cloning")
      ) {
        return new Response(JSON.stringify({
          error: "Voice cloning requires a paid ElevenLabs plan",
          code: "VOICE_CLONE_PLAN_REQUIRED",
          detail: "Your current ElevenLabs subscription does not include instant voice cloning. Upgrade your ElevenLabs plan, then try again.",
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (lowered.includes("missing_permissions") || lowered.includes("create_instant_voice_clone")) {
        return new Response(JSON.stringify({
          error: "Voice cloning unavailable for this API key",
          code: "VOICE_CLONE_PERMISSION_MISSING",
          detail: "The current backend key does not include instant voice cloning permission. Update the ElevenLabs key to one with voice cloning access.",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Voice cloning failed", detail: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const evJson = await evRes.json() as { voice_id: string };

    // Deactivate previous voices, insert new one
    await supabaseAdmin.from("voices")
      .update({ is_active: false })
      .eq("user_id", user.id);

    const { data: voiceRow, error: insErr } = await supabaseAdmin
      .from("voices")
      .insert({
        user_id: user.id,
        elevenlabs_voice_id: evJson.voice_id,
        label: label || "My Voice",
        sample_path: samplePath,
        is_active: true,
      })
      .select()
      .single();

    if (insErr) {
      console.error("voice insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ voice: voiceRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("clone-voice error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
