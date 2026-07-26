import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { createInvoice, listInvoices, markInvoicePaid, arSummary } from "@/lib/invoices.functions";
import { FileText, IndianRupee, Download } from "lucide-react";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { ErrorBoundary } from "@/components/error-boundary";

// Safe example data. IMPORTANT: never embed raw double quotes inside these
// double-quoted string literals — use single quotes or hyphens. A malformed
// literal here previously broke the entire Save button silently.
const EXAMPLE_INVOICE = {
  invoice_number: "INV-2026-001",
  customer_name: "Acme Traders Pvt Ltd",
  customer_gstin: "27AABCU9603R1ZX",
  hsn: "998314",
  description: "Web development services - homepage redesign and backend integration",
  taxable: "50000",
  gstRate: "18",
  terms: "Net 30",
};

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices & Receivables — FinSage AI" },
      { name: "description", content: "Create GST-compliant invoices and track receivables for your MSME." },
      { property: "og:title", content: "Invoices & Receivables — FinSage AI" },
      { property: "og:description", content: "Create GST-compliant invoices and track receivables for your MSME." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicesPage,
});

type Invoice = Awaited<ReturnType<typeof listInvoices>>[number];

function fmt(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

function InvoicesPage() {
  const { t } = useI18n();
  const router = useRouter();
  const list = useServerFn(listInvoices);
  const summary = useServerFn(arSummary);
  const create = useServerFn(createInvoice);
  const markPaid = useServerFn(markInvoicePaid);

  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => list() });
  const ar = useQuery({ queryKey: ["ar-summary"], queryFn: () => summary() });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setErrMsg(null);
    setOkMsg(null);
    try {
      const fd = new FormData(form);
      const taxable = Number(fd.get("taxable") || 0);
      const gstRate = Number(fd.get("gstRate") || 18);
      const gstAmount = Math.round((taxable * gstRate) / 100 * 100) / 100;
      const intra = fd.get("intra") === "on";
      const invoiceNumber = String(fd.get("invoice_number") || "").trim();
      const customerName = String(fd.get("customer_name") || "").trim();
      if (!invoiceNumber || !customerName || !(taxable > 0)) {
        throw new Error("Invoice #, customer name and taxable amount (> 0) are required.");
      }
      await create({
        data: {
          invoice_number: invoiceNumber,
          customer_name: customerName,
          customer_gstin: String(fd.get("customer_gstin") || "").trim() || null,
          hsn_sac_code: String(fd.get("hsn") || "").trim() || null,
          description: String(fd.get("description") || "").trim() || null,
          taxable_amount: taxable,
          cgst_amount: intra ? gstAmount / 2 : 0,
          sgst_amount: intra ? gstAmount / 2 : 0,
          igst_amount: intra ? 0 : gstAmount,
          due_date: String(fd.get("due_date") || "") || null,
          payment_terms: String(fd.get("terms") || "").trim() || null,
        },
      });
      setOkMsg(`Invoice ${invoiceNumber} saved.`);
      form.reset();
      setShowForm(false);
      await Promise.all([invoices.refetch(), ar.refetch()]);
      router.invalidate();
    } catch (err) {
      console.error("createInvoice failed", err);
      let msg: string;
      if (err instanceof Error && err.message) {
        msg = err.message;
      } else if (typeof err === "string" && err) {
        msg = err;
      } else {
        // Fallback: never leave the user without feedback.
        msg = "Failed to save invoice — please try again.";
      }
      setErrMsg(msg);
    } finally {
      setBusy(false);
    }
  }

  function fillExample() {
    const form = formRef.current;
    if (!form) return;
    for (const [key, value] of Object.entries(EXAMPLE_INVOICE)) {
      const el = form.elements.namedItem(key) as HTMLInputElement | null;
      if (el) el.value = value;
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-8 py-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-navy">{t("invoices_title")}</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">{t("invoices_sub")}</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-teal text-white px-4 py-2 text-sm font-medium hover:bg-teal/90"
        >
          + {t("invoices_new")}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label={t("invoices_outstanding")} value={fmt(ar.data?.outstanding ?? 0)} />
        <SummaryCard label={t("invoices_overdue")} value={fmt(ar.data?.overdue ?? 0)} highlight />
        <SummaryCard label={t("invoices_paid_30d")} value={fmt(ar.data?.paid30 ?? 0)} />
        <SummaryCard label={t("invoices_dso")} value={String(ar.data?.dso ?? 0) + "d"} />
      </div>

      {okMsg && !showForm && (
        <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">{okMsg}</div>
      )}

      {showForm && (
        <ErrorBoundary>
          <form ref={formRef} onSubmit={onCreate} className="rounded-2xl border border-border bg-card p-5 grid gap-3 md:grid-cols-2">
            {errMsg && (
              <div className="md:col-span-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errMsg}
              </div>
            )}
            <Field name="invoice_number" label="Invoice #" required />
            <Field name="customer_name" label="Customer name" required />
            <Field name="customer_gstin" label="Customer GSTIN (optional)" />
            <Field name="hsn" label="HSN/SAC code" />
            <Field name="description" label="Description" />
            <Field name="taxable" label="Taxable amount (₹)" type="number" required step="0.01" min="0.01" />
            <Field name="gstRate" label="GST rate %" type="number" defaultValue="18" step="0.01" />
            <Field name="due_date" label="Due date" type="date" />
            <Field name="terms" label="Payment terms" />
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input type="checkbox" name="intra" defaultChecked />
              Intra-state (CGST + SGST). Uncheck for inter-state (IGST).
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <button type="button" onClick={fillExample} className="rounded-lg border px-4 py-2 text-sm">
                Fill with example
              </button>
              <button type="button" onClick={() => { setShowForm(false); setErrMsg(null); }} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-teal text-white px-4 py-2 text-sm font-medium disabled:opacity-60">
                {busy ? "Saving…" : "Save invoice"}
              </button>
            </div>
          </form>
        </ErrorBoundary>
      )}

      <section className="rounded-2xl border border-border bg-card">
        {(invoices.data?.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 opacity-40" />
            <p className="mt-3">{t("invoices_empty")}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <Th>Invoice</Th><Th>Customer</Th><Th>Total</Th><Th>Paid</Th><Th>Due</Th><Th>Status</Th><Th> </Th>
              </tr>
            </thead>
            <tbody>
              {(invoices.data as Invoice[] | undefined)?.map((inv) => {
                const remaining = Number(inv.total_amount) - Number(inv.amount_paid);
                return (
                  <tr key={inv.id} className="border-b last:border-0">
                    <Td>{inv.invoice_number}</Td>
                    <Td>{inv.customer_name}</Td>
                    <Td>{fmt(Number(inv.total_amount))}</Td>
                    <Td>{fmt(Number(inv.amount_paid))}</Td>
                    <Td>{inv.due_date ?? "—"}</Td>
                    <Td>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        inv.status === "paid" ? "bg-green-100 text-green-800"
                        : inv.status === "overdue" ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                      }`}>{inv.status}</span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => downloadInvoicePdf(inv as unknown as Parameters<typeof downloadInvoicePdf>[0])}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          title="Download PDF"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                        {remaining > 0 && (
                          <button
                            onClick={async () => {
                              await markPaid({ data: { id: inv.id, amount: remaining } });
                              invoices.refetch();
                              ar.refetch();
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                          >
                            <IndianRupee className="h-3 w-3" /> Mark paid
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 bg-card ${highlight ? "border-red-300" : "border-border"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${highlight ? "text-red-700" : "text-navy"}`}>{value}</p>
    </div>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="text-sm">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <input name={name} {...rest} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-xs font-medium text-muted-foreground">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
