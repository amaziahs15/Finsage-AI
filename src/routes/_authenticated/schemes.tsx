import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink, Landmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/schemes")({
  head: () => ({ meta: [{ title: "Government Schemes — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: SchemesPage,
});

type Scheme = {
  id: string;
  slug: string;
  category: string;
  official_url: string | null;
  deadline: string | null;
  name_en: string; name_hi: string; name_ta: string;
  description_en: string; description_hi: string; description_ta: string;
  eligibility_en: string[]; eligibility_hi: string[]; eligibility_ta: string[];
  benefits_en: string[]; benefits_hi: string[]; benefits_ta: string[];
};

// Official Indian government portals. Rendered as a persistent quick-links
// section so users can jump to the source of truth from anywhere on Schemes.
const OFFICIAL_RESOURCES: { label: string; url: string }[] = [
  { label: "GST Portal", url: "https://www.gst.gov.in" },
  { label: "Income Tax e-Filing", url: "https://www.incometax.gov.in" },
  { label: "Ministry of Corporate Affairs (ROC)", url: "https://www.mca.gov.in" },
  { label: "Reserve Bank of India (RBI)", url: "https://www.rbi.org.in" },
  { label: "SEBI", url: "https://www.sebi.gov.in" },
  { label: "Udyam Registration (MSME)", url: "https://udyamregistration.gov.in" },
  { label: "Ministry of MSME", url: "https://msme.gov.in" },
  { label: "Startup India", url: "https://www.startupindia.gov.in" },
  { label: "EPFO", url: "https://www.epfindia.gov.in" },
  { label: "DPIIT", url: "https://dpiit.gov.in" },
];

function SchemesPage() {
  const { t, lang } = useI18n();
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("government_schemes").select("*").order("sort_order", { ascending: true });
      setSchemes((data as unknown as Scheme[]) ?? []);
    })();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (schemes ?? []).forEach((s) => set.add(s.category));
    return Array.from(set).sort();
  }, [schemes]);

  const filtered = useMemo(() => {
    if (!schemes) return [];
    const term = q.trim().toLowerCase();
    return schemes.filter((s) => {
      if (cat && s.category !== cat) return false;
      if (!term) return true;
      const hay = `${pick(s, "name", lang)} ${pick(s, "description", lang)} ${s.category}`.toLowerCase();
      return hay.includes(term);
    });
  }, [schemes, q, cat, lang]);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-8">
      <div>
        <p className="text-xs text-muted-foreground">{t("breadcrumb_home")} / {t("app_schemes")}</p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold text-navy">{t("schemes_title")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("schemes_sub")}</p>
      </div>

      {/* Official government resources — quick links */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold text-navy">Official Government Resources</h2>
        <p className="text-xs text-muted-foreground mt-1">Jump to the official portals for filings, verification, and registration.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {OFFICIAL_RESOURCES.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-navy hover:border-teal hover:text-teal transition-colors"
            >
              {r.label} <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </section>

      {/* Search + filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("schemes_search")}
            className="w-full rounded-full border border-border bg-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="rounded-full border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40"
        >
          <option value="">{t("schemes_all")}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Grid — each card shows full details (no truncation, no modal) */}
      {schemes === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">{t("schemes_empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal/10 text-teal shrink-0">
                  <Landmark className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium rounded-full bg-navy/10 text-navy px-2.5 py-1">{s.category}</span>
              </div>
              <h3 className="mt-3 font-semibold text-navy leading-snug text-lg">{pick(s, "name", lang)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{pick(s, "description", lang)}</p>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div>
                  <h4 className="font-semibold text-navy text-xs uppercase tracking-wide">{t("schemes_eligibility")}</h4>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {pickList(s, "eligibility", lang).map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-navy text-xs uppercase tracking-wide">{t("schemes_benefits")}</h4>
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {pickList(s, "benefits", lang).map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
              </div>

              {s.deadline && (
                <p className="mt-4 text-sm">
                  <span className="font-semibold text-navy">{t("schemes_deadline")}: </span>
                  <span className="text-muted-foreground">{s.deadline}</span>
                </p>
              )}

              {s.official_url && (
                <a
                  href={s.official_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-teal hover:bg-teal/90 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
                >
                  {t("schemes_visit")} <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

function pick(s: Scheme, field: "name" | "description", lang: string): string {
  const key = `${field}_${lang}` as keyof Scheme;
  return (s[key] as string) || (s[`${field}_en` as keyof Scheme] as string);
}
function pickList(s: Scheme, field: "eligibility" | "benefits", lang: string): string[] {
  const key = `${field}_${lang}` as keyof Scheme;
  const v = s[key] as unknown;
  if (Array.isArray(v) && v.length > 0) return v as string[];
  return (s[`${field}_en` as keyof Scheme] as unknown as string[]) ?? [];
}

