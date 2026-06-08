import React, { useState, useEffect, useRef } from 'react';
import { ShieldBan, ArrowLeft, Loader2, Save, X, Settings2, Trash2, Paintbrush, Square, Check, CheckCircle2, Circle, Type, Eye, EyeOff, Mail, Phone, User } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import { ConfirmModal } from '../../components/ConfirmModal';

interface UIRect {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface PDFRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function translateCoordinates(uiBox: UIRect, pdfWidth: number, pdfHeight: number): PDFRect {
  const scaleX = pdfWidth / uiBox.canvasWidth;
  const scaleY = pdfHeight / uiBox.canvasHeight;
  
  return {
    x: uiBox.x * scaleX,
    y: pdfHeight - ((uiBox.y + uiBox.height) * scaleY),
    width: uiBox.width * scaleX,
    height: uiBox.height * scaleY
  };
}

interface RedactRect {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    canvasWidth?: number;
    canvasHeight?: number;
    type: 'box' | 'blur';
    isAuto?: boolean;
    autoType?: string;
    accepted?: boolean;
}

export default function SmartPrivacyRedactorTool({ onBackToDashboard, initialFile, onFileLoaded }: any) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  
  const [scale, setScale] = useState(1.5);
  const [rects, setRects] = useState<RedactRect[]>([]);
  
