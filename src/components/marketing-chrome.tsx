// Shared marketing chrome (navbar + footer) with language switcher. Rendered by
// public routes; reads session so the CTA reflects signed-in state.
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Lang } from "@/lib/translations";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
];

export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { lang, setLang } = useI18n();
  const base = variant === "dark"
    ? "bg-white/10 text-white ring-white/20"
    : "bg-white text-navy ring-navy/10";
  return (
    <div className={`inline-flex items-center gap-1 rounded-full p-1 ring-1 ${base}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            lang === l.code
              ? "bg-teal text-teal-foreground shadow-sm"
              : variant === "dark" ? "text-white/80 hover:text-white" : "text-navy/70 hover:text-navy"
          }`}
          aria-pressed={lang === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export function MarketingNav() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSignedIn(!!data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground font-bold">F</div>
          <span className="font-bold text-navy text-lg tracking-tight">FinSage <span className="text-teal">AI</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-navy transition-colors">{t("nav_features")}</a>
          <a href="#how" className="hover:text-navy transition-colors">{t("nav_how")}</a>
          <a href="#pricing" className="hover:text-navy transition-colors">{t("nav_pricing")}</a>
          <a href="#faq" className="hover:text-navy transition-colors">{t("nav_faq")}</a>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {signedIn ? (
            <Link to="/dashboard" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground hover:bg-navy/90 transition-colors">
              {t("dash_welcome")}
            </Link>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="hidden sm:inline text-sm font-medium text-navy hover:text-teal transition-colors">
                {t("nav_login")}
              </Link>
              <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-navy-foreground hover:bg-navy/90 transition-colors">
                {t("nav_get_started")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12 flex flex-col md:flex-row gap-8 justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-navy-foreground font-bold">F</div>
            <span className="font-bold text-navy text-lg">FinSage <span className="text-teal">AI</span></span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t("footer_tagline")}</p>
        </div>
        <div className="flex gap-8 text-sm">
          <a href="#" className="text-muted-foreground hover:text-navy">{t("footer_privacy")}</a>
          <a href="#" className="text-muted-foreground hover:text-navy">{t("footer_terms")}</a>
          <a href="#" className="text-muted-foreground hover:text-navy">{t("footer_contact")}</a>
        </div>
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-7xl px-6 py-4 text-xs text-muted-foreground">{t("footer_copy")}</p>
      </div>
    </footer>
  );
}
