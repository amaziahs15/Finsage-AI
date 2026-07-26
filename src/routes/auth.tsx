import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/marketing-chrome";
import type { Lang, TranslationKey } from "@/lib/translations";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FinSage AI" },
      { name: "description", content: "Sign in or create your FinSage AI account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

// Strong password policy per spec: 8+ chars, upper, lower, number, special.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

function AuthPage() {
  const { mode } = Route.useSearch();
  const isSignup = mode === "signup";
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, bounce to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // Form state
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gstin, setGstin] = useState("");
  const [employeeCount, setEmployeeCount] = useState("emp_1");
  const [businessType, setBusinessType] = useState("bt_retail");
  const [preferredLanguage, setPreferredLanguage] = useState<Lang>(lang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignup) {
        if (!PASSWORD_RE.test(password)) {
          setError(t("auth_err_weak_password"));
          setLoading(false);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
              business_name: businessName || null,
              gstin: gstin || null,
              employee_count: employeeCount,
              business_type: businessType,
              preferred_language: preferredLanguage,
              onboarding_completed: true,
            },
          },
        });
        if (error) {
          if (/registered|exists|already/i.test(error.message)) {
            setError(t("auth_err_email_exists"));
          } else {
            setError(error.message || t("auth_err_generic"));
          }
          return;
        }
        // If session exists (auto-confirm on), go to dashboard; otherwise show a msg.
        if (data.session) {
          setLang(preferredLanguage);
          navigate({ to: "/dashboard", replace: true });
        } else {
          setError("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(/invalid|credentials/i.test(error.message) ? t("auth_err_invalid_creds") : error.message);
          return;
        }
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(t("auth_err_generic"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error.message || t("auth_err_generic"));
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      console.error(err);
      setError(t("auth_err_generic"));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-gradient text-navy-foreground flex flex-col">
      <div className="mx-auto max-w-7xl w-full px-6 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20 font-bold">F</div>
          <span className="font-bold text-lg">FinSage <span className="text-teal">AI</span></span>
        </Link>
        <LanguageSwitcher variant="dark" />
      </div>

      <div className="flex-1 grid place-items-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="glass rounded-2xl p-8 shadow-2xl">
            <h1 className="text-2xl font-bold text-navy tracking-tight">
              {isSignup ? t("auth_create_account") : t("auth_welcome_back")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup ? t("auth_signup_sub") : t("auth_signin_sub")}
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="mt-6 w-full inline-flex items-center justify-center gap-3 rounded-lg bg-white ring-1 ring-navy/10 py-2.5 text-sm font-semibold text-navy hover:bg-white/90 transition-colors disabled:opacity-60"
            >
              <GoogleIcon />
              {t("auth_google")}
            </button>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>{t("auth_or")}</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignup && (
                <>
                  <Field label={t("auth_full_name")} value={fullName} onChange={setFullName} required autoComplete="name" />
                  <Field label={t("auth_business_name")} value={businessName} onChange={setBusinessName} autoComplete="organization" />
                  <Field label={t("auth_gstin")} value={gstin} onChange={setGstin} />
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label={t("auth_business_type")} value={businessType} onChange={setBusinessType} options={[
                      ["bt_retail","bt_retail"],["bt_service","bt_service"],["bt_manufacturing","bt_manufacturing"],
                      ["bt_trading","bt_trading"],["bt_freelance","bt_freelance"],["bt_other","bt_other"],
                    ]} t={t} />
                    <SelectField label={t("auth_employees")} value={employeeCount} onChange={setEmployeeCount} options={[
                      ["emp_1","emp_1"],["emp_2_10","emp_2_10"],["emp_11_50","emp_11_50"],["emp_50p","emp_50p"],
                    ]} t={t} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-navy/70">{t("auth_language")}</label>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value as Lang)}
                      className="mt-1 w-full rounded-lg bg-white ring-1 ring-navy/10 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal"
                    >
                      <option value="en">English</option>
                      <option value="hi">हिन्दी</option>
                      <option value="ta">தமிழ்</option>
                    </select>
                  </div>
                </>
              )}
              <Field label={t("auth_email")} type="email" value={email} onChange={setEmail} required autoComplete="email" />
              <Field label={t("auth_password")} type="password" value={password} onChange={setPassword} required autoComplete={isSignup ? "new-password" : "current-password"} />
              {isSignup && <p className="text-[11px] text-muted-foreground">{t("auth_password_hint")}</p>}

              {error && (
                <div className="rounded-lg bg-destructive/10 ring-1 ring-destructive/20 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-navy text-navy-foreground py-2.5 font-semibold hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {loading ? "…" : isSignup ? t("auth_signup_btn") : t("auth_signin_btn")}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {isSignup ? (
                <>
                  {t("auth_have_account")}{" "}
                  <Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-teal hover:underline">{t("auth_signin_link")}</Link>
                </>
              ) : (
                <>
                  {t("auth_no_account")}{" "}
                  <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-teal hover:underline">{t("auth_signup_link")}</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, autoComplete }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-navy/70">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-lg bg-white ring-1 ring-navy/10 px-3 py-2 text-sm text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-teal"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, t }: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, TranslationKey][]; t: (k: TranslationKey) => string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-navy/70">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-white ring-1 ring-navy/10 px-3 py-2 text-sm text-navy focus:outline-none focus:ring-2 focus:ring-teal"
      >
        {options.map(([v, k]) => (
          <option key={v} value={v}>{t(k)}</option>
        ))}
      </select>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
