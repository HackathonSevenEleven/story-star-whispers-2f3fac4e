// Edge function: generate-audio
// Calls ElevenLabs TTS with the user's chosen voice, uploads MP3 to story-audio bucket,
// updates the story row with the audio_path.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
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
    const { storyId, text, voiceId } = body as { storyId: string; text: string; voiceId: string };
    if (!storyId || !text || !voiceId) {
      return new Response(JSON.stringify({ error: "storyId, text and voiceId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify story ownership
    const { data: story, error: storyErr } = await supabaseAdmin
      .from("stories").select("id, user_id").eq("id", storyId).single();
    if (storyErr || !story || story.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trim text to a safe length for one TTS call
    const safeText = text.slice(0, 4500);
    // Estimate duration: ~150 wpm narration
    const wordCount = safeText.trim().split(/\s+/).length;
    const duration = Math.round((wordCount / 150) * 60);

    if (!ELEVENLABS_API_KEY) {
      await supabaseAdmin.from("stories")
        .update({ duration_seconds: duration })
        .eq("id", storyId);

      return new Response(JSON.stringify({
        fallback: "browser_tts",
        reason: "ELEVENLABS_UNAVAILABLE",
        duration,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: safeText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.35,
            use_speaker_boost: true,
            speed: 0.95,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("ElevenLabs TTS failed", ttsRes.status, errText);
      await supabaseAdmin.from("stories")
        .update({ duration_seconds: duration })
        .eq("id", storyId);

      return new Response(JSON.stringify({
        fallback: "browser_tts",
        reason: "ELEVENLABS_TTS_FAILED",
        detail: errText,
        duration,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioPath = `${user.id}/${storyId}.mp3`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("story-audio")
      .upload(audioPath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
    if (upErr) {
      console.error("storage upload error", upErr);
      return new Response(JSON.stringify({ error: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabaseAdmin.from("stories")
      .update({ audio_path: audioPath, duration_seconds: duration })
      .eq("id", storyId);

    // Return base64 so client can play immediately without a round-trip
    const audioBase64 = encodeBase64(new Uint8Array(audioBuffer));

    return new Response(JSON.stringify({
      audioPath,
      duration,
      audioBase64,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-audio error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
