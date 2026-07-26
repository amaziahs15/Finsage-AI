import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { MarketingNav, MarketingFooter, LanguageSwitcher } from "@/components/marketing-chrome";
import type { TranslationKey } from "@/lib/translations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FinSage AI — Verified finance & compliance copilot for Indian MSMEs" },
      { name: "description", content: "Evidence-backed answers to GST, TDS and ROC questions for Indian small businesses. Every answer comes with an Honesty Score." },
      { property: "og:title", content: "FinSage AI — Verified finance & compliance copilot for Indian MSMEs" },
      { property: "og:description", content: "Evidence-backed answers to GST, TDS and ROC questions for Indian small businesses. Every answer comes with an Honesty Score." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />
      <Hero />
      <TrustBar />
      <Features />
      <HonestyExplainer />
      <Testimonials />
      <FAQ />
      <CTA />
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-navy-gradient text-navy-foreground">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-teal/40 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-teal/20 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
            {t("hero_eyebrow")}
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]">
            {t("hero_title")}
          </h1>
          <p className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">
            {t("hero_sub")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-teal text-teal-foreground px-6 py-3 font-semibold shadow-lg shadow-teal/20 hover:shadow-xl hover:shadow-teal/30 transition-all hover:-translate-y-0.5">
              {t("hero_cta")}
            </Link>
            <a href="#features" className="rounded-full bg-white/10 px-6 py-3 font-semibold ring-1 ring-white/20 hover:bg-white/20 transition-colors">
              {t("hero_cta_secondary")}
            </a>
          </div>
        </div>
        <div className="relative">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const { t } = useI18n();
  return (
    <div className="glass-dark rounded-2xl p-5 md:p-6">
      <div className="flex items-center justify-between text-xs text-white/60 mb-4">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        </div>
        <span>finsage.ai / dashboard</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Income", value: "₹4.2L" },
          { label: "Expenses", value: "₹2.8L" },
          { label: "Savings", value: "33%" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-white/5 ring-1 ring-white/10 p-3">
            <div className="text-[10px] uppercase tracking-wide text-white/50">{s.label}</div>
            <div className="mt-1 text-lg font-semibold">{s.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t("honesty_score_label")}</span>
          <span className="text-2xl font-bold text-teal">94<span className="text-sm text-white/50">/100</span></span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-teal to-emerald-300" style={{ width: "94%" }} />
        </div>
        <p className="mt-3 text-xs text-white/60 leading-relaxed">
          Answer backed by <span className="text-teal">3 official sources</span> from gst.gov.in and cbic.gov.in.
        </p>
      </div>
    </div>
  );
}

function TrustBar() {
  const { t } = useI18n();
  const items: TranslationKey[] = ["trust_evidence", "trust_deadlines", "trust_security"];
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {items.map((k) => (
          <div key={k} className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-teal/10 text-teal">✓</div>
            <span className="text-sm font-medium text-navy">{t(k)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  const items: { title: TranslationKey; desc: TranslationKey; icon: string }[] = [
    { title: "feat_qa_title", desc: "feat_qa_desc", icon: "💬" },
    { title: "feat_compliance_title", desc: "feat_compliance_desc", icon: "📅" },
    { title: "feat_txn_title", desc: "feat_txn_desc", icon: "💳" },
    { title: "feat_doc_title", desc: "feat_doc_desc", icon: "📸" },
    { title: "feat_schemes_title", desc: "feat_schemes_desc", icon: "🏛️" },
    { title: "feat_lang_title", desc: "feat_lang_desc", icon: "🌐" },
  ];
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-navy">{t("features_title")}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("features_sub")}</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div key={f.title} className="rounded-2xl bg-card p-6 ring-1 ring-border hover:ring-teal/40 hover:-translate-y-1 transition-all">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 font-semibold text-navy text-lg">{t(f.title)}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(f.desc)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HonestyExplainer() {
  const { t } = useI18n();
  const rows: { key: TranslationKey; value: number; max: number }[] = [
    { key: "honesty_source_authority", value: 24, max: 25 },
    { key: "honesty_relevance", value: 19, max: 20 },
    { key: "honesty_evidence", value: 18, max: 20 },
    { key: "honesty_recency", value: 14, max: 15 },
    { key: "honesty_agreement", value: 10, max: 10 },
    { key: "honesty_grounded", value: 9, max: 10 },
  ];
  return (
    <section id="how" className="bg-navy-gradient text-navy-foreground py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-2 gap-14 items-center">
        <div>
          <span className="text-teal font-semibold uppercase text-xs tracking-widest">{t("honesty_eyebrow")}</span>
          <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">{t("honesty_title")}</h2>
          <p className="mt-5 text-lg text-white/80 leading-relaxed">{t("honesty_sub")}</p>
        </div>
        <div className="glass-dark rounded-2xl p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-white/70">{t("honesty_score_label")}</span>
            <span className="text-5xl font-bold text-teal">94<span className="text-xl text-white/40">/100</span></span>
          </div>
          <div className="mt-5 space-y-3">
            {rows.map((r) => (
              <div key={r.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/70">{t(r.key)}</span>
                  <span className="text-white/50">{r.value}/{r.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-teal" style={{ width: `${(r.value / r.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 text-xs text-white/70">
            <span className="inline-block rounded-full bg-teal/20 text-teal px-2 py-0.5 font-medium">{t("honesty_legal_weight")}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const { t } = useI18n();
  const items = [
    { q: "t1_quote", n: "t1_name", r: "t1_role" },
    { q: "t2_quote", n: "t2_name", r: "t2_role" },
    { q: "t3_quote", n: "t3_name", r: "t3_role" },
  ] as const;
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-navy max-w-2xl">{t("testimonials_title")}</h2>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-2xl bg-card p-6 ring-1 ring-border">
              <span className="inline-block rounded-full bg-teal/10 text-teal text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">{t("testimonial_label")}</span>
              <p className="mt-4 text-navy leading-relaxed">"{t(it.q)}"</p>
              <div className="mt-5 pt-4 border-t border-border">
                <div className="font-semibold text-navy">{t(it.n)}</div>
                <div className="text-sm text-muted-foreground">{t(it.r)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useI18n();
  const items: { q: TranslationKey; a: TranslationKey }[] = [
    { q: "faq_q1", a: "faq_a1" },
    { q: "faq_q2", a: "faq_a2" },
    { q: "faq_q3", a: "faq_a3" },
    { q: "faq_q4", a: "faq_a4" },
    { q: "faq_q5", a: "faq_a5" },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-muted/40 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-navy text-center">{t("faq_title")}</h2>
        <div className="mt-12 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl bg-card ring-1 ring-border overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                <span className="font-semibold text-navy">{t(it.q)}</span>
                <span className={`text-teal text-xl transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-muted-foreground leading-relaxed">{t(it.a)}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const { t } = useI18n();
  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-navy">{t("hero_title")}</h2>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t("hero_sub")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-full bg-navy text-navy-foreground px-6 py-3 font-semibold shadow-lg hover:bg-navy/90 transition-colors">
            {t("hero_cta")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
    </section>
  );
}
