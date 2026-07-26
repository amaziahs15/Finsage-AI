import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Deterministic MSME Impact Score (0-100): 6 evidence-backed components.
export function computeMsmeImpactScore(u: {
  financial_impact_score: number;
  operational_impact_score: number;
  compliance_impact_score: number;
  deadline_urgency_score: number;
  msme_reach_score: number;
  penalty_risk_score: number;
}) {
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
  const financial = clamp(u.financial_impact_score, 20);
  const operational = clamp(u.operational_impact_score, 15);
  const compliance = clamp(u.compliance_impact_score, 20);
  const urgency = clamp(u.deadline_urgency_score, 15);
  const reach = clamp(u.msme_reach_score, 15);
  const penalty = clamp(u.penalty_risk_score, 15);
  const total = financial + operational + compliance + urgency + reach + penalty;
  return {
    total,
    breakdown: { financial, operational, compliance, urgency, reach, penalty },
    level: total >= 70 ? "high" : total >= 40 ? "medium" : "low",
  };
}

// Personalized relevance score for a specific user based on their profile.
export function personalizedRelevance(
  update: {
    affected_business_types: unknown;
    affected_industries: unknown;
    msme_impact_score: number;
    compliance_deadline: string | null;
  },
  profile: { business_type: string | null; state: string | null } | null,
) {
  let score = Math.round(update.msme_impact_score * 0.6);
  const types = Array.isArray(update.affected_business_types) ? update.affected_business_types.map(String) : [];
  const inds = Array.isArray(update.affected_industries) ? update.affected_industries.map(String) : [];
  if (profile?.business_type) {
    const bt = profile.business_type.toLowerCase();
    if (types.some((t) => bt.includes(t.toLowerCase()) || t.toLowerCase().includes(bt))) score += 20;
    if (inds.some((t) => bt.includes(t.toLowerCase()))) score += 10;
  }
  if (update.compliance_deadline) {
    const days = Math.max(0, Math.round((new Date(update.compliance_deadline).getTime() - Date.now()) / 86400e3));
    if (days <= 15) score += 15;
    else if (days <= 45) score += 8;
  }
  return Math.max(0, Math.min(100, score));
}

