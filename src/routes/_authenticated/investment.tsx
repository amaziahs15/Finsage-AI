import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { TrendingUp, PiggyBank, Info } from "lucide-react";

export const Route = createFileRoute("/_authenticated/investment")({
  head: () => ({ meta: [{ title: "Investment Basics — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: InvestmentPage,
});

function inr(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

function InvestmentPage() {
  const { t } = useI18n();
  const [netSavings, setNetSavings] = useState(0);
  const [amount, setAmount] = useState("50000");
  const [years, setYears] = useState("5");
  const [rate, setRate] = useState("7");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("transactions").select("amount, kind");
      const rows = (data as { amount: number; kind: "income" | "expense" }[]) ?? [];
      const net = rows.reduce((s, r) => s + (r.kind === "income" ? Number(r.amount) : -Number(r.amount)), 0);
      setNetSavings(Math.max(0, net));
      if (net > 0) setAmount(String(Math.round(net)));
    })();
  }, []);

  const P = parseFloat(amount) || 0;
  const n = parseFloat(years) || 0;
  const r = (parseFloat(rate) || 0) / 100;
  const fv = P * Math.pow(1 + r, n);
  const gain = fv - P;

  const items: { key: "fd" | "liq" | "ppf" | "sgb" | "msme" }[] = [
    { key: "fd" }, { key: "liq" }, { key: "ppf" }, { key: "sgb" }, { key: "msme" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("inv_title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("inv_sub")}</p>
      </div>

      <div className="rounded-2xl bg-navy-gradient text-white p-6 flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10">
          <PiggyBank className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm text-white/70">{t("inv_savings_label")}</div>
          <div className="text-2xl font-bold">{inr(netSavings)}</div>
        </div>
      </div>

      <section className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-5 w-5 text-teal" />
          <h2 className="font-semibold text-navy">{t("inv_calc_title")}</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{t("inv_calc_sub")}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label={t("inv_amount")} value={amount} onChange={setAmount} type="number" />
          <Field label={t("inv_years")} value={years} onChange={setYears} type="number" />
          <Field label={t("inv_return")} value={rate} onChange={setRate} type="number" />
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Stat label={t("inv_future_value")} value={inr(fv)} accent />
          <Stat label="Gain" value={inr(gain)} />
        </div>
      </section>

      <section>
        <h2 className="font-semibold text-navy mb-3">{t("inv_edu_title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(({ key }) => (
            <div key={key} className="rounded-2xl bg-card border border-border p-5">
              <div className="font-semibold text-navy">{t(`inv_edu_${key}_t` as const)}</div>
              <p className="mt-1 text-sm text-muted-foreground">{t(`inv_edu_${key}_d` as const)}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t("inv_disclaimer")}</span>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/40" />
    </label>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${accent ? "bg-teal/10 border border-teal/30" : "bg-muted"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-teal" : "text-navy"}`}>{value}</div>
    </div>
  );
}
