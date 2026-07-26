import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { LayoutDashboard, MessageSquare, CalendarCheck, Receipt, Settings, LogOut, Landmark, Wallet, TrendingUp, FileText, BarChart3, Scale } from "lucide-react";
import { LanguageSwitcher } from "@/components/marketing-chrome";

const nav = [
  { to: "/dashboard", icon: LayoutDashboard, key: "app_dashboard" as const },
  { to: "/chat", icon: MessageSquare, key: "app_chat" as const },
  { to: "/compliance", icon: CalendarCheck, key: "app_compliance" as const },
  { to: "/transactions", icon: Receipt, key: "app_transactions" as const },
  { to: "/invoices", icon: FileText, key: "app_invoices" as const },
  { to: "/reports", icon: BarChart3, key: "app_reports" as const },
  { to: "/budget", icon: Wallet, key: "app_budget" as const },
  { to: "/investment", icon: TrendingUp, key: "app_investment" as const },
  { to: "/schemes", icon: Landmark, key: "app_schemes" as const },
  { to: "/regulatory", icon: Scale, key: "app_regulatory" as const },
  { to: "/settings", icon: Settings, key: "app_settings" as const },
];

export function AppSidebar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [email, setEmail] = useState<string | null>(null);

  // Load current user email ONCE on mount. Do NOT re-apply preferred_language
  // from the profile here — the I18nProvider already hydrates it once and
  // respects the user's manual selection. Re-fetching here on every render
  // used to clobber the just-selected language back to the stored value.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-navy text-navy-foreground border-r border-navy/20">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-white/10">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal text-white font-bold">F</div>
        <span className="font-bold text-lg">FinSage <span className="text-teal">AI</span></span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active ? "bg-teal text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4 space-y-3">
        <LanguageSwitcher />
        <div className="text-xs text-white/60 truncate">{email}</div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          {t("auth_signout")}
        </button>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="md:hidden sticky top-0 z-30 bg-navy text-white border-b border-white/10">
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-teal text-white text-xs font-bold">F</div>
          <span className="font-bold">FinSage <span className="text-teal">AI</span></span>
        </div>
        <LanguageSwitcher variant="dark" />
      </div>
      <div className="flex overflow-x-auto border-t border-white/10">
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium whitespace-nowrap ${
                active ? "text-teal border-b-2 border-teal" : "text-white/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
