import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toggleDemoMode } from "@/lib/demo.functions";
import type { Lang } from "@/lib/translations";
import { LogOut, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

type Profile = {
  full_name: string | null;
  business_name: string | null;
  gstin: string | null;
  employee_count: string | null;
  business_type: string | null;
  preferred_language: string;
  demo_mode: boolean;
  notify_deadlines: boolean;
  notify_weekly_summary: boolean;
  theme: string;
};

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
];

function SettingsPage() {
  const { t, setLang, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const toggle = useServerFn(toggleDemoMode);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadNonce, setLoadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (cancelled) return;
      if (uErr || !u.user) { setLoadError(uErr?.message || "Not signed in."); return; }
      const cols = "full_name, business_name, gstin, employee_count, business_type, preferred_language, demo_mode, notify_deadlines, notify_weekly_summary, theme";
      const { data, error } = await supabase.from("profiles").select(cols).eq("user_id", u.user.id).maybeSingle();
      if (cancelled) return;
      if (error) { setLoadError(error.message); return; }
      if (data) { setProfile(data as Profile); return; }
      // Safety net: no profile row (signup trigger missing/failed). Create one now.
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert({ user_id: u.user.id, preferred_language: lang })
        .select(cols)
        .single();
      if (cancelled) return;
      if (insErr || !created) { setLoadError(insErr?.message || "Could not initialize profile."); return; }
      setProfile(created as Profile);
    })();
    return () => { cancelled = true; };
  }, [loadNonce, lang]);

  // Theme is applied app-wide by ThemeProvider (src/lib/theme.tsx).

  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile((p) => (p ? { ...p, [k]: v } : p));
  }

  async function onSave() {
    if (!profile) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSaving(false); return; }
    await supabase.from("profiles").update({
      full_name: profile.full_name,
      business_name: profile.business_name,
      gstin: profile.gstin,
      employee_count: profile.employee_count,
      business_type: profile.business_type,
      preferred_language: profile.preferred_language,
      notify_deadlines: profile.notify_deadlines,
      notify_weekly_summary: profile.notify_weekly_summary,
      theme: profile.theme,
    }).eq("user_id", u.user.id);
    setSaving(false);
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2000);
  }

  async function onToggleDemo() {
    if (!profile) return;
    setDemoBusy(true);
    try {
      await toggle({ data: { enable: !profile.demo_mode } });
      update("demo_mode", !profile.demo_mode);
    } finally { setDemoBusy(false); }
  }

  async function onLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl px-4 md:px-8 py-8">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-navy">{t("settings_title")}</h1>
          <p className="mt-2 text-sm text-red-600">{loadError}</p>
          <button
            onClick={() => setLoadNonce((n) => n + 1)}
            className="mt-4 rounded-full bg-teal hover:bg-teal/90 text-white font-semibold px-5 py-2 text-sm"
          >
            {t("settings_retry")}
          </button>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto max-w-4xl px-4 md:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-32 rounded-2xl bg-muted" />
          <div className="h-64 rounded-2xl bg-muted" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 md:px-8 py-8 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground">{t("breadcrumb_home")} / {t("app_settings")}</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-navy">{t("settings_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings_sub")}</p>
      </div>

      {/* Language */}
      <Section title={t("settings_language")} sub={t("settings_language_sub")}>
        <div className="flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code); update("preferred_language", l.code); }}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                lang === l.code ? "bg-teal text-white border-teal" : "bg-card text-navy border-border hover:border-teal"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Profile */}
      <Section title={t("settings_profile")} sub={t("settings_profile_sub")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t("auth_full_name")} value={profile.full_name ?? ""} onChange={(v) => update("full_name", v)} />
          <Field label={t("auth_business_name")} value={profile.business_name ?? ""} onChange={(v) => update("business_name", v)} />
          <Field label={t("auth_gstin")} value={profile.gstin ?? ""} onChange={(v) => update("gstin", v)} />
          <Select label={t("auth_employees")} value={profile.employee_count ?? ""} onChange={(v) => update("employee_count", v)}
            options={[["", "—"], ["1", t("emp_1")], ["2-10", t("emp_2_10")], ["11-50", t("emp_11_50")], ["50+", t("emp_50p")]]} />
          <Select label={t("auth_business_type")} value={profile.business_type ?? ""} onChange={(v) => update("business_type", v)}
            options={[["", "—"], ["retail", t("bt_retail")], ["service", t("bt_service")], ["manufacturing", t("bt_manufacturing")], ["trading", t("bt_trading")], ["freelance", t("bt_freelance")], ["other", t("bt_other")]]} />
        </div>
      </Section>

      {/* Notifications */}
      <Section title={t("settings_notifications")}>
        <Toggle label={t("settings_notif_deadlines")} value={profile.notify_deadlines} onChange={(v) => update("notify_deadlines", v)} />
        <Toggle label={t("settings_notif_weekly")} value={profile.notify_weekly_summary} onChange={(v) => update("notify_weekly_summary", v)} />
      </Section>

      {/* Demo */}
      <Section title={t("settings_demo")} sub={t("settings_demo_sub")}>
        <button
          onClick={onToggleDemo}
          disabled={demoBusy}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            profile.demo_mode ? "bg-navy text-white hover:bg-navy/90" : "bg-teal text-white hover:bg-teal/90"
          } disabled:opacity-60`}
        >
          {profile.demo_mode ? t("dash_deactivate_demo") : t("dash_activate_demo")}
        </button>
      </Section>

      {/* Theme */}
      <Section title={t("settings_theme")}>
        <div className="flex gap-2">
          {(["light", "dark"] as const).map((th) => (
            <button
              key={th}
              onClick={() => { setTheme(th); update("theme", th); }}
              className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                theme === th ? "bg-teal text-white border-teal" : "bg-card text-navy border-border hover:border-teal"
              }`}
            >
              {th === "light" ? t("settings_theme_light") : t("settings_theme_dark")}
            </button>
          ))}
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button onClick={onSave} disabled={saving}
          className="rounded-full bg-teal hover:bg-teal/90 text-white font-semibold px-6 py-2.5 text-sm disabled:opacity-60 transition-colors">
          {saving ? t("loading") : t("settings_save")}
        </button>
        {savedAt && <span className="inline-flex items-center gap-1 text-sm text-teal"><Check className="h-4 w-4" /> {t("settings_saved")}</span>}
        <button onClick={onLogout} className="ml-auto inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-navy hover:bg-muted transition-colors">
          <LogOut className="h-4 w-4" /> {t("settings_logout")}
        </button>
      </div>
    </main>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card border border-border p-6">
      <h2 className="font-semibold text-navy">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-1 mb-4">{sub}</p>}
      <div className={sub ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40" />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-navy">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-teal" : "bg-muted"}`}
        aria-pressed={value}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </label>
  );
}
