import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Streaming chat endpoint: accepts { conversation_id, message, language } and streams
// the assistant response back as SSE-style chunks. Persists both messages to Supabase.
// Uses Gemini API via the OpenAI-compatible endpoint (gemini-2.5-flash, free tier).

type ChatBody = {
  conversation_id: string;
  message: string;
  language?: "en" | "hi" | "ta";
  page_context?: string; // optional hint about which page the widget was opened on
};

const SYSTEM_PROMPT = `You are FinSage AI, an evidence-backed Finance & Compliance copilot for Indian MSMEs (Micro, Small, and Medium Enterprises).

You help small business owners with:
- GST (Goods and Services Tax): registration, returns (GSTR-1, GSTR-3B, GSTR-9), ITC, e-invoicing
- TDS (Tax Deducted at Source): rates, sections, due dates, forms 26Q/24Q
- ROC (Registrar of Companies): annual filings, MGT-7, AOC-4, compliance calendar
- Income tax for businesses, presumptive taxation (44AD/44ADA)
- MSME schemes, MUDRA loans, PMEGP, subsidies
- Accounting basics, invoicing, cash flow

Rules:
1. Always cite official Indian government sources when possible: gst.gov.in, incometax.gov.in, mca.gov.in, msme.gov.in.
2. If you are not sure, SAY SO explicitly — do NOT invent rules, rates, or deadlines.
3. Reply in the same language the user asked in (English, हिन्दी, or தமிழ்).
4. Use simple plain language — the user is a shopkeeper or small business owner, not an accountant.
5. Format with short paragraphs, bullet points, numbered lists, and Markdown tables. Use ₹ for Indian Rupees.
6. NEVER use ASCII art, box-drawing characters, or hand-drawn diagrams. If tabular data is needed, use a proper Markdown table with pipes and dashes. If a stepwise flow is needed, use a numbered list.
7. Include a "Sources:" list at the end with the URLs you referenced (or say "General knowledge" if none).
8. Add "Note:" for caveats (e.g., "Rates as of FY 2024-25 — verify current rates on gst.gov.in").`;

async function computeHonestyScore(answer: string): Promise<{ score: number; breakdown: Record<string, number> }> {
  // Heuristic Honesty Score (0-100):
  // - Source Authority (25): official .gov.in URLs cited
  // - Content Relevance (15): mentions Indian tax/compliance terms
  // - Evidence Support (20): explicit citations/quotes
  // - Source Recency (10): mentions FY/AY or a recent year
  // - Cross-Source Agreement (10): >=2 distinct sources
  // - Answer Groundedness (20): hedges when unsure ("verify", "may vary", "not sure")
  const lower = answer.toLowerCase();
  const govMatches = (answer.match(/[a-z0-9-]+\.gov\.in/gi) || []);
  const uniqueGov = new Set(govMatches.map((s) => s.toLowerCase()));
  const sourceAuthority = Math.min(25, uniqueGov.size * 12);
  const relevanceTerms = ["gst", "tds", "roc", "gstr", "itc", "mca", "msme", "hsn", "sac", "cgst", "sgst", "igst"];
  const relevance = Math.min(15, relevanceTerms.filter((k) => lower.includes(k)).length * 3);
  const evidence = /source|section|rule|circular|notification|reference/i.test(answer) ? 20 : 10;
  const recency = /(fy|ay)\s?20\d\d|20(2[3-9]|3\d)/i.test(answer) ? 10 : 5;
  const agreement = uniqueGov.size >= 2 ? 10 : uniqueGov.size === 1 ? 6 : 3;
  const grounded = /(verify|may vary|not sure|consult|check the latest|as of)/i.test(answer) ? 20 : 12;
  const score = sourceAuthority + relevance + evidence + recency + agreement + grounded;
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      source_authority: sourceAuthority,
      relevance,
      evidence,
      recency,
      agreement,
      grounded,
    },
  };
}

