import React, { useState, useEffect } from 'react';
import { TOOLS } from '../data/tools';
import { ToolId, Tool, RecentFile } from '../types';
import {
  Scissors,
  Image as ImageIcon,
  FileImage,
  PenTool,
  Award as StampIcon, // We can use Award or Shield for Stamp icons
  QrCode,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  HardDriveDownload,
  FlameKindling,
  Clock,
  X,
  FileText,
  Combine,
  Hash,
  FileSearch,
  LockKeyhole,
  Unlock,
  Maximize,
  ShieldBan,
  PaintBucket,
  GitPullRequest,
  FormInput,
  Headphones,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface DashboardProps {
  onSelectTool: (id: ToolId) => void;
  onSelectRecentFile?: (recent: RecentFile) => void;
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

const toolNameMap: Record<ToolId, string> = {
  'dashboard': 'Dashboard',
  'local': 'Local Tools',
  'image-to-pdf': 'Image to PDF',
  'pdf-to-image': 'PDF to Image',
  'remove-pages': 'Remove Pages',
  'sign': 'Sign PDF',
  'watermark': 'Watermark PDF',
  'qr-code': 'Insert QR Code',
  'book-reader': 'Book Reader',
  'merge-pdf': 'Merge PDF',
  'add-page-numbers': 'Add Page Numbers',
  'ocr-pdf': 'OCR PDF (Extract Text)',
  'lock-pdf': 'Lock PDF (Protect)',
  'unlock-pdf': 'Unlock PDF (Decrypt)',
  'scanner': 'Smart Scanner & Crop',
  'redact-pdf': 'Smart Privacy Redactor',
  'purify-metadata': 'Metadata Purifier',
  'compare-pdf': 'Visual PDF "Diff"',
  'form-generator': 'Interactive Form Generator',
  'audiobook-studio': 'Audiobook Studio',
  'summarizer': 'AI PDF Summarizer',
  'flashcards': 'Flashcard Studio',
  'chat-ai': 'Chat with PDF'
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1000; // use standard base10 or base2 metrics
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatTimeAgo = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (secs < 60) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export default function Dashboard({ onSelectTool, onSelectRecentFile }: DashboardProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('pdf_workspace_recent_files');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as RecentFile[];
        setRecentFiles(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleRemoveRecentFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = recentFiles.filter((item) => item.id !== id);
    setRecentFiles(updated);
    localStorage.setItem('pdf_workspace_recent_files', JSON.stringify(updated));
  };

  return (
    <div id="dashboard-root" className="space-y-16 max-w-7xl mx-auto py-8 px-4 sm:px-6 relative">
      
      {/* Background Decorative Ambient Blooms */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-emerald-500/20 to-violet-500/20 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-screen dark:mix-blend-color-dodge"></div>

      {/* Hero Section */}
      <div id="dashboard-hero" className="text-center space-y-6 max-w-3xl mx-auto relative pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 backdrop-blur-md mb-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">New AI Capabilities Available</span>
        </div>
        
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-[-0.04em] text-slate-900 dark:text-white leading-[1.1] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          The Ultimate <br className="hidden sm:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 relative inline-block">
            Document Workspace
            {/* Soft underline glow */}
            <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-30 blur-sm rounded-full"></span>
          </span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
          Process your files locally with zero server uploads, or tap into powerful AI for advanced summarization and flashcard generation.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 max-w-3xl mx-auto animate-in fade-in duration-1000 delay-300">
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 mb-4 shadow-inner border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">100% Private</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Local tools never upload raw files.</p>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 mb-4 shadow-inner border border-amber-500/20">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">Lightning Fast</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Executed instantly via WebAssembly.</p>
          </div>
          <div className="flex flex-col items-center p-6 rounded-2xl bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-white/40 dark:border-slate-800/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:-translate-y-1 transition-transform">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 text-violet-600 dark:text-violet-400 mb-4 shadow-inner border border-violet-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">AI Enhanced</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Extract knowledge intelligently.</p>
          </div>
        </div>
      </div>

      {/* Primary Top Ad Slot Banner (Target for dynamic injection) */}
      <div id="top-ad-slot" className="w-full h-0 invisible opacity-0 bg-transparent overflow-hidden">
        {/* Ad content will be injected here. Container remains collapsed when empty. */}
      </div>

      {/* Grid Section */}
      <div id="dashboard-grid-container" className="space-y-16 max-w-5xl mx-auto">
        
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <Scissors className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Core Utility Suites
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Local Tools Primary Card - Massive Target */}
            <div
              onClick={() => onSelectTool('local' as any)}
              className="group relative rounded-[2rem] p-8 border border-white/40 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_20px_60px_-15px_rgba(16,185,129,0.05)] hover:border-emerald-500/30 dark:hover:border-emerald-500/30 cursor-pointer transition-all duration-500 flex flex-col justify-between overflow-hidden min-h-[300px]"
            >
              {/* Animated background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

              <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform duration-500">
                    <Scissors className="w-6 h-6" />
                  </div>
                  <span className="inline-flex items-center px-3 py-1 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
                    Client-Side Engine
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Local PDF Tools
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    Access over 15+ powerful tools to merge, split, redact, text-extract, and convert files. Runs seamlessly, instantly, and 100% locally in your browser workspace.
                  </p>
                </div>
              </div>
              <div className="relative z-10 pt-8 mt-auto flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                  Access Suite <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>

            {/* Right Side Column (AI Cards + Native Ad) */}
            <div className="flex flex-col gap-6">
              
              {/* AI Summarizer Card */}
              <div
                onClick={() => onSelectTool('summarizer')}
                className="group relative rounded-3xl p-6 border border-white/40 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl hover:shadow-[0_15px_40px_-10px_rgba(139,92,246,0.15)] hover:border-violet-500/30 dark:hover:border-violet-500/30 cursor-pointer transition-all duration-500 flex flex-col flex-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/25 group-hover:scale-105 transition-transform duration-500 shrink-0">
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">PDF Summarizer</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">Extract core insights and intelligent summaries using advanced generative AI.</p>
                  </div>
                </div>
              </div>

              {/* AI Flashcards Card */}
              <div
                onClick={() => onSelectTool('flashcards')}
                className="group relative rounded-3xl p-6 border border-white/40 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/50 backdrop-blur-xl hover:shadow-[0_15px_40px_-10px_rgba(99,102,241,0.15)] hover:border-indigo-500/30 dark:hover:border-indigo-500/30 cursor-pointer transition-all duration-500 flex flex-col flex-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-3xl"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-500 shrink-0">
                    <BookOpen className="w-5 h-5 flex-shrink-0" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Flashcard Studio</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">Transform textbooks or manuals into highly effective interactive study decks.</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Native In-Feed Box Ad (Target for dynamic injection) */}
        <div id="in-feed-ad-slot" className="w-full h-0 invisible opacity-0 bg-transparent overflow-hidden">
          {/* Ad content will be injected here. Container remains collapsed when empty. */}
        </div>

        {/* Recent Files Queue - Re-styled */}
        {recentFiles.length > 0 && (
          <div id="recent-files-subgrid" className="space-y-6 pt-4 animate-in fade-in duration-1000 delay-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/50 dark:border-slate-800/50">
               <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Recent Sessions</h2>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('pdf_workspace_recent_files');
                  setRecentFiles([]);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-semibold"
              >
                Clear History
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentFiles.map((file) => {
                const targetTool = TOOLS.find((t) => t.id === file.toolId);
                const IconComponent = targetTool ? (iconMap[targetTool.icon] || FileText) : FileText;
                
                return (
                  <div
                    key={file.id}
                    id={`recent-card-${file.id}`}
                    onClick={() => onSelectRecentFile?.(file)}
                    className="group relative flex items-center justify-between p-4 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-2xl hover:shadow-lg hover:border-emerald-500/40 dark:hover:border-emerald-500/40 cursor-pointer transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-transparent dark:from-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>

                    <div className="flex items-center gap-4 overflow-hidden min-w-0 pr-6 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:scale-105 group-hover:text-emerald-500 transition-all duration-300 shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden space-y-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold font-sans tracking-wide uppercase">
                            {toolNameMap[file.toolId] || file.toolId}
                          </span>
                          <span>•</span>
                          <span>{formatSize(file.size)}</span>
                          {file.pageCount !== undefined && file.pageCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{file.pageCount} pg</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatTimeAgo(file.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleRemoveRecentFile(e, file.id)}
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20"
                      title="Remove from history"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

