// Generates a Government-of-India style GST TAX INVOICE PDF using jsPDF.
// Mirrors the layout used on official CBIC / GSTN sample invoices: bold
// "TAX INVOICE" banner, seller/buyer boxes with GSTIN, HSN/SAC line-item
// table with CGST+SGST or IGST split, totals, amount-in-words, and a
// signature block. Client-side only — invoked from the invoices page.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type InvoicePdfData = {
  invoice_number: string;
  created_at: string;
  due_date?: string | null;
  customer_name: string;
  customer_gstin?: string | null;
  business_name?: string | null;
  business_gstin?: string | null;
  hsn_sac_code?: string | null;
  description?: string | null;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_terms?: string | null;
  status?: string | null;
};

function inr(n: number) {
  return "Rs. " + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Indian numbering amount-in-words (Lakh/Crore).
function amountInWords(num: number): string {
  const n = Math.round(Number(num) * 100) / 100;
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
  const three = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    return (h ? a[h] + " Hundred" + (r ? " and " : "") : "") + (r ? two(r) : "");
  };
  const inWords = (x: number): string => {
    if (x === 0) return "Zero";
    let s = "";
    const cr = Math.floor(x / 10000000); x %= 10000000;
    const lk = Math.floor(x / 100000); x %= 100000;
    const th = Math.floor(x / 1000); x %= 1000;
    if (cr) s += two(cr) + " Crore ";
    if (lk) s += two(lk) + " Lakh ";
    if (th) s += two(th) + " Thousand ";
    if (x) s += three(x);
    return s.trim();
  };
  let out = "Rupees " + inWords(rupees);
  if (paise) out += " and " + inWords(paise) + " Paise";
  return out + " Only";
}

