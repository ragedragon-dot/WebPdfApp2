import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { useFileContext } from '../../hooks/useFileContext';
import { useAuth } from '../../hooks/useAuth';
import { 
  Sparkles, 
  FileText, 
  AlertCircle, 
  Loader2, 
  PlayCircle, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle, 
  CheckCircle2, 
  RotateCw,
  Award,
  BookOpen,
  Trash2,
  Combine,
  ExternalLink
} from 'lucide-react';
import { extractTextFromPDF, calculateAICost } from '../../utils/pdfExtractor';
import PDFCanvasViewer from '../../components/PDFCanvasViewer';

interface Flashcard {
  question: string;
  answer: string;
  status?: 'unstudied' | 'review' | 'mastered';
}

export default function FlashcardTool() {
  const { flashcardsFile, setFlashcardsFile } = useFileContext();
  const { deductCredits, addCredits, profile } = useAuth();

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [pendingCostDetails, setPendingCostDetails] = useState<{ wordCount: number; cost: number; extractedText: string } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Split panel drag-resizing state
  const [leftWidth, setLeftWidth] = useState<number>(45); // 45/55 starting split percentage
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  const handleDeleteChat = () => {
    if (flashcardsFile) {
      sessionStorage.removeItem(`flashcards_${flashcardsFile.name}`);
    }
    setFlashcardsFile(null);
    setFlashcards([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setError(null);
    setShowDeleteConfirm(false);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = (relativeX / rect.width) * 100;
      
      const clamped = Math.max(30, Math.min(70, percentage));
      setLeftWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Load from sessionStorage when file changes
  useEffect(() => {
    if (flashcardsFile) {
      const url = URL.createObjectURL(flashcardsFile);
      setPdfUrl(url);

      const cached = sessionStorage.getItem(`flashcards_${flashcardsFile.name}`);
      if (cached) {
        try {
          setFlashcards(JSON.parse(cached));
          setCurrentIndex(0);
          setIsFlipped(false);
          setError(null);
        } catch {
          setFlashcards([]);
        }
      } else {
        setFlashcards([]);
      }

      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl(null);
      };
    } else {
      setPdfUrl(null);
      setFlashcards([]);
      setError(null);
    }
  }, [flashcardsFile]);

  const handleWatchAd = async () => {
    setIsAdPlaying(true);
    setError(null);
    setTimeout(async () => {
      await addCredits(5);
      setIsAdPlaying(false);
    }, 3000);
  };

  const handlePrepareGeneration = async () => {
    if (!flashcardsFile) return;

    setIsGenerating(true);
    setError(null);

    try {
      const extractedText = await extractTextFromPDF(flashcardsFile);
      const { wordCount, cost } = calculateAICost(extractedText);
      const finalCost = Math.max(2, Math.min(10, cost));
      
      const currentBalance = profile?.credits || 0;
      if (currentBalance < finalCost) {
        setError(`Insufficient credits. You need ${finalCost} but have ${currentBalance}.`);
        setIsGenerating(false);
        return;
      }

      const response = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate study flashcards.');
      }

      const data = await response.json();

      const success = await deductCredits(finalCost);
      if (!success) {
        throw new Error("Failed to sync credit deduction with the database.");
      }

      const cards: Flashcard[] = data.flashcards.map((c: any) => ({
        question: c.question,
        answer: c.answer,
        status: 'unstudied'
      }));

      setFlashcards(cards);
      setCurrentIndex(0);
      setIsFlipped(false);
      sessionStorage.setItem(`flashcards_${flashcardsFile.name}`, JSON.stringify(cards));

    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred during flashcard generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFlashcardsFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFlashcardsFile(e.target.files[0]);
    }
  };

  const handleNext = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrev = () => {
    if (flashcards.length === 0) return;
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const handleUpdateStatus = (status: 'review' | 'mastered') => {
    const updated = [...flashcards];
    updated[currentIndex] = {
      ...updated[currentIndex],
      status: updated[currentIndex].status === status ? 'unstudied' : status
    };
    setFlashcards(updated);
    if (flashcardsFile) {
      sessionStorage.setItem(`flashcards_${flashcardsFile.name}`, JSON.stringify(updated));
    }
  };

  const masteredCount = flashcards.filter(c => c.status === 'mastered').length;
  const reviewCount = flashcards.filter(c => c.status === 'review').length;
  const progressPercent = flashcards.length > 0 ? Math.round(((masteredCount) / flashcards.length) * 100) : 0;

  return (
    <div 
      ref={containerRef}
      className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full antialiased overflow-hidden bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] dark:from-[#030712] dark:to-[#0f172a] relative"
    >
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-screen"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-screen"></div>

      {/* LEFT PANEL: PDF Viewer */}
      <div 
        style={{ 
          width: isMobile ? '100%' : `${leftWidth}%`,
          height: isMobile ? 'auto' : '100%',
          pointerEvents: isResizing ? 'none' : 'auto'
        }}
        className="border-b md:border-b-0 md:border-r border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-[#030712]/40 backdrop-blur-xl overflow-hidden relative flex flex-col shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      >
        {isMobile ? (
          /* Mobile view: No PDFCanvasViewer at all, only functional PDF management */
          <div className="w-full flex flex-col p-4">
            {!flashcardsFile ? (
              <div className="flex flex-row items-center gap-4 w-full justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800/50 p-4 rounded-2xl shadow-xl shadow-indigo-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50 shadow-inner">
                    <FileText className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Upload PDF</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Select a file to begin</p>
                  </div>
                </div>
                <label 
                  htmlFor="file-upload-mobile"
                  className="cursor-pointer px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-[0_4px_14px_rgba(79,70,229,0.3)] transition-all active:scale-95 whitespace-nowrap"
                >
                  Select File
                </label>
                <input 
                  type="file" 
                  id="file-upload-mobile" 
                  className="hidden" 
                  accept="application/pdf" 
                  onChange={handleFileSelect} 
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-row items-center gap-4 w-full justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-white/20 dark:border-slate-800/50 p-4 rounded-2xl shadow-xl shadow-emerald-500/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50 shrink-0">
                      <FileText className="w-5 h-5 text-emerald-500 animate-pulse" />
                    </div>
                    <div className="text-left min-w-0 pr-2">
                      <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate w-full" title={flashcardsFile.name}>
                        {flashcardsFile.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Active Document</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs transition-all active:scale-95 border border-rose-100 dark:border-rose-500/20 shrink-0 shadow-sm"
                    title="Remove Document"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Desktop view: Standard layout showing PDF renderer or large drag-and-drop area */
          <div className="flex-1 flex flex-col h-full relative">
            {!flashcardsFile ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 z-10">
                <div 
                  className={`relative w-full max-w-xl mx-auto rounded-[2.5rem] p-10 md:p-16 flex flex-col items-center justify-center text-center transition-all duration-500 border-2 border-dashed ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 scale-[1.02]' 
                      : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={handleFileDrop}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/10 dark:from-white/5 dark:to-transparent rounded-[2.5rem] pointer-events-none"></div>

                  <div className="w-24 h-24 mb-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgba(79,70,229,0.3)] relative z-10">
                    <FileText className="w-12 h-12 text-white" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight relative z-10">Upload Syllabus or Text</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-10 text-base leading-relaxed relative z-10">
                    Drop your document here, and our generative AI will instantly build a comprehensive study deck.
                  </p>
                  
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    accept="application/pdf" 
                    onChange={handleFileSelect} 
                  />
                  <label 
                    htmlFor="file-upload"
                    className="cursor-pointer px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-extrabold text-base shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 relative z-10"
                  >
                    Select Local File
                  </label>
                </div>
              </div>
            ) : flashcardsFile && pdfUrl ? (
              <PDFCanvasViewer url={pdfUrl} />
            ) : null}
          </div>
        )}
      </div>

      {/* Elegant Resizer Strip */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className={`hidden md:flex flex-col items-center justify-center w-1.5 hover:w-2 bg-slate-200/50 dark:bg-slate-800/50 hover:bg-indigo-500 dark:hover:bg-indigo-500 cursor-col-resize h-full transition-all duration-300 relative z-20 shrink-0 ${
          isResizing ? '!bg-indigo-600 !w-2 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : ''
        }`}
      >
        <div className="flex flex-col justify-center gap-1.5 pointer-events-none">
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
        </div>
      </div>

      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-col-resize" style={{ pointerEvents: 'auto' }} />
      )}

      {/* RIGHT PANEL: AI Study Companion Workspace */}
      <div 
        style={{ 
          width: isMobile ? '100%' : `${100 - leftWidth}%`,
          height: isMobile ? 'auto' : '100%'
        }}
        className={`flex flex-col overflow-hidden relative shrink-0 ${
          isMobile ? 'flex-1' : ''
        }`}
      >
        {/* Header bar */}
        <div className="h-16 px-6 lg:px-8 border-b border-white/20 dark:border-slate-800/50 flex items-center justify-between bg-white/40 dark:bg-slate-900/40 backdrop-blur-md shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <Sparkles className="w-4 h-4 text-indigo-500" />
            </div>
            <h3 className="font-extrabold text-slate-900 dark:text-white tracking-tight text-lg">Knowledge Engine</h3>
          </div>
          {flashcardsFile && (
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 px-4 py-1.5 rounded-full truncate max-w-[200px] shadow-sm backdrop-blur-sm" title={flashcardsFile.name}>
                {flashcardsFile.name}
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Discard study session"
                className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Action/Progress panel */}
        {flashcards.length > 0 && (
          <div className="px-6 lg:px-8 py-5 border-b border-white/20 dark:border-slate-800/50 bg-white/20 dark:bg-[#030712]/30 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 relative z-10">
            <div className="flex-1 w-full max-w-md">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">
                <span>Mastery Progress</span>
                <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out rounded-full relative" 
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 font-mono font-medium">
                <span>Total: {flashcards.length} cards</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Mastered: {masteredCount}</span>
                <span className="text-amber-500 dark:text-amber-400 font-bold">Review: {reviewCount}</span>
              </div>
            </div>
            {flashcardsFile && (
              <button 
                onClick={handlePrepareGeneration}
                disabled={isGenerating || isAdPlaying}
                className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:shadow-md text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-all text-xs cursor-pointer active:scale-95 shrink-0"
              >
                <RotateCw className="w-4 h-4 text-indigo-500" />
                Resynthesize
              </button>
            )}
          </div>
        )}

        {/* Body content workspace */}
        <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8 lg:px-12 custom-scrollbar flex flex-col relative z-0">
          <div className="w-full flex-1 flex flex-col">
            {error && (
              <div className="mb-8 p-6 rounded-2xl bg-red-50/80 dark:bg-red-950/40 backdrop-blur-md flex flex-col items-start gap-4 border border-red-200/50 dark:border-red-900/50 shadow-lg shadow-red-500/5">
                <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-6 h-6 shrink-0" />
                  <p className="text-sm font-bold leading-relaxed">{error}</p>
                </div>
                {error.includes("Insufficient credits") && (
                  <button 
                    onClick={handleWatchAd}
                    disabled={isAdPlaying}
                    className="mt-2 w-full sm:w-auto text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-500/25 px-5 py-2.5 rounded-xl font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isAdPlaying ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                    {isAdPlaying ? "Ad Playing..." : "Watch Sponsor Ad (+5 Credits)"}
                  </button>
                )}
              </div>
            )}

            {isAdPlaying && !error && (
              <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                 <div className="w-20 h-20 bg-white/50 dark:bg-slate-800/50 rounded-[2rem] flex items-center justify-center backdrop-blur-md shadow-2xl border border-white/50 dark:border-slate-700 mb-8 relative">
                   <div className="absolute inset-0 rounded-[2rem] border-2 border-indigo-500/30 animate-ping"></div>
                   <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                 </div>
                 <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-2">Connecting to Sponsor</h2>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">Sit back. Your free credits will be injected momentarily.</p>
              </div>
            )}

            {/* Flashcard Render Workspace */}
            {flashcards.length === 0 && !isGenerating && !isAdPlaying ? (
              <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center py-16 flex-1">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-900 rounded-[2rem] flex items-center justify-center mb-8 border border-white dark:border-slate-800 shadow-2xl shadow-indigo-500/10">
                  <BookOpen className="w-10 h-10 text-indigo-500 mix-blend-multiply dark:mix-blend-lighten" />
                </div>
                <h4 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                  {flashcardsFile ? "Ready to Synthesize" : "Awaiting Document"}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed mb-10 max-w-sm">
                  {flashcardsFile 
                    ? "Our advanced LLM will trace the document architecture and isolate the 8 most critical vectors into interactive flashcards." 
                    : "Upload a PDF in the left suite. The AI engine will parse its contents natively."
                  }
                </p>
                {flashcardsFile && (
                  <button 
                    onClick={handlePrepareGeneration}
                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-extrabold text-base shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.2)] transition-all hover:-translate-y-1 active:scale-95"
                  >
                    <Sparkles className="w-5 h-5 flex-shrink-0 text-indigo-400 dark:text-indigo-600" />
                    Commence Synthesis
                  </button>
                )}
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center justify-center py-20 text-center flex-1">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center animate-pulse">
                    <Loader2 className="w-10 h-10 text-violet-600 animate-spin" />
                  </div>
                  {/* orbiting element simulation */}
                  <div className="absolute inset-0 border-4 border-dashed border-violet-500/30 rounded-full animate-[spin_4s_linear_infinite]"></div>
                </div>
                <h4 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">Extracting Knowledge Vectors</h4>
                <p className="text-slate-500 dark:text-slate-400 relative">Scanning semantics and structuring Q/A boundaries.</p>
              </div>
            ) : flashcards.length > 0 ? (
              <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center">
                {/* Premium Visual Card Stage */}
                <div 
                  onClick={() => setIsFlipped(!isFlipped)}
                  style={{ perspective: "1500px" }}
                  className="w-full h-full min-h-[400px] mb-8 relative group"
                >
                  <div 
                    className={`w-full h-full relative transition-all duration-700 rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] cursor-pointer focus:outline-none select-none flex justify-center`}
                    style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    {/* Front Face (Question) */}
                    <div className="absolute inset-0 w-full h-full backface-hidden rounded-[2.5rem] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 flex flex-col overflow-hidden" 
                         style={{ backfaceVisibility: 'hidden' }}>
                      <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-bold tracking-widest uppercase font-sans text-indigo-500 dark:text-indigo-400 bg-white/50 dark:bg-slate-900/50">
                        <span className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" /> The Inquiry
                        </span>
                        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          {currentIndex + 1} / {flashcards.length}
                        </span>
                      </div>
                      <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center overflow-y-auto text-slate-800 dark:text-slate-100 text-lg sm:text-xl font-medium leading-relaxed custom-scrollbar">
                        <MarkdownRenderer content={flashcards[currentIndex].question} />
                      </div>
                      <div className="py-4 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity bg-slate-50/50 dark:bg-[#030712]/50 border-t border-slate-100 dark:border-slate-800/80">
                        Tap to reveal
                      </div>
                    </div>

                    {/* Back Face (Answer) */}
                    <div className="absolute inset-0 w-full h-full backface-hidden rounded-[2.5rem] bg-amber-50/90 dark:bg-[#1e1b12]/90 backdrop-blur-xl border border-amber-200/60 dark:border-amber-900/40 flex flex-col overflow-hidden"
                         style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <div className="px-8 py-5 border-b border-amber-200/40 dark:border-amber-900/40 flex items-center justify-between text-xs font-bold tracking-widest uppercase font-sans text-amber-600 dark:text-amber-500 bg-white/50 dark:bg-black/20">
                        <span className="flex items-center gap-2">
                          <Award className="w-4 h-4" /> The Resolution
                        </span>
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-800/50">
                          Solution Key
                        </span>
                      </div>
                      <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center overflow-y-auto text-slate-900 dark:text-slate-100 text-base sm:text-lg leading-relaxed custom-scrollbar prose dark:prose-invert max-w-none">
                        <MarkdownRenderer content={flashcards[currentIndex].answer} />
                      </div>
                      <div className="py-4 text-center text-xs font-bold text-amber-600/60 dark:text-amber-500/60 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity bg-white/30 dark:bg-black/30 border-t border-amber-200/40 dark:border-amber-900/40">
                        Tap to flip back
                      </div>
                    </div>
                  </div>
                </div>

                {/* Question grading actions */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 mt-auto">
                  <button
                    onClick={() => handleUpdateStatus('review')}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-extrabold transition-all border-2 shadow-sm ${
                      flashcards[currentIndex].status === 'review'
                        ? 'bg-amber-100 border-amber-400 text-amber-700 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300 scale-105'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 backdrop-blur-sm'
                    }`}
                  >
                    Flag for Review
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('mastered')}
                    className={`flex items-center justify-center gap-2 px-6 py-4 rounded-2xl text-sm font-extrabold transition-all border-2 shadow-sm ${
                      flashcards[currentIndex].status === 'mastered'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300 scale-105'
                        : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 backdrop-blur-sm'
                    }`}
                  >
                    <CheckCircle2 className={`w-5 h-5 ${flashcards[currentIndex].status === 'mastered' ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-70'}`} />
                    Mark Mastered
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Workspace Ad Slot (Target for dynamic injection) */}
          <div id="workspace-ad-slot" className="w-full h-0 invisible opacity-0 bg-transparent overflow-hidden">
            {/* Ad content will be injected here. Container remains collapsed when empty. */}
          </div>

          {/* Bottom Card Navigation */}
          {flashcards.length > 0 && (
            <div className="flex items-center justify-between pt-8 mt-8 shrink-0 border-t border-slate-200/50 dark:border-slate-800/50">
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-5 py-3 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-[1rem] text-sm font-extrabold transition-all select-none active:scale-95 shadow-sm border border-slate-200/60 dark:border-slate-700"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous
              </button>
              
              <div className="hidden sm:flex items-center gap-2">
                {flashcards.map((card, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsFlipped(false);
                      setCurrentIndex(idx);
                    }}
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      idx === currentIndex
                        ? 'w-8 bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]'
                        : card.status === 'mastered'
                        ? 'w-3 bg-emerald-500'
                        : card.status === 'review'
                        ? 'w-3 bg-amber-500'
                        : 'w-3 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                    title={`Go to Card ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-5 py-3 bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-[1rem] text-sm font-extrabold transition-all select-none active:scale-95 shadow-sm border border-slate-200/60 dark:border-slate-700"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-[#030712]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-slate-700/50 rounded-[2rem] max-w-sm w-full shadow-2xl shadow-rose-500/10 p-8 transform transition-all duration-300">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
                <Trash2 className="w-8 h-8 text-white" />
              </div>
              
              <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">
                Discard Session?
              </h3>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                This will permanently delete the AI flashcards history and remove the uploaded document from memory.
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Keep Working
                </button>
                <button
                  type="button"
                  onClick={handleDeleteChat}
                  className="flex-1 px-4 py-3 bg-rose-600 text-white hover:bg-rose-700 font-bold text-sm rounded-xl shadow-lg transition-colors cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
