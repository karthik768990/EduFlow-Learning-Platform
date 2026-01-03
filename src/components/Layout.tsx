import { ReactNode, useState, useEffect } from 'react';
import { NavLink as RouterNavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, LayoutDashboard, FileText, Clock, Trophy, MessageCircle, LogOut, HelpCircle, Settings, Award, Sun, Moon, PanelLeftClose, PanelLeft, Timer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTimer } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  return (
    <button 
      onClick={toggleSidebar}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-sidebar-accent transition-colors"
      aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );
}

function AppSidebar() {
  const { user, role, signOut } = useAuth();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const isCollapsed = state === 'collapsed';
  const [profileData, setProfileData] = useState<{ full_name: string | null; avatar_url: string | null }>({ full_name: null, avatar_url: null });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user!.id)
      .maybeSingle();
    
    if (data) {
      setProfileData({ full_name: data.full_name, avatar_url: data.avatar_url });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const studentNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assignments', icon: FileText, label: 'Assignments' },
    { to: '/doubts', icon: HelpCircle, label: 'My Questions' },
    { to: '/study-timer', icon: Clock, label: 'Study Timer' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { to: '/achievements', icon: Award, label: 'Achievements' },
  ];

  const teacherNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/assignments', icon: FileText, label: 'Assignments' },
    { to: '/doubts', icon: MessageCircle, label: 'Student Doubts' },
  ];

  const navItems = role === 'teacher' ? teacherNav : studentNav;
  const displayName = profileData.full_name || user?.user_metadata?.full_name || user?.email;
  const initials = profileData.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) 
    || user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('') 
    || user?.email?.[0]?.toUpperCase() 
    || 'U';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className={cn(
            "bg-primary rounded-lg flex items-center justify-center text-primary-foreground shrink-0 transition-all",
            isCollapsed ? "w-8 h-8" : "w-10 h-10"
          )}>
            <BookOpen size={isCollapsed ? 16 : 20} />
          </div>
          {!isCollapsed && (
            <span className="font-display text-xl font-bold text-sidebar-foreground">EduFlow</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn("text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wide", isCollapsed && "sr-only")}>
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton asChild>
                        <RouterNavLink
                          to={item.to}
                          className={({ isActive }) => cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                            isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                          )}
                        >
                          <item.icon className="w-5 h-5 shrink-0" />
                          {!isCollapsed && <span>{item.label}</span>}
                        </RouterNavLink>
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right">
                        {item.label}
                      </TooltipContent>
                    )}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("border-t border-sidebar-border", isCollapsed ? "p-2" : "p-4")}>
        <div className={cn(
          "flex items-center rounded-md",
          isCollapsed ? "justify-center p-1" : "gap-3 p-2 mb-2"
        )}>
          {profileData.avatar_url ? (
            <img 
              src={profileData.avatar_url} 
              alt="Profile" 
              className={cn(
                "rounded-full object-cover shrink-0 transition-all",
                isCollapsed ? "w-8 h-8" : "w-10 h-10"
              )}
            />
          ) : (
            <div className={cn(
              "rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold shrink-0 transition-all",
              isCollapsed ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
            )}>
              {initials}
            </div>
          )}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-sidebar-foreground truncate">
                {displayName}
              </div>
              <div className="text-xs text-sidebar-foreground/50 capitalize">{role}</div>
            </div>
          )}
        </div>
        
        <SidebarMenu>
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton asChild>
                  <RouterNavLink
                    to="/profile"
                    className={({ isActive }) => cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                  >
                    <Settings className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span>Profile Settings</span>}
                  </RouterNavLink>
                </SidebarMenuButton>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  Profile Settings
                </TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton asChild>
                  <button 
                    onClick={handleSignOut}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground w-full"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span>Sign Out</span>}
                  </button>
                </SidebarMenuButton>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  Sign Out
                </TooltipContent>
              )}
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function MainContent({ children, title }: { children: ReactNode; title: string }) {
  const { theme, toggleTheme } = useTheme();
  const { isRunning, timeLeft, isBreak, isLongBreak, formatTime } = useTimer();
  
  return (
    <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden">
      <header className="flex items-center justify-between px-4 sm:px-8 py-4 bg-background border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <SidebarToggleButton />
          <h1 className="font-display text-lg sm:text-2xl font-bold text-foreground truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isRunning && (
            <RouterNavLink
              to="/study-timer"
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                isBreak 
                  ? "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20" 
                  : "bg-primary/10 text-primary border border-primary/20"
              )}
            >
              <Timer size={16} className="animate-pulse" />
              <span className="font-mono">{formatTime(timeLeft)}</span>
              <span className="hidden sm:inline text-xs opacity-70">
                {isBreak ? (isLongBreak ? 'Long Break' : 'Break') : 'Focus'}
              </span>
            </RouterNavLink>
          )}
          <button 
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-secondary border border-border text-muted-foreground hover:bg-sidebar hover:text-sidebar-foreground transition-all hover:rotate-[15deg] shrink-0"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </header>
      <motion.div 
        className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    </main>
  );
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <MainContent title={title}>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