export const listRegulatoryUpdates = createServerFn({ method: "GET" })
  .handler(async () => {
    const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supa
      .from("regulatory_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRegulatoryForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("business_type, state")
      .eq("user_id", context.userId)
      .maybeSingle();
    const { data: updates } = await context.supabase
      .from("regulatory_updates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (updates ?? [])
      .map((u) => ({
        ...u,
        _relevance: personalizedRelevance(
          {
            affected_business_types: u.affected_business_types,
            affected_industries: u.affected_industries,
            msme_impact_score: u.msme_impact_score,
            compliance_deadline: u.compliance_deadline,
          },
          profile,
        ),
      }))
      .sort((a, b) => b._relevance - a._relevance);
  });

const AnalyzeUpdateInput = z.object({
  original_content: z.string().min(20).max(20000),
  source_url: z.string().url().optional().nullable(),
  source_name: z.string().max(200).optional().nullable(),
  document_title: z.string().max(300).optional().nullable(),
});

// Admin-only: analyze a raw notification/circular into structured data using Lovable AI.
export const analyzeRegulatoryUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AnalyzeUpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin role required");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `You are an Indian tax & compliance analyst. Analyse this notification for its impact on Indian MSMEs. Return STRICT JSON only, no prose, matching this schema:
{
  "title": string,
  "category": "GST"|"TDS"|"Income Tax"|"ROC"|"Labour"|"MSME"|"Other",
  "summary": string,
  "publication_date": string|null,
  "effective_date": string|null,
  "compliance_deadline": string|null,
  "previous_requirement": string,
  "new_requirement": string,
  "what_changed": string,
  "affected_laws": string[],
  "affected_rules": string[],
  "affected_clauses": string[],
  "affected_business_types": string[],
  "affected_industries": string[],
  "financial_impact_score": number (0-20),
  "operational_impact_score": number (0-15),
  "compliance_impact_score": number (0-20),
  "deadline_urgency_score": number (0-15),
  "msme_reach_score": number (0-15),
  "penalty_risk_score": number (0-15),
  "action_required": boolean,
  "action_steps": string[],
  "analysis_en": { "plain_english": string, "who_is_affected": string, "what_to_do": string },
  "analysis_hi": { "plain_english": string, "who_is_affected": string, "what_to_do": string },
  "analysis_ta": { "plain_english": string, "who_is_affected": string, "what_to_do": string }
}

Source URL: ${data.source_url ?? "(unknown)"}
Source name: ${data.source_name ?? "(unknown)"}
Document title: ${data.document_title ?? "(unknown)"}

--- ORIGINAL TEXT ---
${data.original_content}
--- END ---`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const parsed = JSON.parse(json.choices[0].message.content) as Record<string, unknown>;

    const impact = computeMsmeImpactScore({
      financial_impact_score: Number(parsed.financial_impact_score) || 0,
      operational_impact_score: Number(parsed.operational_impact_score) || 0,
      compliance_impact_score: Number(parsed.compliance_impact_score) || 0,
      deadline_urgency_score: Number(parsed.deadline_urgency_score) || 0,
      msme_reach_score: Number(parsed.msme_reach_score) || 0,
      penalty_risk_score: Number(parsed.penalty_risk_score) || 0,
    });

    // Honesty score for the analysis itself
    const hasSource = data.source_url && /\.gov\.in/i.test(data.source_url) ? 25 : data.source_url ? 15 : 5;
    const hasLaws = Array.isArray(parsed.affected_laws) && parsed.affected_laws.length > 0 ? 20 : 8;
    const hasDates = parsed.effective_date || parsed.compliance_deadline ? 15 : 5;
    const hasSteps = Array.isArray(parsed.action_steps) && parsed.action_steps.length > 0 ? 15 : 5;
    const groundedness = /verify|refer|per notification|section/i.test(String(parsed.what_changed ?? "")) ? 15 : 8;
    const structure = parsed.previous_requirement && parsed.new_requirement ? 10 : 4;
    const honesty = hasSource + hasLaws + hasDates + hasSteps + groundedness + structure;

    const row = {
      title: String(parsed.title ?? data.document_title ?? "Regulatory update"),
      category: String(parsed.category ?? "Other"),
      summary: String(parsed.summary ?? ""),
      original_content: data.original_content,
      source_url: data.source_url ?? null,
      source_name: data.source_name ?? null,
      document_title: data.document_title ?? null,
      publication_date: parsed.publication_date || null,
      effective_date: parsed.effective_date || null,
      compliance_deadline: parsed.compliance_deadline || null,
      previous_requirement: String(parsed.previous_requirement ?? ""),
      new_requirement: String(parsed.new_requirement ?? ""),
      what_changed: String(parsed.what_changed ?? ""),
      affected_laws: parsed.affected_laws ?? [],
      affected_rules: parsed.affected_rules ?? [],
      affected_clauses: parsed.affected_clauses ?? [],
      affected_business_types: parsed.affected_business_types ?? [],
      affected_industries: parsed.affected_industries ?? [],
      financial_impact_score: Number(parsed.financial_impact_score) || 0,
      operational_impact_score: Number(parsed.operational_impact_score) || 0,
      compliance_impact_score: Number(parsed.compliance_impact_score) || 0,
      deadline_urgency_score: Number(parsed.deadline_urgency_score) || 0,
      msme_reach_score: Number(parsed.msme_reach_score) || 0,
      penalty_risk_score: Number(parsed.penalty_risk_score) || 0,
      msme_impact_score: impact.total,
      impact_level: impact.level,
      action_required: Boolean(parsed.action_required),
      action_steps: parsed.action_steps ?? [],
      honesty_score: Math.min(100, honesty),
      honesty_breakdown: { hasSource, hasLaws, hasDates, hasSteps, groundedness, structure },
      analysis_en: parsed.analysis_en ?? null,
      analysis_hi: parsed.analysis_hi ?? null,
      analysis_ta: parsed.analysis_ta ?? null,
      verified: true,
      last_verified_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await context.supabase
      .from("regulatory_updates")
      .insert(row as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });
