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
  Sparkles
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
  'summarizer': 'PDF Summarizer',
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

export default function LocalTools({ onSelectTool, onSelectRecentFile }: DashboardProps) {
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
    <div id="local-root" className="space-y-12 max-w-6xl mx-auto py-4">
      {/* Hero Section */}
      <div id="local-hero" className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
          Modern Client-Side <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
            PDF Workspace
          </span>
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg">
          Process your files entirely in the browser. Zero servers, absolute file privacy, and lightning-fast execution.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-4 pt-6 max-w-lg mx-auto">
          <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mb-1" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">100% Private</span>
            <span className="text-[10px] text-slate-500">No raw file uploads</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <Zap className="w-5 h-5 text-amber-500 mb-1" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Instant Run</span>
            <span className="text-[10px] text-slate-500">Locally executed</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <HardDriveDownload className="w-5 h-5 text-blue-500 mb-1" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Unlimited</span>
            <span className="text-[10px] text-slate-500">No subscription caps</span>
          </div>
        </div>
      </div>

      {/* Grid Section */}
      <div id="local-grid-container" className="space-y-12">
        {/* Recent Files Queue */}
        {recentFiles.length > 0 && (
          <div id="recent-files-subgrid" className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" /> Recent Documents
              </h2>
              <button
                onClick={() => {
                  localStorage.removeItem('pdf_workspace_recent_files');
                  setRecentFiles([]);
                }}
                className="text-xs text-slate-500 hover:text-rose-600 font-medium transition-colors"
              >
                Clear History
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentFiles.map((file) => {
                const targetTool = TOOLS.find((t) => t.id === file.toolId);
                const IconComponent = targetTool ? (iconMap[targetTool.icon] || FileText) : FileText;
                
                return (
                  <div
                    key={file.id}
                    id={`recent-card-${file.id}`}
                    onClick={() => onSelectRecentFile?.(file)}
                    className="group relative flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:shadow hover:border-emerald-500/40 dark:hover:border-emerald-500/40 cursor-pointer transition-all duration-200"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-6">
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-300">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5 whitespace-nowrap">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium font-sans">
                            {toolNameMap[file.toolId] || file.toolId}
                          </span>
                          <span>•</span>
                          <span>{formatSize(file.size)}</span>
                          {file.pageCount !== undefined && file.pageCount > 0 && (
                            <>
                              <span>•</span>
                              <span>{file.pageCount} {file.pageCount === 1 ? 'pg' : 'pgs'}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatTimeAgo(file.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleRemoveRecentFile(e, file.id)}
                      className="absolute top-1/2 -translate-y-1/2 right-3 p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-50 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
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

        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
            Client-Side Local Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TOOLS.filter(t => t.category !== 'ai').map((tool) => {
              const IconComponent = iconMap[tool.icon] || Scissors;
              return (
                <div
                  key={tool.id}
                  id={`tool-card-${tool.id}`}
                  onClick={() => tool.isReady && onSelectTool(tool.id)}
                  className={`group relative rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between ${
                    tool.isReady
                      ? 'border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-lg hover:border-emerald-500/30 dark:hover:border-emerald-500/30 dark:hover:bg-slate-850 cursor-pointer shadow-sm'
                      : 'border-slate-150 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-xl transition-all duration-300 ${
                        tool.isReady
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700'
                          : 'bg-slate-100 dark:bg-slate-850 text-slate-400'
                      }`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      
                      {tool.isReady ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300">
                          Ready & Stable
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400">
                          Phase 2
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-auto">
                    {tool.isReady ? (
                      <div className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                        Launch Tool <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-slate-400 dark:text-slate-600">
                        Scheduled for Next Phase
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
