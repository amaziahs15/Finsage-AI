import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, TrendingUp, TrendingDown, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: TxnPage,
});

type Txn = { id: string; kind: "income" | "expense"; amount: number; category: string | null; description: string | null; txn_date: string };

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function TxnPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Txn[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "income" as "income" | "expense", amount: "", category: "", description: "", txn_date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    const { data } = await supabase.from("transactions").select("*").order("txn_date", { ascending: false });
    setItems((data as Txn[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    const { data: u } = await supabase.auth.getUser();
    const amt = parseFloat(form.amount);
    if (!u.user || !amt || amt <= 0) return;
    await supabase.from("transactions").insert({
      user_id: u.user.id,
      kind: form.kind,
      amount: amt,
      category: form.category || null,
      description: form.description || null,
      txn_date: form.txn_date,
    });
    setOpen(false);
    setForm({ kind: "income", amount: "", category: "", description: "", txn_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function remove(id: string) {
    await supabase.from("transactions").delete().eq("id", id);
    load();
  }

  const income = items.filter((x) => x.kind === "income").reduce((s, x) => s + Number(x.amount), 0);
  const expense = items.filter((x) => x.kind === "expense").reduce((s, x) => s + Number(x.amount), 0);

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("txn_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("txn_sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal/90">
          <Plus className="h-4 w-4" /> {t("txn_add")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("txn_income")}</span><TrendingUp className="h-4 w-4 text-teal" /></div>
          <div className="mt-2 text-2xl font-bold text-teal">{inr(income)}</div>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{t("txn_expense")}</span><TrendingDown className="h-4 w-4 text-red-500" /></div>
          <div className="mt-2 text-2xl font-bold text-red-500">{inr(expense)}</div>
        </div>
        <div className="rounded-2xl bg-navy text-white p-5">
          <div className="text-sm text-white/70">{t("txn_net")}</div>
          <div className="mt-2 text-2xl font-bold">{inr(income - expense)}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border">
        {items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t("txn_empty")}</div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((x) => (
              <div key={x.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${x.kind === "income" ? "bg-teal/15 text-teal" : "bg-red-100 text-red-500"}`}>
                    {x.kind === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{x.description || x.category || x.kind}</div>
                    <div className="text-xs text-muted-foreground">{x.category ? `${x.category} · ` : ""}{new Date(x.txn_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`font-semibold text-sm ${x.kind === "income" ? "text-teal" : "text-red-500"}`}>{x.kind === "income" ? "+" : "−"}{inr(Number(x.amount))}</div>
                  <button onClick={() => remove(x.id)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy">{t("txn_add")}</h3>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setForm({ ...form, kind: "income" })} className={`rounded-lg py-2 text-sm font-medium ${form.kind === "income" ? "bg-teal text-white" : "bg-muted"}`}>{t("txn_income")}</button>
                <button onClick={() => setForm({ ...form, kind: "expense" })} className={`rounded-lg py-2 text-sm font-medium ${form.kind === "expense" ? "bg-red-500 text-white" : "bg-muted"}`}>{t("txn_expense")}</button>
              </div>
              <input type="number" step="0.01" placeholder={t("txn_amount")} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder={t("txn_category")} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input placeholder={t("txn_description")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button onClick={save} className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-semibold hover:bg-navy/90">{t("txn_save")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
