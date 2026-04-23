// Edge function: generate-story
// Calls OpenRouter to write a child-safe bedtime story with the given parameters.
// Decrements the user's free_credits by 1 BEFORE generation (atomic check).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian",
  pt: "Portuguese", nl: "Dutch", sv: "Swedish", ja: "Japanese", zh: "Mandarin Chinese",
  hi: "Hindi", ar: "Arabic", ko: "Korean", pl: "Polish", tr: "Turkish",
};

const LENGTH_TARGETS: Record<string, string> = {
  short: "around 250-350 words (about 2 minutes when read aloud)",
  medium: "around 500-700 words (about 4-5 minutes when read aloud)",
  long: "around 900-1200 words (about 7-8 minutes when read aloud)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")?.trim();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")?.trim();
    if (!OPENROUTER_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Missing OPENROUTER_API_KEY and LOVABLE_API_KEY");
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
    const {
      childName, title, theme, mood, ageRange, language = "en", length = "medium",
    } = body as Record<string, string>;

    if (!childName || !title) {
      return new Response(JSON.stringify({ error: "childName and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check & decrement credits atomically
    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles").select("free_credits").eq("user_id", user.id).single();
    if (profErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.free_credits <= 0) {
      return new Response(JSON.stringify({ error: "No credits remaining", code: "NO_CREDITS" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langName = LANG_NAMES[language] ?? "English";
    const lengthTarget = LENGTH_TARGETS[length] ?? LENGTH_TARGETS.medium;

    const systemPrompt = `You are a master bedtime storyteller for young children. You write tender, calming, imaginative stories that feel hand-crafted and Pixar-quality. Your stories are 100% child-safe: no violence, no scary content, no sad endings, no death, no conflict that isn't resolved gently. Always include positive values like kindness, courage, friendship, curiosity, or gratitude — woven naturally, never preachy. The child's name is the hero. End every story with a soft, sleepy, peaceful resolution that helps the child drift off to sleep.`;

    const userPrompt = `Write a bedtime story in ${langName}.

Title: "${title}"
Hero (child's name to weave naturally throughout): ${childName}
Theme / setting: ${theme || "a magical adventure of the storyteller's choice"}
Mood: ${mood || "calm and magical"}
Audience age: ${ageRange || "4-8 years"}
Length: ${lengthTarget}

Rules:
- Write the story body only. No title, no headings, no preface, no "The End".
- Use short, rhythmic, read-aloud sentences.
- Use the child's name naturally — at least 4-6 times across the story.
- Build a calm pace; the final 2-3 paragraphs must wind down toward sleep (yawning, closing eyes, soft moonlight, whispered goodnight).
- Output ONLY in ${langName}. No translations, no extra commentary.`;

    // Provider chain: prefer Lovable AI (no external key needed), fall back to OpenRouter free models
    type Provider = {
      name: string;
      url: string;
      apiKey: string;
      model: string;
      extraHeaders?: Record<string, string>;
    };

    const providers: Provider[] = [];
    if (LOVABLE_API_KEY) {
      providers.push({
        name: "lovable-ai",
        url: "https://ai.gateway.lovable.dev/v1/chat/completions",
        apiKey: LOVABLE_API_KEY,
        model: "google/gemini-3-flash-preview",
      });
    }
    if (OPENROUTER_API_KEY) {
      const orChain = (
        Deno.env.get("OPENROUTER_MODEL_CHAIN") ??
        "google/gemini-2.0-flash-exp:free,meta-llama/llama-3.3-70b-instruct:free,qwen/qwen3-coder:free"
      )
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      for (const model of orChain) {
        providers.push({
          name: `openrouter:${model}`,
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: OPENROUTER_API_KEY,
          model,
          extraHeaders: { "HTTP-Referer": "https://lullaby.app", "X-Title": "Lullaby" },
        });
      }
    }

    let text = "";
    let lastErrorDetail = "Unknown provider error";
    let sawRateLimit = false;
    let sawPaymentRequired = false;

    for (const provider of providers) {
      const orRes = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
          ...(provider.extraHeaders ?? {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.85,
          max_tokens: 2000,
        }),
      });

      if (!orRes.ok) {
        const errText = await orRes.text();
        lastErrorDetail = errText || `${provider.name} status ${orRes.status}`;
        if (orRes.status === 429) sawRateLimit = true;
        if (orRes.status === 402) sawPaymentRequired = true;
        console.error("Provider failed", { provider: provider.name, status: orRes.status, detail: errText });
        continue;
      }

      const orJson = await orRes.json();
      const candidate = (orJson.choices?.[0]?.message?.content ?? "").trim();
      if (!candidate) {
        lastErrorDetail = `Empty response from ${provider.name}`;
        console.error("Provider returned empty content", { provider: provider.name });
        continue;
      }

      text = candidate;
      break;
    }

    if (!text) {
      if (sawPaymentRequired) {
        return new Response(JSON.stringify({
          error: "AI credits exhausted",
          code: "PAYMENT_REQUIRED",
          detail: "Add Lovable AI credits in Settings → Workspace → Usage, or configure a working OPENROUTER_API_KEY.",
        }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (sawRateLimit) {
        return new Response(JSON.stringify({
          error: "Story generation is temporarily rate-limited",
          code: "RATE_LIMITED",
          detail: "Please retry in 20-60 seconds.",
        }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Story generation failed", detail: lastErrorDetail }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrement credits on success
    await supabaseAdmin.from("profiles")
      .update({ free_credits: profile.free_credits - 1 })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-story error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
