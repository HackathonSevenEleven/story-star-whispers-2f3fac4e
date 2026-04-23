import { Globe2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, useLanguage } from "@/contexts/LanguageContext";
import type { LangCode } from "@/i18n/translations";

interface Props {
  variant?: "default" | "compact";
}

export const LanguageSwitcher = ({ variant = "default" }: Props) => {
  const { lang, setLang } = useLanguage();
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-foreground/80 hover:text-foreground hover:bg-foreground/5 gap-2"
          aria-label="Change language"
        >
          <Globe2 className="w-4 h-4" />
          <span className="text-base leading-none">{current.flag}</span>
          {variant === "default" && (
            <span className="hidden sm:inline text-sm font-medium">{current.code.toUpperCase()}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-popover/95 backdrop-blur-xl border-foreground/10 rounded-2xl p-2 min-w-[180px]"
      >
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as LangCode)}
            className="rounded-xl gap-3 cursor-pointer focus:bg-accent/15"
          >
            <span className="text-lg">{l.flag}</span>
            <span className="flex-1 font-medium">{l.label}</span>
            {l.code === lang && <Check className="w-4 h-4 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
