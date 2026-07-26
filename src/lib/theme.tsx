// Global theme provider. Applies 'light' | 'dark' class to <html> app-wide,
// persists to localStorage, and (when signed in) syncs to profile.theme.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Theme = "light" | "dark";

type ThemeCtx = { theme: Theme; setTheme: (t: Theme) => void };
const Ctx = createContext<ThemeCtx | null>(null);
const KEY = "finsage.theme";

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const manuallySet = useRef(false);

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") initial = saved;
    } catch { /* noop */ }
    setThemeState(initial);
    apply(initial);
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("theme")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const pt = (p as { theme?: string } | null)?.theme;
      if ((pt === "dark" || pt === "light") && !manuallySet.current) {
        setThemeState(pt);
        apply(pt);
        try { localStorage.setItem(KEY, pt); } catch { /* noop */ }
      }
    })();
  }, []);

  const setTheme = useCallback((t: Theme) => {
    manuallySet.current = true;
    setThemeState(t);
    apply(t);
    try { localStorage.setItem(KEY, t); } catch { /* noop */ }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) supabase.from("profiles").update({ theme: t }).eq("user_id", data.user.id);
    });
  }, []);

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used inside ThemeProvider");
  return c;
}
