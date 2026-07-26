import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar, MobileTopBar } from "@/components/app-sidebar";
import { ChatWidget } from "@/components/chat-widget";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <MobileTopBar />
      <div className="md:pl-64">
        <Outlet />
      </div>
      <ChatWidget />
    </div>
  );
}

