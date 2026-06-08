import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { useFileContext } from '../../hooks/useFileContext';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles, FileText, AlertCircle, Loader2, PlayCircle, Trash2 } from 'lucide-react';
import { extractTextFromPDF, calculateAICost } from '../../utils/pdfExtractor';
import PDFCanvasViewer from '../../components/PDFCanvasViewer';

export default function SummarizerTool() {
  const { summarizerFile, setSummarizerFile } = useFileContext();
  const { deductCredits, addCredits, profile } = useAuth();
  
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingCostDetails, setPendingCostDetails] = useState<{ wordCount: number; cost: number; extractedText: string; mode: 'comprehensive' | 'brief' } | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [summaryMode, setSummaryMode] = useState<'comprehensive' | 'brief'>('comprehensive');

  // Split panel drag-resizing state
  const [leftWidth, setLeftWidth] = useState<number>(50); // 50/50 starting split percentage
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
    if (summarizerFile) {
      sessionStorage.removeItem(`summary_${summarizerFile.name}`);
    }
    setSummarizerFile(null);
    setSummary(null);
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
      
      // Constraints: Left panel in [40%, 70%]
      // Since Right panel width = 100 - Left Panel Width,
      // Left panel max of 70% keeps Right panel min 30%
      // Left panel min of 40% keeps Right panel max 60%
      const clamped = Math.max(40, Math.min(70, percentage));
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

  // Load from sessionStorage and generate Data URI when file changes
  useEffect(() => {
    if (summarizerFile) {
      const url = URL.createObjectURL(summarizerFile);
      setPdfUrl(url);

      const cached = sessionStorage.getItem(`summary_${summarizerFile.name}`);
      if (cached) {
        setSummary(cached);
        setError(null);
      } else {
        setSummary(null);
      }

      return () => {
        URL.revokeObjectURL(url);
        setPdfUrl(null);
      };
    } else {
      setPdfUrl(null);
      setSummary(null);
      setError(null);
    }
  }, [summarizerFile]);

  const handleWatchAd = async () => {
    setIsAdPlaying(true);
    setError(null);
    setTimeout(async () => {
      await addCredits(5);
      setIsAdPlaying(false);
    }, 3000);
  };

  const handleSummarize = async (mode: 'comprehensive' | 'brief' = 'comprehensive') => {
    if (!summarizerFile) return;
    
    setIsSummarizing(true);
    setError(null);

    try {
      // 1. Extract and Calculate
      const extractedText = await extractTextFromPDF(summarizerFile);
      const { wordCount, cost } = calculateAICost(extractedText);
      
      const currentBalance = profile?.credits || 0;
      if (currentBalance < cost) {
        setError(`Insufficient credits. You need ${cost} but have ${currentBalance}.`);
        setIsSummarizing(false);
        return;
      }

      // 3. Make the AI API Call
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText, mode })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to summarize document.');
      }

      const data = await response.json();

      // 4. DEDUCT CREDITS ONLY AFTER SUCCESS
      const success = await deductCredits(cost);
      if (!success) {
        throw new Error("Failed to sync credit deduction with the database.");
      }
      
      const newSummary = `### Summary for ${summarizerFile.name}\n\n${data.summary}`;
      
      setSummary(newSummary);
      sessionStorage.setItem(`summary_${summarizerFile.name}`, newSummary);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred during summarization.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSummarizerFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSummarizerFile(e.target.files[0]);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col md:flex-row h-[calc(100vh-64px)] w-full antialiased overflow-hidden bg-slate-50 dark:bg-slate-900 relative"
    >
      {/* LEFT PANEL: Native PDF scrolling reader inside iframe */}
      <div 
        style={{ 
          width: isMobile ? '100%' : `${leftWidth}%`,
          height: isMobile ? 'auto' : '100%',
          pointerEvents: isResizing ? 'none' : 'auto'
        }}
        className="border-b md:border-b-0 border-r-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 overflow-hidden relative flex flex-col shrink-0"
      >
        {isMobile ? (
          /* Mobile view: No PDFCanvasViewer at all, only functional PDF management */
          <div className="w-full flex flex-col">
            {!summarizerFile ? (
              <div className="flex flex-col items-center justify-center p-4 text-center w-full bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-row items-center gap-3 w-full max-w-md justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 p-3 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Upload PDF</h4>
                      <p className="text-[10px] text-slate-505 dark:text-slate-400">Select a file to begin</p>
                    </div>
                  </div>
                  <label 
                    htmlFor="file-upload-mobile"
                    className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/15 transition-all active:scale-95 whitespace-nowrap"
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
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center w-full bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-row items-center gap-3 w-full max-w-md justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-left min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[200px]" title={summarizerFile.name}>
                        {summarizerFile.name}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Active Document</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/35 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs transition-all active:scale-95 border border-rose-100 dark:border-rose-900/40 shrink-0 whitespace-nowrap"
                  >
                    Delete Current PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Desktop view: Standard layout showing PDF renderer or large drag-and-drop area */
          <>
            {!summarizerFile ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center h-full w-full bg-slate-50 dark:bg-slate-950">
                <div 
                  className={`border-2 border-dashed rounded-3xl p-8 md:p-12 max-w-lg w-full flex flex-col items-center justify-center transition-all ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={handleFileDrop}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white dark:bg-slate-800 shadow-sm rounded-2xl flex items-center justify-center mb-6">
                    <FileText className="w-8 h-8 md:w-10 md:h-10 text-indigo-500" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Upload a Document</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs mb-8 leading-relaxed text-sm md:text-base">
                    Drag and drop your PDF here, or click to upload.
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
                    className="cursor-pointer px-6 md:px-8 py-3 md:py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
                  >
                    Select File
                  </label>
                </div>
              </div>
            ) : summarizerFile && pdfUrl ? (
              <PDFCanvasViewer url={pdfUrl} />
            ) : null}
          </>
        )}
      </div>

      {/* Draggable Vertical Split Resizer Handler */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className={`hidden md:block w-1 bg-slate-200 dark:bg-slate-800 hover:bg-indigo-500 dark:hover:bg-indigo-400 cursor-col-resize h-full transition-colors relative z-20 shrink-0 ${
          isResizing ? '!bg-indigo-600 w-1.5' : ''
        }`}
      >
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col justify-center gap-1.5 pointer-events-none opacity-40">
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
          <div className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full" />
        </div>
      </div>

      {/* Invisible overlay over everything while resizing to prevent iframes/canvases from capturing cursor events */}
      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-col-resize" style={{ pointerEvents: 'auto' }} />
      )}

      {/* RIGHT PANEL: Scrollable AI Output */}
      <div 
        style={{ 
          width: isMobile ? '100%' : `${100 - leftWidth}%`,
          height: isMobile ? 'auto' : '100%'
        }}
        className={`bg-white dark:bg-slate-950 flex flex-col overflow-hidden relative shrink-0 ${
          isMobile ? 'flex-1' : ''
        }`}
      >
        {/* Header bar */}
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between px-6 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex flex-row items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight">AI Summarizer Workspace</h3>
          </div>
          {summarizerFile && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete summary chat and document"
                className="p-1 px-1.5 hover:bg-rose-50 dark:hover:bg-red-950/30 text-rose-600 dark:text-rose-400 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-transparent hover:border-red-150 dark:hover:border-red-900/25 hover:scale-105 active:scale-95"
              >
                <Trash2 className="w-4 h-4 text-red-500 animate-pulse" />
              </button>
              <div className="text-xs font-semibold text-slate-500 bg-slate-200 dark:bg-slate-800 px-3 py-1 rounded-full truncate max-w-[120px] md:max-w-[200px]" title={summarizerFile.name}>
                {summarizerFile.name}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content Workspace */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar bg-white dark:bg-slate-950">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 flex flex-col items-start gap-3 border border-red-200 dark:border-red-800/50">
              <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              {error.includes("Insufficient credits") && (
                <button 
                  onClick={handleWatchAd}
                  disabled={isAdPlaying}
                  className="mt-2 text-xs flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {isAdPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  {isAdPlaying ? "Watching Ad..." : "Watch Ad to earn +5 Credits"}
                </button>
              )}
            </div>
          )}

          {isAdPlaying && !error && (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
               <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
               <p className="text-slate-500 dark:text-slate-400 font-medium pb-2">Playing video ad...</p>
               <p className="text-xs text-slate-400 dark:text-slate-500">Your free credits will load in a brief moment.</p>
            </div>
          )}

          {!summary && !isSummarizing && !isAdPlaying ? (
            <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center py-10">
              <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-800/50 shadow-inner">
                <Sparkles className="w-8 h-8 text-indigo-500 animate-pulse" />
              </div>
              <h4 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                {summarizerFile ? "Ready to Summarize" : "Waiting for Document"}
              </h4>
              <p className="text-slate-505 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                {summarizerFile 
                  ? "Extract key methodologies, structural segments, and logical outlines instantly using our optimized AI models." 
                  : "Upload or drag a document in the left panel to trigger the AI-driven summarizer workspace."
                }
              </p>
              {summarizerFile && (
                <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                  {/* Option selector */}
                  <div className="flex w-full p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/60 select-none">
                    <button
                      type="button"
                      onClick={() => setSummaryMode('comprehensive')}
                      className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        summaryMode === 'comprehensive'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Comprehensive
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryMode('brief')}
                      className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        summaryMode === 'brief'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Brief (150-200 words)
                    </button>
                  </div>

                  {/* Action button */}
                  <button 
                    onClick={() => handleSummarize(summaryMode)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-md shadow-indigo-600/20 hover:scale-[1.01]"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </button>
                </div>
              )}
            </div>
          ) : isSummarizing ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-10">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-6" />
              <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Analyzing Document...</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400">Traversing text indexes and extracting structure context</p>
            </div>
          ) : (
            <div className="text-slate-800 dark:text-slate-200 leading-relaxed pb-8 flex flex-col gap-5">
              {/* Internal Option selector & Regeneration panel */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/35 rounded-xl border border-slate-150 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mode:</span>
                  <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700/80 select-none">
                    <button
                      type="button"
                      onClick={() => setSummaryMode('comprehensive')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        summaryMode === 'comprehensive'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Comprehensive
                    </button>
                    <button
                      type="button"
                      onClick={() => setSummaryMode('brief')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        summaryMode === 'brief'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      }`}
                    >
                      Brief
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => handleSummarize(summaryMode)}
                  disabled={isSummarizing || isAdPlaying}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all text-xs cursor-pointer ${
                    isSummarizing || isAdPlaying
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-755"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/15 hover:scale-[1.01] active:scale-[0.99]"
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Regenerate
                </button>
              </div>

              {/* Formatted Markdown HTML Rendering Area */}
              <div>
                <MarkdownRenderer content={summary || ''} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full shadow-2xl p-6 transform transition-all duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-50 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-4 border border-red-100 dark:border-red-800/50">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                Do you want to delete this chat ?
              </h3>
              
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                This will permanently delete the AI summary chat history and remove the uploaded document.
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteChat}
                  className="flex-1 px-4 py-2.5 bg-red-650 text-white font-semibold text-sm rounded-xl shadow-md shadow-red-600/25 transition-colors cursor-pointer bg-red-600 hover:bg-red-700 font-bold"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