  // New UI states
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [manualTool, setManualTool] = useState<'box' | 'blur'>('box');
  const [autoFilters, setAutoFilters] = useState<string[]>(['emails']);
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRect, setCurrentRect] = useState<Partial<RedactRect> | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  const handleClearDocument = () => {
    setShowConfirmClear(true);
  };

  const confirmClearDocument = () => {
    setFile(null);
    setPdfDoc(null);
    setRects([]);
    setCurrentPage(1);
    setNumPages(0);
  };

  const initDoc = async (f: File) => {
    if (!f) return;
    setLoading(true);
    try {
      const arrayBuffer = await f.arrayBuffer();
      if (arrayBuffer.byteLength === 0) throw new Error("Empty file buffer");
      
      const pdfjsVersion = pdfjsLib.version || '6.0.227';
      const loadedPdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/standard_fonts/`,
        cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/cmaps/`,
        cMapPacked: true
      }).promise;
      
      setPdfDoc(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setCurrentPage(1);
      onFileLoaded?.(f, loadedPdf.numPages);
    } catch (e) {
      console.error("PDF Load Error:", e);
      alert('Error loading PDF');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (file && !pdfDoc) {
      initDoc(file);
    }
  }, [file]);

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    
    const canvas = canvasRef.current;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    try {
      await page.render(renderContext).promise;
    } catch (renderError) {
      console.warn("Graceful rendering fallback triggered (likely missing embedded fonts):", renderError);
    }
  };

  useEffect(() => {
    renderPage();
  }, [pdfDoc, currentPage, scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setCurrentRect({
        page: currentPage,
        x,
        y,
        width: 0,
        height: 0
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !currentRect || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentRect({
        ...currentRect,
        width: x - (currentRect.x || 0),
        height: y - (currentRect.y || 0)
    });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRect && containerRef.current) {
        // Normalize rects (handle negative width/height)
        let { x, y, width, height, page } = currentRect;
        if (x === undefined || y === undefined || width === undefined || height === undefined) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        
        if (width < 0) {
            x += width;
            width = Math.abs(width);
        }
        if (height < 0) {
            y += height;
            height = Math.abs(height);
        }
        
        if (width > 5 && height > 5) {
            setRects([...rects, {
                id: Math.random().toString(36).substr(2, 9),
                page: page || 1,
                x, y, width, height,
                canvasWidth: rect.width,
                canvasHeight: rect.height,
                type: manualTool,
                isAuto: false
            }]);
        }
    }
    setIsDrawing(false);
    setCurrentRect(null);
  };
  
  const handleRemoveRect = (id: string, e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation(); // prevent drawing when clicking delete
      setRects(rects.filter(r => r.id !== id));
  };

  const clearAllManual = () => {
    if (confirm('Clear all manual redactions?')) {
        setRects(rects.filter(r => r.isAuto));
    }
  };

  useEffect(() => {
    const extractTextAndSetAutoRects = async () => {
      if (!pdfDoc || mode === 'manual') return;

      const keepRects = rects.filter(r => !r.isAuto);
      if (autoFilters.length === 0) {
        setRects(keepRects);
        return;
      }

      try {
          const page = await pdfDoc.getPage(currentPage);
          const viewport: any = page.getViewport({ scale });
          const textContent = await page.getTextContent();
          
          const newAutoRects: RedactRect[] = [];
          
          for (const item of textContent.items as any[]) {
              const str = item.str || '';
              let matchedType = null;
              
              if (autoFilters.includes('emails') && str.includes('@')) matchedType = 'emails';
              if (autoFilters.includes('phones') && (/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(str) || /\b\d{10}\b/.test(str))) matchedType = 'phones';
              // Check words that look like Name Initial Lastname
              if (autoFilters.includes('names') && /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/.test(str)) matchedType = 'names';

              if (matchedType) {
                  const pdfX = item.transform[4];
                  const pdfY = item.transform[5];
                  const pdfHeight = item.height || Math.sqrt(item.transform[2]*item.transform[2] + item.transform[3]*item.transform[3]);
                  
                  let x = pdfX * scale;
                  let y = viewport.height - (pdfY * scale) - (pdfHeight * scale);
                  
                  if (viewport.convertToViewportPoint) {
                      const ptTopLeft = viewport.convertToViewportPoint(pdfX, pdfY + pdfHeight);
                      x = ptTopLeft[0];
                      y = ptTopLeft[1];
                  }

                  newAutoRects.push({
                      id: Math.random().toString(36).substr(2, 9),
                      page: currentPage,
                      x,
                      y,
                      width: (item.width || str.length * 6) * scale,
                      height: pdfHeight * scale,
                      canvasWidth: viewport.width,
                      canvasHeight: viewport.height,
                      type: 'blur',
                      isAuto: true,
                      autoType: matchedType,
                      accepted: true,
                  });
              }
          }
          
          setRects([...keepRects, ...newAutoRects]);
      } catch(e) {
          console.error("Text extraction failed", e);
      }
    };
    
    extractTextAndSetAutoRects();
  }, [pdfDoc, currentPage, autoFilters, mode, scale]);

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const libDoc = await PDFDocument.load(arrayBuffer);
        
        // Group redactions by page
        const rectsByPage = rects.reduce((acc, r) => {
            if (r.isAuto && !r.accepted) return acc;
            if (!acc[r.page]) acc[r.page] = [];
            acc[r.page].push(r);
            return acc;
        }, {} as Record<number, typeof rects>);
        
        // Apply flattening workaround for secure redaction
        for (const pageNumStr of Object.keys(rectsByPage)) {
            const pageNum = parseInt(pageNumStr, 10);
            const pageRects = rectsByPage[pageNum];
            
            if (pageRects.length === 0) continue;

            // Render PDF page to high-res canvas
            const jsPage = await pdfDoc.getPage(pageNum);
            const renderScale = 3.0; // High DPI
            const viewport = jsPage.getViewport({ scale: renderScale });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) continue;
            
            await jsPage.render({ canvasContext: ctx, viewport }).promise;
            
            // Draw redaction boxes directly on the canvas
            for (const item of pageRects) {
                const uiScaleX = viewport.width / (item.canvasWidth || jsPage.getViewport({ scale }).width);
                const uiScaleY = viewport.height / (item.canvasHeight || jsPage.getViewport({ scale }).height);
                
                const rX = item.x * uiScaleX;
                const rY = item.y * uiScaleY;
                const rW = item.width * uiScaleX;
                const rH = item.height * uiScaleY;
                
                ctx.fillStyle = item.type === 'blur' ? 'rgba(128, 128, 128, 0.95)' : 'rgba(0, 0, 0, 1)';
                ctx.fillRect(rX, rY, rW, rH);
            }
            
            // Convert to JPEG
            const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
            const imgBuffer = await fetch(dataUrl).then(res => res.arrayBuffer());
            const embeddedImg = await libDoc.embedJpg(imgBuffer);
            
            // Replace page to flatten and destroy text underneath
            const originalPage = libDoc.getPage(pageNum - 1);
            const { width: pdfWidth, height: pdfHeight } = originalPage.getSize();
            
            // Insert new page in its place
            const newPage = libDoc.insertPage(pageNum - 1, [pdfWidth, pdfHeight]);
            newPage.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: pdfWidth,
                height: pdfHeight,
            });
            
            // Remove the old page (now shifted by +1 index)
            libDoc.removePage(pageNum);
        }
        
        const bytes = await libDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `redacted_${file.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        console.error(e);
        alert('Failed to redact document');
    }
    setSaving(false);
  };

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <ShieldBan className="w-8 h-8 text-emerald-500" />
            Smart Privacy Redactor
          </h1>
          <p className="text-slate-500">
            Draw black boxes to permanently obscure text.
          </p>
        </div>
        <FileUploader onFileSelected={(files) => setFile(files[0])} />
      </div>
    );
  }

  const currentPageRects = rects.filter(r => r.page === currentPage);

  return (
    <div className="flex flex-col h-screen lg:h-[calc(100dvh-4rem)] bg-slate-100 dark:bg-slate-950 overflow-hidden w-full relative">
      <ConfirmModal 
        isOpen={showConfirmClear} 
        onClose={() => setShowConfirmClear(false)} 
        onConfirm={confirmClearDocument} 
      />
      
      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-4 px-4 flex items-center justify-between pointer-events-none">
        <button onClick={onBackToDashboard} className="p-3 -ml-2 text-slate-700 bg-white shadow-sm dark:bg-slate-900 rounded-full dark:text-slate-300 pointer-events-auto active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        {/* Mode Switcher Pill */}
        <div className="pointer-events-auto bg-white dark:bg-slate-900 shadow-md rounded-full p-1 border border-slate-200 dark:border-slate-800 flex items-center shrink-0">
          <button
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${mode === 'manual' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Manual
          </button>
          <button
            onClick={() => setMode('auto')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 ${mode === 'auto' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}
          >
            <ShieldBan className="w-3.5 h-3.5" />
            Auto-Detect
          </button>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handleClearDocument}
            title="Close / Delete Document"
            className="p-3 text-rose-500 bg-white shadow-sm dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-full transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
          >
             <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || rects.length === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 active:bg-emerald-700 text-white rounded-full font-medium disabled:opacity-50 transition-colors text-sm shadow-md"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>
      
      <div className="absolute left-1/2 -translate-x-1/2 top-20 z-20 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 bg-white/80 backdrop-blur-md dark:bg-slate-900/80 px-4 py-1.5 rounded-full shadow-sm border border-slate-200 dark:border-slate-800">
               <button 
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(c => c - 1)}
                  className="p-1 px-2 text-slate-700 dark:text-slate-300 disabled:opacity-30 active:bg-slate-200 dark:active:bg-slate-800 rounded font-bold"
               >
                   -
               </button>
               <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">Page {currentPage} of {numPages}</span>
               <button 
                  disabled={currentPage >= numPages}
                  onClick={() => setCurrentPage(c => c + 1)}
                  className="p-1 px-2 text-slate-700 dark:text-slate-300 disabled:opacity-30 active:bg-slate-200 dark:active:bg-slate-800 rounded font-bold"
               >
                   +
               </button>
          </div>
      </div>

      <div className="flex-1 overflow-auto relative touch-pan-x touch-pan-y pt-28 pb-32 flex items-start justify-center px-4">
        {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm">
                 <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
             </div>
        )}
        
        <div 
          ref={containerRef}
          className={`relative shadow-xl bg-white border border-slate-300 select-none ${mode === 'manual' ? 'cursor-crosshair' : ''}`}
          onMouseDown={mode === 'manual' ? handleMouseDown : undefined}
          onMouseMove={mode === 'manual' ? handleMouseMove : undefined}
          onMouseUp={mode === 'manual' ? handleMouseUp : undefined}
          onMouseLeave={mode === 'manual' ? handleMouseUp : undefined}
        >
          <canvas ref={canvasRef} className="block w-full max-w-full touch-none" style={{ touchAction: 'none' }} />
          
          {currentPageRects.map(r => (
              <div 
                  key={r.id}
                  className={`absolute group flex items-center justify-center transition-colors
                     ${r.type === 'blur' ? 'backdrop-blur-sm bg-slate-400/50' : 'bg-black'}
                     ${r.isAuto ? 'ring-2 ring-yellow-400 bg-yellow-400/20' : ''}
                  `}
                  style={{
                      left: r.x,
                      top: r.y,
                      width: r.width,
                      height: r.height
                  }}
                  onClick={() => {
                      if (r.isAuto && mode === 'auto') {
                          // toggle accept
                          setRects(prev => prev.map(rect => rect.id === r.id ? { ...rect, accepted: !rect.accepted } : rect));
                      }
                  }}
              >
                  {r.isAuto && mode === 'auto' && (
                      <div className="absolute -top-3 -right-3">
                          {r.accepted !== false ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-white dark:fill-slate-900" />
                          ) : (
                              <Circle className="w-5 h-5 text-slate-400 bg-white dark:bg-slate-900 rounded-full" />
                          )}
                      </div>
                  )}

                  {!r.isAuto && mode === 'manual' && (
                    <button 
                        onClick={(e) => handleRemoveRect(r.id, e)}
                        className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md touch-none"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                  )}
              </div>
          ))}

          {isDrawing && currentRect && (
              <div 
                  className={`absolute border border-black ${manualTool === 'blur' ? 'bg-slate-400/50 backdrop-blur-sm' : 'bg-black/50'}`}
                  style={{
                      left: currentRect.width! < 0 ? currentRect.x! + currentRect.width! : currentRect.x,
                      top: currentRect.height! < 0 ? currentRect.y! + currentRect.height! : currentRect.y,
                      width: Math.abs(currentRect.width!),
                      height: Math.abs(currentRect.height!)
                  }}
              />
          )}
        </div>
      </div>
      
      {/* Footer Tools */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none pb-[max(env(safe-area-inset-bottom),1rem)]">
        
        {mode === 'manual' && (
            <div className="flex justify-center pointer-events-auto px-4 w-full">
                <div className="bg-white/90 backdrop-blur dark:bg-slate-900/90 shadow-lg border border-slate-200 dark:border-slate-800 rounded-2xl p-2 flex items-center gap-2">
                    <button
                        onClick={() => setManualTool('box')}
                        className={`p-3 rounded-xl flex items-center gap-2 ${manualTool === 'box' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 text-slate-600'}`}
                    >
                        <Square className="w-5 h-5 fill-current" />
                        <span className="text-xs font-semibold hidden sm:inline">Blackout</span>
                    </button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button
                        onClick={() => setManualTool('blur')}
                        className={`p-3 rounded-xl flex items-center gap-2 ${manualTool === 'blur' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-slate-800 text-slate-600'}`}
                    >
                        <Paintbrush className="w-5 h-5" />
                        <span className="text-xs font-semibold hidden sm:inline">Blur</span>
                    </button>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-1" />
                    <button
                        onClick={clearAllManual}
                        className="p-3 rounded-xl text-red-500 active:bg-red-50 dark:active:bg-red-900/20"
                        title="Clear Manual"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        )}

        {mode === 'auto' && (
            <div className="pointer-events-auto bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl p-5 shrink-0 flex flex-col mx-auto w-full max-w-2xl">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-4" />
                <h3 className="text-center font-bold text-slate-900 dark:text-white mb-4">Auto-Detect Patterns</h3>
                
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button 
                        onClick={() => setAutoFilters(f => f.includes('emails') ? f.filter(x => x !== 'emails') : [...f, 'emails'])}
                        className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-colors ${autoFilters.includes('emails') ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                    >
                        <Mail className="w-4 h-4" />
                        <span className="text-sm font-semibold">Emails</span>
                    </button>
                    <button 
                        onClick={() => setAutoFilters(f => f.includes('phones') ? f.filter(x => x !== 'phones') : [...f, 'phones'])}
                        className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-colors ${autoFilters.includes('phones') ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                    >
                        <Phone className="w-4 h-4" />
                        <span className="text-sm font-semibold">Phones</span>
                    </button>
                    <button 
                        onClick={() => setAutoFilters(f => f.includes('names') ? f.filter(x => x !== 'names') : [...f, 'names'])}
                        className={`px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-colors ${autoFilters.includes('names') ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                    >
                        <User className="w-4 h-4" />
                        <span className="text-sm font-semibold">Names</span>
                    </button>
                </div>
                <p className="text-xs text-center text-slate-500 mt-4 leading-relaxed">
                    Auto-detect uses exact string matching. Review highlighted areas in the document before saving.
                </p>
            </div>
        )}
      </div>

    </div>
  );
}