export function downloadInvoicePdf(inv: InvoicePdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  const isIntra = inv.cgst_amount > 0 || inv.sgst_amount > 0;
  const gstTotal = inv.cgst_amount + inv.sgst_amount + inv.igst_amount;

  // Outer border (government form aesthetic)
  doc.setLineWidth(0.6);
  doc.rect(M, M, W - M * 2, 273);

  // Top banner
  doc.setFillColor(15, 23, 42); // navy
  doc.rect(M, M, W - M * 2, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TAX INVOICE", W / 2, M + 8, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("(Original for Recipient)", W - M - 2, M + 8, { align: "right" });
  doc.text("Rule 46 of CGST Rules, 2017", M + 2, M + 8);

  // Seller box
  let y = M + 12;
  doc.setDrawColor(0);
  doc.setTextColor(0, 0, 0);
  doc.rect(M, y, W - M * 2, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(inv.business_name || "Your Business", M + 3, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`GSTIN: ${inv.business_gstin || "—"}`, M + 3, y + 12);
  doc.text("State: India", M + 3, y + 17);
  doc.text("Generated via FinSage AI", W - M - 3, y + 17, { align: "right" });

  // Invoice meta strip
  y += 22;
  doc.rect(M, y, (W - M * 2) / 2, 16);
  doc.rect(M + (W - M * 2) / 2, y, (W - M * 2) / 2, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Invoice No.", M + 3, y + 6);
  doc.text("Invoice Date", M + (W - M * 2) / 2 + 3, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(inv.invoice_number, M + 3, y + 12);
  doc.text(new Date(inv.created_at).toLocaleDateString("en-IN"), M + (W - M * 2) / 2 + 3, y + 12);

  // Bill To
  y += 16;
  doc.rect(M, y, W - M * 2, 24);
  doc.setFillColor(240, 240, 240);
  doc.rect(M, y, W - M * 2, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BILL TO / DETAILS OF RECEIVER", M + 3, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(inv.customer_name, M + 3, y + 12);
  doc.setFontSize(9);
  doc.text(`GSTIN: ${inv.customer_gstin || "Unregistered"}`, M + 3, y + 18);
  doc.text(`Due Date: ${inv.due_date || "—"}`, W - M - 3, y + 18, { align: "right" });

  // Line items table
  y += 24;
  const head = isIntra
    ? [["#", "Description", "HSN/SAC", "Taxable (Rs.)", "CGST", "SGST", "Total"]]
    : [["#", "Description", "HSN/SAC", "Taxable (Rs.)", "IGST", "Total", ""]];
  const rowTotal = inv.taxable_amount + gstTotal;
  const body = isIntra
    ? [[
        "1",
        inv.description || "Goods / Services supplied",
        inv.hsn_sac_code || "—",
        inr(inv.taxable_amount),
        inr(inv.cgst_amount),
        inr(inv.sgst_amount),
        inr(rowTotal),
      ]]
    : [[
        "1",
        inv.description || "Goods / Services supplied",
        inv.hsn_sac_code || "—",
        inr(inv.taxable_amount),
        inr(inv.igst_amount),
        inr(rowTotal),
        "",
      ]];

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    margin: { left: M, right: M },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9, valign: "top" },
    columnStyles: { 0: { halign: "center", cellWidth: 8 } },
  });

  // Totals block
  // @ts-expect-error jspdf-autotable augments doc
  const afterY: number = doc.lastAutoTable.finalY + 2;
  const boxX = W - M - 80;
  const boxW = 80;
  const rows: [string, string][] = [
    ["Taxable Value", inr(inv.taxable_amount)],
    ...(isIntra
      ? [["CGST", inr(inv.cgst_amount)], ["SGST", inr(inv.sgst_amount)]] as [string, string][]
      : [["IGST", inr(inv.igst_amount)]] as [string, string][]),
    ["Grand Total", inr(inv.total_amount)],
    ["Amount Paid", inr(inv.amount_paid)],
    ["Balance Due", inr(Math.max(0, inv.total_amount - inv.amount_paid))],
  ];
  let ty = afterY;
  rows.forEach(([k, v], i) => {
    const isTotal = k === "Grand Total";
    doc.setFillColor(isTotal ? 15 : 245, isTotal ? 23 : 245, isTotal ? 42 : 245);
    doc.rect(boxX, ty, boxW, 7, "F");
    doc.setTextColor(isTotal ? 255 : 0, isTotal ? 255 : 0, isTotal ? 255 : 0);
    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(k, boxX + 2, ty + 5);
    doc.text(v, boxX + boxW - 2, ty + 5, { align: "right" });
    ty += 7;
    void i;
  });
  doc.setTextColor(0, 0, 0);

  // Amount in words
  const wordsY = afterY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Amount Chargeable (in words):", M, wordsY + 5);
  doc.setFont("helvetica", "normal");
  const words = amountInWords(inv.total_amount);
  const wrap = doc.splitTextToSize(words, boxX - M - 4);
  doc.text(wrap, M, wordsY + 11);

  // Terms + signature
  const footY = Math.max(ty, wordsY + 40) + 6;
  doc.rect(M, footY, W - M * 2, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Terms & Conditions", M + 3, footY + 5);
  doc.setFont("helvetica", "normal");
  const terms = [
    `1. Payment terms: ${inv.payment_terms || "Due on receipt"}.`,
    "2. Interest @18% p.a. will be charged on delayed payments.",
    "3. Subject to jurisdiction of local courts.",
    "4. E. & O.E.",
  ];
  doc.text(terms, M + 3, footY + 11);

  doc.setFont("helvetica", "bold");
  doc.text(`For ${inv.business_name || "Your Business"}`, W - M - 3, footY + 5, { align: "right" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("(Authorised Signatory)", W - M - 3, footY + 30, { align: "right" });

  // Bottom disclaimer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(
    "This is a computer generated invoice as per Rule 46 of the CGST Rules, 2017. Signature not mandatory where digitally issued.",
    W / 2,
    M + 273 - 4,
    { align: "center" }
  );

  doc.save(`Invoice-${inv.invoice_number}.pdf`);
}
