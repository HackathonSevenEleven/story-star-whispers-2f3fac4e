
# Bedtime Stories in Your Voice — Phase 1 MVP

A magical SaaS where parents clone their voice once and generate personalized bedtime stories narrated as themselves.

## Tech approach (Lovable-adapted)
- **Frontend**: React + Vite + TypeScript, Tailwind, Shadcn UI, Framer Motion
- **Backend**: Lovable Cloud (Postgres, Auth, Storage, Edge Functions) — replaces Next.js API routes / Prisma / NextAuth
- **AI**: OpenRouter (story text) + ElevenLabs (Instant Voice Clone + TTS), both via secure edge functions
- **Payments**: Skipped for now — free trial credits per user
- **Skipped**: Backend rate limiting (not supported), Stripe, Next.js-specific patterns

## Design system (Pixar-quality, dreamy)
- Palette: deep purple `#2A1B4D`, midnight blue `#0F1442`, warm pink `#FFB3C7`, gold `#F4C95D`, soft cyan `#A8E6F0`
- Glowing gradients, floating stars/moons/clouds (animated SVG), aurora glows, soft glass cards
- Typography: rounded display font for headings (Fraunces / Quicksand), clean sans for body
- Motion: parallax stars, gentle floats, page-fade transitions, hover lifts, sparkle micro-interactions

## Pages & flows

### 1. Landing page (public)
- Hero: animated night-sky background with drifting stars/moon, headline "Turn your voice into magical bedtime stories", CTA "Start free"
- "How it works" — 3 illustrated steps (Clone voice → Pick a theme → Listen tonight)
- Example stories carousel with mini audio players (preset demo voices)
- Pricing (free trial highlighted, paid tiers shown as "coming soon")
- Parent testimonials
- FAQ accordion
- Footer

### 2. Auth
- Sign up, login, forgot password (email + password via Cloud Auth)
- Auto-redirect logged-in users to dashboard

### 3. Dashboard (protected, with sidebar)
Sidebar: My Stories · Create Story · My Voice · Settings
- **My Stories**: grid of story cards (cover gradient, title, child name, duration, play/download/favorite/delete, regenerate)
- **My Voice**: shows cloned voice status; record (mic) or upload a 30s sample; preview; re-clone
- **Create Story** (wizard, animated step transitions):
  1. Choose voice (cloned voice or preset fallback)
  2. Story details: child name, title, theme/description, age range, mood (calm/funny/magical/adventure/sleepy), length (short/medium/long), **language**
  3. Generating story text (OpenRouter, streamed preview) — user can edit/regenerate
  4. Generating audio (ElevenLabs TTS in chosen voice) — progress UI
  5. Done → play, download mp3, save to library
- **Settings**: profile, sign out, credits remaining

### 4. Story player
- Immersive full-screen night-sky player: large cover, waveform/progress, play/pause/scrub, download, favorite

## Backend (Lovable Cloud)

### Database tables
- `profiles` (user info, free credits remaining, preferred language)
- `voices` (user_id, elevenlabs_voice_id, label, sample storage path, created_at)
- `stories` (user_id, title, child_name, theme, mood, age_range, language, prompt, text, audio_url, duration, cover_gradient, is_favorite, created_at)

All with RLS — users only see their own rows. Storage buckets for `voice-samples` (private) and `story-audio` (private with signed URLs).

### Edge functions (keys never exposed to client)
- `clone-voice` — uploads sample to ElevenLabs Instant Voice Clone, stores voice_id
- `generate-story` — calls OpenRouter with safety-tuned prompt (positive values, calm ending, child name woven in, age-appropriate, in chosen language), decrements credits
- `generate-audio` — ElevenLabs TTS with the user's voice_id, saves mp3 to storage
- `delete-voice` / cleanup helpers

### Free trial logic
- New user gets **3 free stories**
- Voice clone is free (one re-clone allowed)
- Counter shown in dashboard; blocks generation at 0 with a friendly "coming soon" upgrade modal

## Secrets needed (I'll request after you approve)
- `OPENROUTER_API_KEY`
- `ELEVENLABS_API_KEY`

## What's intentionally NOT in phase 1
- Stripe / paid subscriptions (free trial only)
- Background lullaby music
- AI cover images (using generated gradients instead)
- Scheduled nightly stories, family accounts
- Social login (email/password only — easy to add later)

Phase 2 candidates: Stripe subscriptions, AI cover images, lullaby music bed, scheduling, family profiles.
