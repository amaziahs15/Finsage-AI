import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, AlertTriangle, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({ meta: [{ title: "Budgets — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: BudgetPage,
});

type Budget = { id: string; category: string; monthly_limit: number };
type Txn = { amount: number; category: string | null; kind: "income" | "expense"; txn_date: string };

function inr(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

function BudgetPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Budget[]>([]);
  const [spendByCat, setSpendByCat] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "", monthly_limit: "" });

  const load = useCallback(async () => {
    const { data: b } = await supabase.from("budgets").select("id, category, monthly_limit").order("category");
    setItems((b as Budget[]) ?? []);

    // Sum this month's expenses per category
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const { data: tx } = await supabase.from("transactions").select("amount, category, kind, txn_date").gte("txn_date", from);
    const acc: Record<string, number> = {};
    for (const x of (tx as Txn[]) ?? []) {
      if (x.kind !== "expense" || !x.category) continue;
      acc[x.category] = (acc[x.category] ?? 0) + Number(x.amount);
    }
    setSpendByCat(acc);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const limit = parseFloat(form.monthly_limit);
    const cat = form.category.trim();
    if (!cat || !limit || limit <= 0) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("budgets").upsert(
      { user_id: u.user.id, category: cat, monthly_limit: limit },
      { onConflict: "user_id,category" },
    );
    setOpen(false);
    setForm({ category: "", monthly_limit: "" });
    load();
  }

  async function remove(id: string) {
    await supabase.from("budgets").delete().eq("id", id);
    load();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("budget_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("budget_sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal/90">
          <Plus className="h-4 w-4" /> {t("budget_add")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("budget_empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b) => {
            const spent = spendByCat[b.category] ?? 0;
            const pct = Math.min(200, Math.round((spent / Number(b.monthly_limit)) * 100));
            const over = spent > Number(b.monthly_limit);
            const warn = pct >= 80;
            const barColor = over ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-teal";
            return (
              <div key={b.id} className="rounded-2xl bg-card border border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-navy">{b.category}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t("budget_spent")}</div>
                  </div>
                  <button onClick={() => remove(b.id)} className="text-muted-foreground hover:text-red-500" aria-label={t("budget_delete")}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${over ? "text-red-500" : "text-navy"}`}>{inr(spent)}</span>
                  <span className="text-sm text-muted-foreground">{t("budget_of")} {inr(Number(b.monthly_limit))}</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{pct}%</span>
                  <span className={over ? "text-red-500 font-medium" : "text-muted-foreground"}>
                    {over ? `${inr(spent - Number(b.monthly_limit))} ${t("budget_over")}` : `${inr(Number(b.monthly_limit) - spent)} ${t("budget_remaining")}`}
                  </span>
                </div>
                {warn && (
                  <div className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${over ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200"}`}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{over ? t("budget_warning_100") : t("budget_warning_80")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy">{t("budget_add")}</h3>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder={t("budget_category")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input type="number" step="0.01" placeholder={t("budget_limit")} value={form.monthly_limit} onChange={(e) => setForm({ ...form, monthly_limit: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button onClick={save} className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-semibold hover:bg-navy/90">{t("budget_save")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
