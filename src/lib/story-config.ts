export const LANGUAGES = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "es", label: "Español", flag: "🇪🇸" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "pt", label: "Português", flag: "🇵🇹" },
  { value: "nl", label: "Nederlands", flag: "🇳🇱" },
  { value: "sv", label: "Svenska", flag: "🇸🇪" },
  { value: "ja", label: "日本語", flag: "🇯🇵" },
  { value: "zh", label: "中文", flag: "🇨🇳" },
  { value: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { value: "ar", label: "العربية", flag: "🇸🇦" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "pl", label: "Polski", flag: "🇵🇱" },
  { value: "tr", label: "Türkçe", flag: "🇹🇷" },
] as const;

export const MOODS = [
  { value: "calm", label: "Calm", emoji: "🌙", desc: "Soft and soothing" },
  { value: "magical", label: "Magical", emoji: "✨", desc: "Enchanting wonder" },
  { value: "funny", label: "Funny", emoji: "🤭", desc: "Gentle humor" },
  { value: "adventure", label: "Adventure", emoji: "🗺️", desc: "Brave and curious" },
  { value: "sleepy", label: "Sleepy", emoji: "😴", desc: "Drift right off" },
] as const;

export const AGE_RANGES = [
  { value: "2-4", label: "2–4 years" },
  { value: "4-6", label: "4–6 years" },
  { value: "6-8", label: "6–8 years" },
  { value: "8-10", label: "8–10 years" },
] as const;

export const LENGTHS = [
  { value: "short", label: "Short", desc: "~2 minutes" },
  { value: "medium", label: "Medium", desc: "~5 minutes" },
  { value: "long", label: "Long", desc: "~8 minutes" },
] as const;

export const COVER_GRADIENTS = [
  "from-purple-600 via-pink-500 to-amber-400",
  "from-indigo-600 via-purple-500 to-pink-400",
  "from-blue-700 via-indigo-500 to-purple-400",
  "from-fuchsia-600 via-pink-500 to-rose-400",
  "from-violet-700 via-fuchsia-500 to-amber-300",
  "from-sky-600 via-purple-500 to-pink-400",
  "from-rose-600 via-amber-400 to-yellow-300",
  "from-emerald-600 via-teal-400 to-cyan-300",
];

export const randomGradient = () =>
  COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)];

export const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};
