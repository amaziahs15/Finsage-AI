import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Financial Reports — FinSage AI" },
      { name: "description", content: "GST summary, ITC eligibility, and P&L auto-computed from your transactions and invoices." },
      { property: "og:title", content: "Financial Reports — FinSage AI" },
      { property: "og:description", content: "GST summary, ITC eligibility, and P&L auto-computed from your transactions and invoices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

type Txn = { kind: "income" | "expense"; amount: number; category: string | null; txn_date: string; gst_amount: number | null; itc_eligible: boolean };
type Inv = { total_amount: number; cgst_amount: number; sgst_amount: number; igst_amount: number; taxable_amount: number; created_at: string; status: string };

function fmt(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }

function ReportsPage() {
  const { t } = useI18n();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    (async () => {
      const [tRes, iRes] = await Promise.all([
        supabase.from("transactions").select("kind, amount, category, txn_date, gst_amount, itc_eligible").limit(1000),
        supabase.from("invoices").select("total_amount, cgst_amount, sgst_amount, igst_amount, taxable_amount, created_at, status").limit(500),
      ]);
      setTxns((tRes.data as unknown as Txn[]) ?? []);
      setInvs((iRes.data as unknown as Inv[]) ?? []);
    })();
  }, []);

  const report = useMemo(() => {
    const monthTxns = txns.filter((t) => t.txn_date.startsWith(month));
    const monthInvs = invs.filter((i) => i.created_at.startsWith(month));
    const income = monthTxns.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTxns.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const gstOutput = monthInvs.reduce((s, i) => s + Number(i.cgst_amount) + Number(i.sgst_amount) + Number(i.igst_amount), 0);
    const gstInputEligible = monthTxns
      .filter((t) => t.kind === "expense" && t.itc_eligible && t.gst_amount)
      .reduce((s, t) => s + Number(t.gst_amount || 0), 0);
    const gstPayable = Math.max(0, gstOutput - gstInputEligible);
    const taxableSales = monthInvs.reduce((s, i) => s + Number(i.taxable_amount), 0);
    return { income, expense, profit: income - expense, gstOutput, gstInputEligible, gstPayable, taxableSales, count: monthTxns.length };
  }, [txns, invs, month]);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("reports_title")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("reports_sub")}</p>
      </div>

      <label className="text-sm inline-flex items-center gap-2">
        <span className="text-muted-foreground">Month</span>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-input bg-background px-3 py-1.5" />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-navy font-semibold"><BarChart3 className="h-4 w-4" /> Profit & Loss</div>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Total income" value={fmt(report.income)} />
            <Row label="Total expenses" value={fmt(report.expense)} />
            <Row label="Net profit" value={fmt(report.profit)} strong />
            <Row label="Transactions" value={String(report.count)} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-navy font-semibold"><BarChart3 className="h-4 w-4" /> GST Summary</div>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Taxable sales (invoiced)" value={fmt(report.taxableSales)} />
            <Row label="GST output (collected)" value={fmt(report.gstOutput)} />
            <Row label="ITC eligible (input)" value={fmt(report.gstInputEligible)} />
            <Row label="GST payable" value={fmt(report.gstPayable)} strong />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Estimates only. Verify against your GSTR-3B on gst.gov.in. ITC counted where you marked expenses as ITC-eligible.
          </p>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-border/50 pb-1 ${strong ? "font-semibold text-navy" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
