import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { useI18n } from "@/lib/i18n";

type Txn = { kind: string; amount: number | string; txn_date: string };

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date, lang: string) {
  const locale = lang === "hi" ? "hi-IN" : lang === "ta" ? "ta-IN" : "en-IN";
  return d.toLocaleDateString(locale, { month: "short" });
}

export function SpentVsSavedChart({ txns }: { txns: Txn[] }) {
  const { t, lang } = useI18n();

  const data = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; spent: number; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: monthKey(d), label: monthLabel(d, lang), spent: 0, income: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    for (const x of txns) {
      const d = new Date(x.txn_date);
      const i = idx.get(monthKey(d));
      if (i === undefined) continue;
      const amt = Number(x.amount) || 0;
      if (x.kind === "expense") buckets[i].spent += amt;
      else if (x.kind === "income") buckets[i].income += amt;
    }
    return buckets.map((b) => ({ label: b.label, spent: b.spent, saved: Math.max(0, b.income - b.spent) }));
  }, [txns, lang]);

  const hasData = data.some((d) => d.spent > 0 || d.saved > 0);

  return (
    <div className="rounded-2xl bg-card border border-border p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-navy">{t("chart_title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("chart_sub")}</p>
        </div>
      </div>
      {!hasData ? (
        <p className="text-sm text-muted-foreground py-16 text-center">{t("chart_empty")}</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => "₹" + Math.round(v / 1000) + "k"} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => "₹" + Math.round(v / 1000) + "k"} />
              <Tooltip
                formatter={(value: number) => "₹" + Number(value).toLocaleString("en-IN")}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="spent" name={t("chart_spent")} fill="#0B1D3A" radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="saved" name={t("chart_saved")} stroke="#14B8A6" strokeWidth={3} dot={{ r: 4, fill: "#14B8A6" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
