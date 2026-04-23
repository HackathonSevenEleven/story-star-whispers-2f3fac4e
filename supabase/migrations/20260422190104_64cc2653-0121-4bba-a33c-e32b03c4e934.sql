
-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  free_credits INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- VOICES (one cloned voice per user, but allow multiple history rows)
-- =========================================================
CREATE TABLE public.voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  elevenlabs_voice_id TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'My Voice',
  sample_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voices"
  ON public.voices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own voices"
  ON public.voices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own voices"
  ON public.voices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own voices"
  ON public.voices FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_voices_user ON public.voices(user_id);

-- =========================================================
-- STORIES
-- =========================================================
CREATE TABLE public.stories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  child_name TEXT NOT NULL,
  theme TEXT,
  mood TEXT,
  age_range TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  length TEXT NOT NULL DEFAULT 'medium',
  prompt TEXT,
  text TEXT,
  audio_path TEXT,
  duration_seconds INTEGER,
  cover_gradient TEXT NOT NULL DEFAULT 'from-purple-600 via-pink-500 to-amber-400',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stories"
  ON public.stories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own stories"
  ON public.stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own stories"
  ON public.stories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own stories"
  ON public.stories FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_stories_user_created ON public.stories(user_id, created_at DESC);

-- =========================================================
-- TIMESTAMP TRIGGER FUNCTION
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- STORAGE BUCKETS (private)
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-samples', 'voice-samples', false),
       ('story-audio',   'story-audio',   false);

-- voice-samples policies (per-user folder = first path segment = auth.uid())
CREATE POLICY "Users can read own voice samples"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own voice samples"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own voice samples"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own voice samples"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-samples' AND auth.uid()::text = (storage.foldername(name))[1]);

-- story-audio policies
CREATE POLICY "Users can read own story audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload own story audio"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own story audio"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own story audio"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'story-audio' AND auth.uid()::text = (storage.foldername(name))[1]);
