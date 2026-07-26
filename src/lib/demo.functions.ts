import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Toggle demo mode: seed or clear sample transactions + deadlines for the user.
export const toggleDemoMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enable: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    if (!data.enable) {
      await supabase.from("transactions").delete().eq("user_id", userId).eq("is_demo", true);
      await supabase.from("compliance_deadlines").delete().eq("user_id", userId).eq("is_demo", true);
      await supabase.from("profiles").update({ demo_mode: false, financial_health_score: null }).eq("user_id", userId);
      return { ok: true, enabled: false };
    }

    // clear previous demo rows
    await supabase.from("transactions").delete().eq("user_id", userId).eq("is_demo", true);
    await supabase.from("compliance_deadlines").delete().eq("user_id", userId).eq("is_demo", true);

    const today = new Date();
    const day = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return d.toISOString().slice(0, 10);
    };

    const txns = [
      { kind: "income", amount: 145000, category: "Sales", description: "Retail sales — week 4", txn_date: day(-2) },
      { kind: "income", amount: 62000, category: "Sales", description: "Wholesale order — Kirti Traders", txn_date: day(-5) },
      { kind: "expense", amount: 28000, category: "Rent", description: "Shop rent", txn_date: day(-6) },
      { kind: "expense", amount: 12500, category: "Utilities", description: "Electricity bill", txn_date: day(-9) },
      { kind: "expense", amount: 34000, category: "Inventory", description: "Restock — cotton fabric", txn_date: day(-12) },
      { kind: "income", amount: 88000, category: "Sales", description: "Retail sales — week 3", txn_date: day(-14) },
      { kind: "expense", amount: 8500, category: "Salary", description: "Assistant wages", txn_date: day(-16) },
      { kind: "expense", amount: 5400, category: "Transport", description: "Delivery fuel", txn_date: day(-20) },
      { kind: "income", amount: 96000, category: "Sales", description: "Retail sales — week 2", txn_date: day(-22) },
      { kind: "expense", amount: 15000, category: "GST paid", description: "GSTR-3B payment", txn_date: day(-25) },
    ].map((t) => ({ ...t, user_id: userId, is_demo: true }));

    const deadlines = [
      { kind: "GST", title: "GSTR-3B filing", description: "Monthly GST return", due_date: day(7), status: "upcoming" },
      { kind: "TDS", title: "TDS payment (194J)", description: "Quarterly TDS on professional fees", due_date: day(14), status: "upcoming" },
      { kind: "GST", title: "GSTR-1 filing", description: "Outward supplies", due_date: day(21), status: "upcoming" },
      { kind: "ROC", title: "MGT-7 Annual Return", description: "Annual return to Registrar of Companies", due_date: day(45), status: "upcoming" },
      { kind: "GST", title: "GSTR-3B (prev month)", description: "Missed filing", due_date: day(-3), status: "overdue" },
    ].map((d) => ({ ...d, user_id: userId, is_demo: true }));

    await supabase.from("transactions").insert(txns);
    await supabase.from("compliance_deadlines").insert(deadlines);
    await supabase.from("profiles").update({ demo_mode: true, financial_health_score: 78 }).eq("user_id", userId);

    return { ok: true, enabled: true };
  });