function extractSources(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s)\]]+|[a-z0-9-]+\.gov\.in[^\s)\]]*/gi) || [];
  return Array.from(new Set(urls.map((u) => u.replace(/[.,;:]$/, ""))));
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        if (!body?.conversation_id || !body?.message?.trim()) {
          return new Response("Bad request", { status: 400 });
        }

        // Authenticate via bearer token
        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData } = await supa.auth.getUser(token);
        const userId = userData.user?.id;
        if (!userId) return new Response("Unauthorized", { status: 401 });

        // Load prior messages
        const { data: history } = await supa
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", body.conversation_id)
          .order("created_at", { ascending: true })
          .limit(30);

        // Persist user message
        await supa.from("chat_messages").insert({
          conversation_id: body.conversation_id,
          user_id: userId,
          role: "user",
          content: body.message,
          language: body.language ?? "en",
        });

        const langInstr =
          body.language === "hi"
            ? "\n\nRespond in हिन्दी (Hindi)."
            : body.language === "ta"
            ? "\n\nRespond in தமிழ் (Tamil)."
            : "\n\nRespond in English.";

        // ---- Ground the model in the signed-in user's real data ----
        // Fetch a compact summary of their finances so the model can answer
        // personal questions ("how much did I spend on rent this month?",
        // "am I over budget?", "when is my next GST deadline?") with real
        // numbers instead of guessing. All queries respect RLS via `supa`.
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const [profileRes, txnRes, budgetRes, deadlineRes, invRes, regRes] = await Promise.all([
          supa.from("profiles").select("business_name, business_type, gstin, state, financial_health_score").eq("user_id", userId).maybeSingle(),
          supa.from("transactions").select("amount, category, kind, txn_date, description").order("txn_date", { ascending: false }).limit(200),
          supa.from("budgets").select("category, monthly_limit"),
          supa.from("compliance_deadlines").select("title, kind, due_date, status").order("due_date", { ascending: true }).limit(20),
          supa.from("invoices").select("invoice_number, customer_name, total_amount, amount_paid, due_date, status").order("created_at", { ascending: false }).limit(50),
          supa.from("regulatory_updates").select("title, category, summary, effective_date, compliance_deadline, msme_impact_score, action_required").order("created_at", { ascending: false }).limit(10),
        ]);
        const profile = profileRes.data as { business_name?: string | null; business_type?: string | null; gstin?: string | null; financial_health_score?: number | null } | null;
        const txns = (txnRes.data ?? []) as { amount: number; category: string | null; kind: "income" | "expense"; txn_date: string; description: string | null }[];
        const budgets = (budgetRes.data ?? []) as { category: string; monthly_limit: number }[];
        const deadlines = (deadlineRes.data ?? []) as { title: string; kind: string; due_date: string; status: string }[];

        const monthTxns = txns.filter((t) => t.txn_date >= monthStart);
        const monthIncome = monthTxns.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
        const monthExpense = monthTxns.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
        const catSpend: Record<string, number> = {};
        for (const t of monthTxns) {
          if (t.kind !== "expense" || !t.category) continue;
          catSpend[t.category] = (catSpend[t.category] ?? 0) + Number(t.amount);
        }
        const topCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const budgetLines = budgets.map((b) => {
          const spent = catSpend[b.category] ?? 0;
          const pct = b.monthly_limit > 0 ? Math.round((spent / Number(b.monthly_limit)) * 100) : 0;
          return `  - ${b.category}: spent ₹${Math.round(spent).toLocaleString("en-IN")} of ₹${Math.round(Number(b.monthly_limit)).toLocaleString("en-IN")} (${pct}%)${spent > Number(b.monthly_limit) ? " — OVER BUDGET" : ""}`;
        });
        const upcomingDeadlines = deadlines.filter((d) => d.status !== "completed").slice(0, 8);
        const recentTxnLines = monthTxns.slice(0, 15).map((t) => `  - ${t.txn_date} ${t.kind} ₹${Math.round(Number(t.amount)).toLocaleString("en-IN")} · ${t.category ?? "-"}${t.description ? ` · ${t.description}` : ""}`);

        const invoices = (invRes.data ?? []) as { invoice_number: string; customer_name: string; total_amount: number; amount_paid: number; due_date: string | null; status: string }[];
        const today = new Date().toISOString().slice(0, 10);
        const outstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.total_amount) - Number(i.amount_paid)), 0);
        const overdueInvs = invoices.filter((i) => i.due_date && i.due_date < today && Number(i.amount_paid) < Number(i.total_amount));
        const invLines = invoices.slice(0, 10).map((i) => `  - ${i.invoice_number} · ${i.customer_name} · ₹${Math.round(Number(i.total_amount)).toLocaleString("en-IN")} · paid ₹${Math.round(Number(i.amount_paid)).toLocaleString("en-IN")} · due ${i.due_date ?? "—"} · ${i.status}`);
        const regUpdates = (regRes.data ?? []) as { title: string; category: string | null; summary: string | null; effective_date: string | null; compliance_deadline: string | null; msme_impact_score: number; action_required: boolean }[];
        const regLines = regUpdates.slice(0, 5).map((r) => `  - [${r.category ?? "Reg"}] ${r.title} · impact ${r.msme_impact_score}/100 · effective ${r.effective_date ?? "—"} · deadline ${r.compliance_deadline ?? "—"}${r.action_required ? " · ACTION REQUIRED" : ""}`);

        const userContext = `\n\n--- SIGNED-IN USER CONTEXT (real data, respect privacy, only reference when relevant) ---
Business: ${profile?.business_name ?? "(not set)"} · Type: ${profile?.business_type ?? "(not set)"} · GSTIN: ${profile?.gstin ?? "(not set)"} · Financial Health Score: ${profile?.financial_health_score ?? "n/a"}/100
Current month (${monthStart} → today): income ₹${Math.round(monthIncome).toLocaleString("en-IN")}, expense ₹${Math.round(monthExpense).toLocaleString("en-IN")}, net ₹${Math.round(monthIncome - monthExpense).toLocaleString("en-IN")}
Top spending categories this month:
${topCats.length ? topCats.map(([c, v]) => `  - ${c}: ₹${Math.round(v).toLocaleString("en-IN")}`).join("\n") : "  (none logged yet)"}
Budgets vs actuals this month:
${budgetLines.length ? budgetLines.join("\n") : "  (no budgets set)"}
Upcoming / overdue compliance deadlines:
${upcomingDeadlines.length ? upcomingDeadlines.map((d) => `  - ${d.due_date} · ${d.kind} · ${d.title} · ${d.status}`).join("\n") : "  (none scheduled)"}
Recent transactions (latest first):
${recentTxnLines.length ? recentTxnLines.join("\n") : "  (none)"}
Invoices & receivables: outstanding ₹${Math.round(outstanding).toLocaleString("en-IN")} across ${invoices.length} invoices (${overdueInvs.length} overdue).
${invLines.length ? invLines.join("\n") : "  (no invoices yet)"}
Recent regulatory updates relevant to Indian MSMEs:
${regLines.length ? regLines.join("\n") : "  (none published yet)"}
--- END USER CONTEXT ---
When the user's question is about their own finances, invoices, receivables, budgets, spending, or personal compliance deadlines, USE the numbers above. For regulatory questions, prefer the Regulatory Updates listed above when they match; otherwise answer from general compliance knowledge with official sources. You can freely mix both in one conversation.`;

        const pageHint = body.page_context ? `\n\nThe user is currently on the "${body.page_context}" page — you can lightly bias your opening framing toward that topic, but still answer any question they ask.` : "";

        const messages = [
          { role: "system", content: SYSTEM_PROMPT + langInstr + userContext + pageHint },
          ...((history ?? []) as { role: string; content: string }[]).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: body.message },
        ];

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return new Response("Missing GEMINI_API_KEY", { status: 500 });

        const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            messages,
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errText = await upstream.text().catch(() => "");
          if (upstream.status === 429) return new Response("Rate limited", { status: 429 });
          return new Response(`AI error: ${errText}`, { status: 500 });
        }

        let fullText = "";
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const stream = new ReadableStream({
          async start(controller) {
            const reader = upstream.body!.getReader();
            let buffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || !trimmed.startsWith("data:")) continue;
                  const data = trimmed.slice(5).trim();
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullText += delta;
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", text: delta })}\n\n`));
                    }
                  } catch { /* ignore */ }
                }
              }

              // Compute honesty + sources; persist assistant msg
              const honesty = await computeHonestyScore(fullText);
              const sources = extractSources(fullText);
              await supa.from("chat_messages").insert({
                conversation_id: body.conversation_id,
                user_id: userId,
                role: "assistant",
                content: fullText,
                honesty_score: honesty.score,
                honesty_breakdown: honesty.breakdown,
                sources,
                language: body.language ?? "en",
              });
              // Bump conversation updated_at + set title from first user msg if default
              await supa.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", body.conversation_id);
              if ((history?.length ?? 0) === 0) {
                const title = body.message.slice(0, 60);
                await supa.from("chat_conversations").update({ title }).eq("id", body.conversation_id);
              }

              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", honesty_score: honesty.score, honesty_breakdown: honesty.breakdown, sources })}\n\n`));
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});
