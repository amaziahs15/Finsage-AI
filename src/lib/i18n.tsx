// Centralized i18n for FinSage AI. Instant client-side language switch across
// EN / HI / TA. Persists to localStorage and (when signed in) to profile.
// setLang is memoized so unrelated effects don't retrigger and clobber the
// user's manual selection with a stale profile fetch.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { translations, type Lang, type TranslationKey } from "./translations";
import { supabase } from "@/integrations/supabase/client";

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "finsage.lang";

function isLang(v: unknown): v is Lang {
  return v === "en" || v === "hi" || v === "ta";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  // If true, the user made a manual selection this session — never let a
  // background profile fetch overwrite it.
  const manuallySet = useRef(false);

  // One-shot hydrate: localStorage first, then profile — but only apply
  // profile value if the user hasn't manually chosen a language yet.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLang(saved)) setLangState(saved);
    } catch { /* noop */ }
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const pl = p?.preferred_language;
      if (isLang(pl) && !manuallySet.current) {
        setLangState(pl);
        try { localStorage.setItem(STORAGE_KEY, pl); } catch { /* noop */ }
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    manuallySet.current = true;
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* noop */ }
    // Fire-and-forget persist to profile if signed in.
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").update({ preferred_language: l }).eq("user_id", data.user.id);
      }
    });
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    lang,
    setLang,
    t: (k) => translations[lang]?.[k] ?? translations.en[k] ?? k,
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
