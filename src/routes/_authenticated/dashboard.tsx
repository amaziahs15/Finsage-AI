import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState, useCallback } from "react";
import { toggleDemoMode } from "@/lib/demo.functions";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { SpentVsSavedChart } from "@/components/spent-vs-saved-chart";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

type Txn = { id: string; kind: string; amount: number; category: string | null; description: string | null; txn_date: string };
type Deadline = { id: string; kind: string; title: string; due_date: string; status: string };
type Profile = { full_name: string | null; business_name: string | null; demo_mode: boolean; financial_health_score: number | null };

function inr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toggle = useServerFn(toggleDemoMode);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { navigate({ to: "/auth", search: { mode: "signin" } }); return; }
    const [{ data: p }, { data: tx }, { data: dl }] = await Promise.all([
      supabase.from("profiles").select("full_name, business_name, demo_mode, financial_health_score").eq("user_id", u.user.id).maybeSingle(),
      supabase.from("transactions").select("id, kind, amount, category, description, txn_date").order("txn_date", { ascending: false }).limit(500),
      supabase.from("compliance_deadlines").select("id, kind, title, due_date, status").order("due_date", { ascending: true }).limit(10),
    ]);
    setProfile(p as Profile | null);
    setTxns((tx as Txn[]) ?? []);
    setDeadlines((dl as Deadline[]) ?? []);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  async function onToggleDemo() {
    setLoading(true);
    try {
      await toggle({ data: { enable: !profile?.demo_mode } });
      await load();
    } finally { setLoading(false); }
  }

  const income = txns.filter((x) => x.kind === "income").reduce((s, x) => s + Number(x.amount), 0);
  const expense = txns.filter((x) => x.kind === "expense").reduce((s, x) => s + Number(x.amount), 0);
  const net = income - expense;
  const health = profile?.financial_health_score ?? (txns.length ? Math.max(35, Math.min(95, Math.round(50 + (net / Math.max(income, 1)) * 50))) : null);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-8">
      <p className="text-xs text-muted-foreground">{t("breadcrumb_home")} / {t("app_dashboard")}</p>
      {/* Hero */}
      <div className="rounded-2xl bg-navy-gradient text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between">
        <div>
          <p className="text-white/70 text-sm">{t("dash_greeting")}</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold">
            {profile?.full_name || profile?.business_name || "FinSage"}
          </h1>
          <p className="mt-2 text-white/80 text-sm max-w-xl">{t("dash_demo_hint")}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.demo_mode && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/20 border border-teal/50 px-3 py-1 text-xs text-teal">
              <Sparkles className="h-3 w-3" /> {t("dash_demo_active")}
            </span>
          )}
          <button
            onClick={onToggleDemo}
            disabled={loading}
            className="rounded-full bg-teal hover:bg-teal/90 text-white font-semibold px-5 py-2.5 text-sm disabled:opacity-60 transition-colors"
          >
            {profile?.demo_mode ? t("dash_deactivate_demo") : t("dash_activate_demo")}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-teal" />} label={t("dash_income_30")} value={inr(income)} />
        <SummaryCard icon={<TrendingDown className="h-5 w-5 text-red-500" />} label={t("dash_expense_30")} value={inr(expense)} />
        <SummaryCard icon={<Wallet className="h-5 w-5 text-navy" />} label={t("dash_savings_30")} value={inr(net)} highlight={net >= 0} />
      </div>

      {/* Spent vs Saved chart */}
      <SpentVsSavedChart txns={txns} />



      {/* Health + Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-2xl glass p-6 border border-border">
          <h3 className="font-semibold text-navy">{t("dash_health")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("dash_health_sub")}</p>
          <div className="mt-6 relative flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-40 h-40 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--teal))" strokeWidth="10"
                strokeDasharray={`${((health ?? 0) / 100) * 326.7} 326.7`} strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-bold text-navy">{health ?? "—"}</div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy flex items-center gap-2"><Calendar className="h-4 w-4 text-teal" /> {t("dash_upcoming")}</h3>
            <Link to="/compliance" className="text-xs font-medium text-teal hover:underline">{t("dash_view_all")}</Link>
          </div>
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash_no_deadlines")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {deadlines.slice(0, 5).map((d) => (
                <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {d.status === "overdue" ? (
                      <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : d.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-teal shrink-0" />
                    ) : (
                      <Calendar className="h-5 w-5 text-navy shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.kind} · {new Date(d.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${
                    d.status === "overdue" ? "bg-red-100 text-red-700" : d.status === "completed" ? "bg-teal/15 text-teal" : "bg-navy/10 text-navy"
                  }`}>{d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-navy">{t("dash_recent_txn")}</h3>
          <Link to="/transactions" className="text-xs font-medium text-teal hover:underline">{t("dash_view_all")}</Link>
        </div>
        {txns.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dash_no_txn")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {txns.slice(0, 6).map((x) => (
              <li key={x.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{x.description || x.category || x.kind}</div>
                  <div className="text-xs text-muted-foreground">{x.category} · {new Date(x.txn_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                </div>
                <div className={`text-sm font-semibold ${x.kind === "income" ? "text-teal" : "text-red-500"}`}>
                  {x.kind === "income" ? "+" : "−"}{inr(Number(x.amount))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-2 text-2xl font-bold ${highlight === false ? "text-red-500" : "text-navy"}`}>{value}</div>
    </div>
  );
}
