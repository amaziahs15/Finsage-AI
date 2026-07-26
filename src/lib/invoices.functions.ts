import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateInvoiceInput = z.object({
  invoice_number: z.string().min(1).max(50),
  customer_name: z.string().min(1).max(200),
  customer_gstin: z.string().max(20).optional().nullable(),
  hsn_sac_code: z.string().max(20).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  taxable_amount: z.number().nonnegative(),
  cgst_amount: z.number().nonnegative().default(0),
  sgst_amount: z.number().nonnegative().default(0),
  igst_amount: z.number().nonnegative().default(0),
  due_date: z.string().optional().nullable(),
  payment_terms: z.string().max(100).optional().nullable(),
});

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInvoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const total =
      data.taxable_amount + data.cgst_amount + data.sgst_amount + data.igst_amount;
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("business_name, gstin")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: row, error } = await context.supabase
      .from("invoices")
      .insert({
        ...data,
        user_id: context.userId,
        total_amount: total,
        business_name: profile?.business_name ?? null,
        business_gstin: profile?.gstin ?? null,
        status: "sent",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), amount: z.number().nonnegative() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("invoices")
      .select("total_amount, amount_paid")
      .eq("id", data.id)
      .maybeSingle();
    if (!inv) throw new Error("Invoice not found");
    const newPaid = Number(inv.amount_paid) + data.amount;
    const status = newPaid >= Number(inv.total_amount) ? "paid" : "partially_paid";
    const { error } = await context.supabase
      .from("invoices")
      .update({ amount_paid: newPaid, status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

export const arSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("invoices")
      .select("total_amount, amount_paid, status, due_date, created_at");
    const today = new Date().toISOString().slice(0, 10);
    const rows = data ?? [];
    let outstanding = 0;
    let overdue = 0;
    let paid30 = 0;
    const cutoff = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
    let dsoSum = 0;
    let dsoCount = 0;
    for (const r of rows) {
      const rem = Number(r.total_amount) - Number(r.amount_paid);
      if (rem > 0) outstanding += rem;
      if (rem > 0 && r.due_date && r.due_date < today) overdue += rem;
      if (r.status === "paid" && (r.created_at as string).slice(0, 10) >= cutoff) {
        paid30 += Number(r.total_amount);
      }
      if (r.status === "paid" && r.due_date) {
        const created = new Date(r.created_at as string).getTime();
        const paidAt = Date.now();
        const days = Math.max(0, Math.round((paidAt - created) / 86400e3));
        dsoSum += days;
        dsoCount += 1;
      }
    }
    return {
      outstanding,
      overdue,
      paid30,
      dso: dsoCount > 0 ? Math.round(dsoSum / dsoCount) : 0,
      count: rows.length,
    };
  });
