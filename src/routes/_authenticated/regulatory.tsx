import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { listRegulatoryForMe } from "@/lib/regulatory.functions";
import { Scale, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/regulatory")({
  head: () => ({
    meta: [
      { title: "Regulatory Updates — FinSage AI" },
      { name: "description", content: "Evidence-backed analysis of new GST, TDS and ROC notifications, scored for MSME impact." },
      { property: "og:title", content: "Regulatory Updates — FinSage AI" },
      { property: "og:description", content: "Evidence-backed analysis of new GST, TDS and ROC notifications, scored for MSME impact." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegulatoryPage,
});

type Update = Awaited<ReturnType<typeof listRegulatoryForMe>>[number];

function RegulatoryPage() {
  const { t, lang } = useI18n();
  const list = useServerFn(listRegulatoryForMe);
  const q = useQuery({ queryKey: ["reg-updates"], queryFn: () => list() });
  const [selected, setSelected] = useState<Update | null>(null);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("regulatory_title")}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">{t("regulatory_sub")}</p>
      </div>

      {(q.data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Scale className="mx-auto h-8 w-8 opacity-40" />
          <p className="mt-3">{t("regulatory_empty")}</p>
          <p className="mt-2 text-xs">
            Admins can ingest notifications via the Analyze API. Every analysis includes an Honesty Score, MSME Impact Score and personalised relevance.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(q.data as Update[]).map((u) => (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="text-left rounded-2xl border border-border bg-card p-5 hover:border-teal transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded-full bg-muted text-xs px-2 py-0.5 mb-2">{u.category ?? "Regulation"}</span>
                  <h3 className="font-semibold text-navy">{u.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{u.summary}</p>
                </div>
                <ImpactBadge score={u.msme_impact_score} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {u.action_required ? (
                    <span className="inline-flex items-center gap-1 text-amber-700"><AlertCircle className="h-3 w-3" /> {t("regulatory_action_required")}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle2 className="h-3 w-3" /> {t("regulatory_no_action")}</span>
                  )}
                </span>
                <span className="font-medium text-teal">{t("regulatory_relevance")}: {u._relevance}/100</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && <DetailModal update={selected} lang={lang} onClose={() => setSelected(null)} t={t} />}
    </main>
  );
}

function ImpactBadge({ score }: { score: number }) {
  const level = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  const cls = score >= 70 ? "bg-red-100 text-red-800" : score >= 40 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800";
  return (
    <div className={`rounded-lg px-2 py-1 text-center ${cls}`}>
      <div className="text-lg font-bold leading-none">{score}</div>
      <div className="text-[10px] uppercase tracking-wide">{level}</div>
    </div>
  );
}

function DetailModal({ update, lang, onClose, t }: { update: Update; lang: "en" | "hi" | "ta"; onClose: () => void; t: (k: never) => string }) {
  const analysisKey = ("analysis_" + lang) as "analysis_en" | "analysis_hi" | "analysis_ta";
  const analysis = (update[analysisKey] ?? update.analysis_en) as null | { plain_english?: string; who_is_affected?: string; what_to_do?: string };
  const laws = Array.isArray(update.affected_laws) ? (update.affected_laws as unknown[]).map(String) : [];
  const steps = Array.isArray(update.action_steps) ? (update.action_steps as unknown[]).map(String) : [];
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-card border border-border shadow-lg p-6 space-y-4 my-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-full bg-muted text-xs px-2 py-0.5">{update.category}</span>
            <h2 className="mt-2 text-xl font-bold text-navy">{update.title}</h2>
            {update.source_url && (
              <a href={update.source_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-teal hover:underline">
                {update.source_name || update.source_url} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <StatBadge label={"MSME " + (t as (k: string) => string)("regulatory_impact") } value={update.msme_impact_score + "/100"} />
          <StatBadge label="Honesty" value={(update.honesty_score ?? 0) + "/100"} />
          <StatBadge label={(t as (k: string) => string)("regulatory_effective")} value={update.effective_date ?? "—"} />
          <StatBadge label={(t as (k: string) => string)("regulatory_deadline")} value={update.compliance_deadline ?? "—"} />
        </div>

        {analysis && (
          <div className="space-y-3 text-sm">
            <Section title="Plain-language summary">{analysis.plain_english}</Section>
            <Section title="Who is affected">{analysis.who_is_affected}</Section>
            <Section title="What to do">{analysis.what_to_do}</Section>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <Section title="Previous requirement">{update.previous_requirement || "—"}</Section>
          <Section title="New requirement">{update.new_requirement || "—"}</Section>
        </div>

        {laws.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Affected laws / rules</p>
            <div className="flex flex-wrap gap-1">
              {laws.map((l, i) => <span key={i} className="rounded-full bg-muted text-xs px-2 py-0.5">{l}</span>)}
            </div>
          </div>
        )}

        {steps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Action steps</p>
            <ol className="list-decimal pl-5 text-sm space-y-1">
              {steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{title}</p>
      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{children || "—"}</p>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-navy">{value}</div>
    </div>
  );
}
