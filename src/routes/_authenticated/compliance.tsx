import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState, useCallback } from "react";
import { AlertCircle, CheckCircle2, Calendar, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({ meta: [{ title: "Compliance Calendar — FinSage AI" }, { name: "robots", content: "noindex" }] }),
  component: CompliancePage,
});

type Deadline = { id: string; kind: string; title: string; description: string | null; due_date: string; status: string };

function CompliancePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Deadline[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ kind: "GST", title: "", description: "", due_date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    const { data } = await supabase.from("compliance_deadlines").select("*").order("due_date", { ascending: true });
    // Auto-mark overdue
    const now = new Date().toISOString().slice(0, 10);
    const updated = (data as Deadline[] ?? []).map((d) => d.status === "upcoming" && d.due_date < now ? { ...d, status: "overdue" } : d);
    setItems(updated);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markDone(id: string) {
    await supabase.from("compliance_deadlines").update({ status: "completed" }).eq("id", id);
    load();
  }

  async function save() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user || !form.title.trim()) return;
    await supabase.from("compliance_deadlines").insert({ ...form, user_id: u.user.id, status: "upcoming" });
    setOpen(false);
    setForm({ kind: "GST", title: "", description: "", due_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  const groups = {
    overdue: items.filter((i) => i.status === "overdue"),
    upcoming: items.filter((i) => i.status === "upcoming"),
    completed: items.filter((i) => i.status === "completed"),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("comp_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("comp_sub")}</p>
        </div>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-teal text-white px-4 py-2.5 text-sm font-semibold hover:bg-teal/90">
          <Plus className="h-4 w-4" /> {t("comp_add")}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl bg-card border border-border p-12 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("comp_empty")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.overdue.length > 0 && <Section title={t("comp_overdue")} color="text-red-500" items={groups.overdue} onDone={markDone} />}
          {groups.upcoming.length > 0 && <Section title={t("comp_upcoming")} color="text-navy" items={groups.upcoming} onDone={markDone} />}
          {groups.completed.length > 0 && <Section title={t("comp_completed")} color="text-teal" items={groups.completed} />}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy">{t("comp_add")}</h3>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                <option>GST</option><option>TDS</option><option>ROC</option><option>Income Tax</option><option>Other</option>
              </select>
              <input placeholder={t("comp_field_title")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <textarea placeholder={t("comp_field_desc")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <button onClick={save} className="w-full rounded-lg bg-navy text-white py-2.5 text-sm font-semibold hover:bg-navy/90">{t("txn_save")}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, color, items, onDone }: { title: string; color: string; items: Deadline[]; onDone?: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className={`font-semibold mb-3 ${color}`}>{title} <span className="text-muted-foreground">({items.length})</span></h2>
      <div className="rounded-2xl bg-card border border-border divide-y divide-border">
        {items.map((d) => (
          <div key={d.id} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {d.status === "overdue" ? <AlertCircle className="h-5 w-5 text-red-500 shrink-0" /> :
                d.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-teal shrink-0" /> :
                <Calendar className="h-5 w-5 text-navy shrink-0" />}
              <div className="min-w-0">
                <div className="font-medium text-sm">{d.title}</div>
                <div className="text-xs text-muted-foreground">{d.kind} · Due {new Date(d.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}{d.description ? ` · ${d.description}` : ""}</div>
              </div>
            </div>
            {onDone && d.status !== "completed" && (
              <button onClick={() => onDone(d.id)} className="text-xs font-medium text-teal hover:underline shrink-0">{t("comp_mark_done")}</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
