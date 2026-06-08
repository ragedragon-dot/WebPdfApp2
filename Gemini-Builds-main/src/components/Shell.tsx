import React from 'react';
import { ToolId, Tool } from '../types';
import { TOOLS } from '../data/tools';
import { 
  FileText, 
  LayoutDashboard, 
  Scissors, 
  Image as ImageIcon, 
  FileImage, 
  PenTool, 
  Award as StampIcon, 
  QrCode, 
  BookOpen, 
  Unlock, 
  Lock,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Combine,
  Hash,
  FileSearch,
  LockKeyhole,
  Maximize,
  ShieldBan,
  PaintBucket,
  GitPullRequest,
  FormInput,
  Headphones,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import FloatingQuickActionBall from './FloatingQuickActionBall';

interface ShellProps {
  children: React.ReactNode;
  activeTool: string;
  onSelectTool: (id: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Scissors: Scissors,
  Image: ImageIcon,
  FileImage: FileImage,
  PenTool: PenTool,
  Stamp: StampIcon,
  QrCode: QrCode,
  BookOpen: BookOpen,
  Combine: Combine,
  Hash: Hash,
  FileSearch: FileSearch,
  LockKeyhole: LockKeyhole,
  Unlock: Unlock,
  Maximize: Maximize,
  ShieldBan: ShieldBan,
  PaintBucket: PaintBucket,
  GitPullRequest: GitPullRequest,
  FormInput: FormInput,
  Headphones: Headphones,
  Sparkles: Sparkles
};

interface SidebarContentProps {
  activeTool: string;
  onSelectTool: (id: string) => void;
  setMenuOpen: (open: boolean) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  user: any;
  profile: any;
  loading: boolean;
  signInWithGoogle: () => void;
  logOut: () => void;
}

function SidebarContent({ 
  activeTool, 
  onSelectTool, 
  setMenuOpen, 
  theme, 
  setTheme, 
  user, 
  profile, 
  loading, 
  signInWithGoogle, 
  logOut 
}: SidebarContentProps) {
  const routerLocation = useLocation();
  return (
    <div className="flex flex-col h-full overflow-y-hidden select-none bg-white/70 dark:bg-slate-900/70 backdrop-blur-3xl">
      {/* Top Group: List items & selectors */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-0 space-y-6 scrollbar scrollbar-hide">
        
        {/* Drawer Header Close Row (Mobile) */}
        <div className="flex xl:hidden items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Menu Navigation
          </span>
          <button 
            onClick={() => setMenuOpen(false)}
            className="p-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 transition-colors cursor-pointer"
            title="Close menu drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main items panel */}
        <div className="space-y-4">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3">
            Primary Workspace
          </span>
          
          <button
            id="sidebar-nav-dashboard"
            onClick={() => {
               onSelectTool('dashboard');
               setMenuOpen(false);
            }}
            className={`w-full group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all focus:outline-none ${
              activeTool === 'dashboard'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md transform scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <LayoutDashboard className={`w-4 h-4 ${activeTool === 'dashboard' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
              Dashboard Overview
            </span>
          </button>

          <button
            id="sidebar-nav-local"
            onClick={() => {
               onSelectTool('local');
               setMenuOpen(false);
            }}
            className={`w-full group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all focus:outline-none ${
              routerLocation.pathname.startsWith('/local') && !routerLocation.pathname.startsWith('/local/summarizer')
                ? 'bg-emerald-500 dark:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transform scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <Scissors className={`w-4 h-4 ${routerLocation.pathname.startsWith('/local') && !routerLocation.pathname.startsWith('/local/summarizer') ? 'opacity-100' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
              Local Tools
            </span>
          </button>
        </div>

        <div className="space-y-4 pt-2">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-3">
            AI Capabilities
          </span>
          <button
            id="sidebar-nav-chat-ai"
            onClick={() => {
               onSelectTool('chat-ai');
               setMenuOpen(false);
            }}
            className={`w-full group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all focus:outline-none ${
              activeTool === 'chat-ai'
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md shadow-blue-500/20 transform scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <MessageSquare className={`w-4 h-4 ${activeTool === 'chat-ai' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
              Chat with AI
            </span>
          </button>

          <button
            id="sidebar-nav-summarizer"
            onClick={() => {
               onSelectTool('summarizer');
               setMenuOpen(false);
            }}
            className={`w-full group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all focus:outline-none ${
              activeTool === 'summarizer'
                ? 'bg-violet-600 dark:bg-violet-500 text-white shadow-md shadow-violet-500/20 transform scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <Sparkles className={`w-4 h-4 ${activeTool === 'summarizer' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
              PDF Summarizer
            </span>
          </button>

          <button
            id="sidebar-nav-flashcards"
            onClick={() => {
               onSelectTool('flashcards');
               setMenuOpen(false);
            }}
            className={`w-full group flex items-center justify-between px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all focus:outline-none ${
              activeTool === 'flashcards'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transform scale-[1.02]'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3">
              <BookOpen className={`w-4 h-4 ${activeTool === 'flashcards' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100 transition-opacity'}`} />
              Flashcard Studio
            </span>
          </button>
        </div>

        {/* Sidebar Native Ad Slot (Target for dynamic injection) */}
        <div id="sidebar-ad-slot" className="w-full h-0 invisible opacity-0 bg-transparent overflow-hidden">
          {/* Ad content will be injected here. Container remains collapsed when empty. */}
        </div>

        {/* Mobile Theme selector settings */}
        <div className="md:hidden py-4 space-y-3">
          <span className="px-3 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
            Appearance
          </span>
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 backdrop-blur-sm">
            <button
              onClick={() => setTheme('light')}
              className={`flex-grow flex justify-center items-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                theme === 'light'
                  ? 'bg-white dark:bg-slate-700 text-amber-500 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-grow flex justify-center items-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                theme === 'dark'
                  ? 'bg-white dark:bg-slate-700 text-indigo-400 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('system')}
              className={`flex-grow flex justify-center items-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                theme === 'system'
                  ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Account and Footer Info (Bottom group with mt-auto) */}
      <div className="mt-auto p-5 bg-white/40 dark:bg-slate-900/40 border-t border-slate-200/50 dark:border-slate-800/50 space-y-4 shrink-0 backdrop-blur-md">
        {/* Account Details & Sign Out for Mobile viewports */}
        <div className="md:hidden">
          {loading ? (
            <div className="text-xs text-slate-400 py-2">Loading account details...</div>
          ) : user ? (
            <div className="flex flex-col gap-3 p-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/60 dark:border-slate-700/60 rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
                      {(profile?.name || user.displayName || 'U')[0]}
                    </span>
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate pr-1">
                    {profile?.name || user.displayName || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    {user.email}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={logOut} 
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer focus:outline-none"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white shadow-md cursor-pointer transition-all"
              title="Sign in with Google"
            >
              Sign In with Google
            </button>
          )}
        </div>

        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200/50 dark:border-slate-700/30">
          <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
            <ShieldBan className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-widest block">Local Sandbox Mode</span>
            <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
              All PDF.js calls are held in memory. No files ever leave this secure environment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ children, activeTool, onSelectTool }: ShellProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();
  const isAIMode = location.pathname.startsWith('/ai');
  const { user, profile, loading, signInWithGoogle, logOut } = useAuth();

  // Load global theme option with Light, Dark, System values
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(() => {
    try {
      return (localStorage.getItem('pdf_workspace_theme') as 'light' | 'dark' | 'system') || 'system';
    } catch {
      return 'system';
    }
  });

  // Synchronize Dark / Light document settings
  React.useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = () => {
      root.classList.remove('light', 'dark');

      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else if (theme === 'light') {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      } else {
        // Evaluate system query
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      }
    };

    applyTheme();
    try {
      localStorage.setItem('pdf_workspace_theme', theme);
    } catch (e) {
      console.error(e);
    }

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        root.classList.remove('light', 'dark');
        if (e.matches) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      };
      
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      } else {
        mediaQuery.addListener(listener);
        return () => mediaQuery.removeListener(listener);
      }
    }
  }, [theme]);

  return (
    <div id="application-shell" className="h-[100dvh] w-full relative bg-[#f8fafc] dark:bg-[#030712] flex flex-col font-sans transition-colors duration-500 overflow-hidden">
      
      {/* Upper Navigation Header */}
      <header id="shell-header" className="sticky top-0 z-40 bg-white/70 dark:bg-[#030712]/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 transition-colors duration-500 select-none shrink-0">
        
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Universal Hamburger Button */}
          <button
            id="workspace-burger-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer focus:outline-none"
            aria-label="Toggle navigation drawer"
            title="Toggle workspace menu"
          >
            {menuOpen ? <X className="w-[18px] h-[18px] text-emerald-600" /> : <Menu className="w-[18px] h-[18px]" />}
          </button>

          <div
            onClick={() => {
              onSelectTool('dashboard');
              setMenuOpen(false);
            }}
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-slate-900 dark:bg-white rounded-xl text-white dark:text-slate-900 group-hover:scale-105 transition-transform shadow-md shrink-0">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white dark:text-slate-900" />
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
              PDF Editor & Reader
            </span>
          </div>
        </div>

          {/* Security & Client-Side indicator & Theme Controller */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* User Auth Controller - Desktop only */}
            <div className="hidden lg:block">
              {loading ? (
                <div className="text-xs text-slate-400">Loading...</div>
              ) : user ? (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end pt-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{profile?.name || user.displayName || 'User'}</span>
                    <button onClick={logOut} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
                      Sign Out
                    </button>
                  </div>
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-9 h-9 rounded-full border-2 border-white dark:border-slate-800 shadow-sm" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-900">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase">
                        {(profile?.name || user.displayName || 'U')[0]}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  onClick={signInWithGoogle}
                  className="px-4 py-2 text-xs font-extrabold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 transition-colors shadow-sm"
                  title="Sign in with Google"
                >
                  Sign In
                </button>
              )}
            </div>

            {/* Theme Selector Tab Widget - Desktop only */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setTheme('light')}
                className={`p-1.5 rounded-lg transition-all focus:outline-none cursor-pointer ${
                  theme === 'light'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-semibold scale-105'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Light style theme"
              >
                <Sun className="w-[14px] h-[14px]" />
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-1.5 rounded-lg transition-all focus:outline-none cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-semibold scale-105'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Dark style theme"
              >
                <Moon className="w-[14px] h-[14px]" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`p-1.5 rounded-lg transition-all focus:outline-none cursor-pointer ${
                  theme === 'system'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-semibold scale-105'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
                title="Sync with OS System theme override"
              >
                <Monitor className="w-[14px] h-[14px]" />
              </button>
            </div>

            {isAIMode ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-xl text-[10px] font-extrabold select-none shadow-md shadow-violet-600/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Cloud AI Active
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-extrabold select-none shadow-md shadow-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                </span>
                Client Execution
              </div>
            )}

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 rounded-full border border-violet-500/20 text-[10px] font-extrabold select-none whitespace-nowrap backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-violet-500 animate-pulse" />
              <span>Credits: {profile?.credits ?? (user ? '...' : 0)}</span>
            </div>
          </div>
      </header>

      {/* Primary body divider: Left Sidebar + Main Content */}
      <div id="shell-body" className="flex-1 flex relative overflow-hidden">
        
        {/* UNIFIED BURGER SLIDING DRAWER MENU (Universal for all viewports) */}
        <aside
          id="shell-sidebar-drawer"
          style={{ height: '100dvh' }}
          className={`shrink-0 border-r border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl fixed top-0 bottom-0 left-0 w-[280px] transform ${
            menuOpen ? 'translate-x-0 shadow-[0_0_80px_rgba(0,0,0,0.15)] dark:shadow-[0_0_80px_rgba(0,0,0,0.5)]' : '-translate-x-full'
          } transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) z-50 flex flex-col justify-between h-screen h-[100dvh] overflow-y-hidden overscroll-contain`}
        >
          <SidebarContent 
            activeTool={activeTool} 
            onSelectTool={onSelectTool} 
            setMenuOpen={setMenuOpen} 
            theme={theme}
            setTheme={setTheme}
            user={user}
            profile={profile}
            loading={loading}
            signInWithGoogle={signInWithGoogle}
            logOut={logOut}
          />
        </aside>

        {/* Background Shade Overlay When Menu Drawer is Toggled Open */}
        {menuOpen && (
          <div
            id="drawer-backdrop-shading"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/20 dark:bg-slate-950/60 backdrop-blur-sm z-40 transition-all duration-500 cursor-pointer animate-in fade-in"
          />
        )}

        {/* Primary View Area */}
        <main id="shell-main" className={`flex-1 max-w-[100vw] ${isAIMode ? 'p-0 overflow-hidden' : 'p-0 overflow-y-auto'}`}>
          {children}
        </main>
      </div>

      {/* Floating touch gesture tool selector for Mobile/Tablet viewports */}
      <div className="md:hidden z-30">
        <FloatingQuickActionBall activeTool={activeTool} onSelectTool={onSelectTool} />
      </div>
    </div>
  );
}
