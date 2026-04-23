import { Outlet, useLocation } from "react-router-dom";
import { Library, Sparkles, Mic, Settings as SettingsIcon, Moon as MoonIcon, LogOut } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { StarField } from "@/components/magic/StarField";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles as SparklesIcon } from "lucide-react";

const navItems = [
  { title: "Tonight's Story", url: "/app", icon: Library, end: true },
  { title: "Create Story", url: "/app/create", icon: Sparkles, end: false },
  { title: "My Voice", url: "/app/voice", icon: Mic, end: false },
  { title: "Settings", url: "/app/settings", icon: SettingsIcon, end: false },
];

const AppSidebar = ({ credits }: { credits: number | null }) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative w-8 h-8 shrink-0">
            <div className="absolute inset-0 bg-aurora rounded-full blur-md opacity-60" />
            <div className="relative w-8 h-8 rounded-full bg-aurora flex items-center justify-center">
              <MoonIcon className="w-4 h-4 text-night" strokeWidth={2.5} />
            </div>
          </div>
          {!collapsed && <span className="font-display text-xl font-bold text-gradient-gold">Lullaby</span>}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Storyteller</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="hover:bg-sidebar-accent rounded-lg"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && credits !== null && (
          <div className="mx-3 mt-4 p-4 rounded-2xl bg-gradient-to-br from-accent/20 to-pink/10 border border-accent/30">
            <div className="flex items-center gap-2 mb-1">
              <SparklesIcon className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">Free credits</span>
            </div>
            <p className="font-display text-3xl font-bold">{credits}</p>
            <p className="text-xs text-sidebar-foreground/60 mt-1">stories left tonight</p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-1 mb-1">
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </div>
        )}
        <SidebarMenuButton onClick={handleSignOut} className="hover:bg-sidebar-accent rounded-lg">
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
};

const DashboardLayout = () => {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const location = useLocation();

  const refresh = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles").select("free_credits").eq("user_id", user.id).maybeSingle();
    if (data) setCredits(data.free_credits);
  };

  useEffect(() => { refresh(); }, [user, location.pathname]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <div className="fixed inset-0 -z-10 bg-night">
          <StarField density={50} />
        </div>
        <AppSidebar credits={credits} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-foreground/10 flex items-center px-4 gap-3 bg-background/40 backdrop-blur-md sticky top-0 z-20">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet context={{ refreshCredits: refresh, credits }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
