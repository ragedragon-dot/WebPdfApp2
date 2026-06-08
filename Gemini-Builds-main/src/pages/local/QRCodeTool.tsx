import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import QRCode from 'qrcode';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import {
  ChevronLeft, QrCode, Loader2, CheckCircle, Eye, Settings, Link, Move, Maximize2, X, Trash2
} from 'lucide-react';

import { ConfirmModal } from '../../components/ConfirmModal';

interface QRCodeToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

interface PlacedQR {
  pageIndex: number;
  xPercent: number; // 0-100%
  yPercent: number; // 0-100%
  widthPercent: number; // 0-100%
}

export default function QRCodeTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: QRCodeToolProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);

  const [qrText, setQrText] = useState<string>('https://');
  const [qrAssetUrl, setQrAssetUrl] = useState<string | null>(null);
  const [qrAssetBuffer, setQrAssetBuffer] = useState<ArrayBuffer | null>(null);
  const [placedQR, setPlacedQR] = useState<PlacedQR | null>(null);

  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Drag & Resize State
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [interactionMode, setInteractionMode] = useState<'none' | 'drag' | 'resize'>('none');
  const [interactionStart, setInteractionStart] = useState<{ x: number, y: number, startX: number, startY: number, startW: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [pageAspectRatio, setPageAspectRatio] = useState<number>(1 / 1.414);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (qrAssetUrl) URL.revokeObjectURL(qrAssetUrl);
    };
  }, [fileUrl, qrAssetUrl]);

  const handleClearDocument = () => {
    setShowConfirmClear(true);
  };

  const confirmClearDocument = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setQrText('https://');
    if (qrAssetUrl) URL.revokeObjectURL(qrAssetUrl);
    setQrAssetUrl(null);
    setQrAssetBuffer(null);
    setPlacedQR(null);
    setPdfDoc(null);
  };

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setPdfDoc(null);
    setPageCount(0);
    setActivePageIndex(0);
    setPlacedQR(null);
    setQrAssetUrl(null);

    try {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      onFileLoaded?.(selectedFile, doc.numPages);
    } catch (err) {
      console.error(err);
      setFile(null);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    } finally {
      setLoadingFile(false);
    }
  }, [fileUrl, onFileLoaded]);

  useEffect(() => {
    if (initialFile) handleFileSelected(initialFile);
  }, [initialFile, handleFileSelected]);

  const renderPDFPage = useCallback(async () => {
    if (!pdfDoc || !renderCanvasRef.current || !containerRef.current) return;
    setRenderingPage(true);

    try {
      const page = await pdfDoc.getPage(activePageIndex + 1);
      const canvas = renderCanvasRef.current;
      const containerWidth = containerRef.current.clientWidth;
      
      const viewport = page.getViewport({ scale: 1.0 });
      setPageAspectRatio(viewport.width / viewport.height);
      const scale = containerWidth / viewport.width;
      const responsiveViewport = page.getViewport({ scale });

      canvas.width = responsiveViewport.width;
      canvas.height = responsiveViewport.height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        await page.render({
          canvasContext: ctx,
          viewport: responsiveViewport
        } as any).promise;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRenderingPage(false);
    }
  }, [pdfDoc, activePageIndex]);

  useEffect(() => {
    if (pdfDoc && qrAssetUrl) {
      renderPDFPage();
    }
  }, [pdfDoc, activePageIndex, qrAssetUrl, renderPDFPage]);

  const handleGenerateQRAsset = async () => {
    if (qrText.trim().length === 0 || qrText === 'https://') return;

    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, qrText, { margin: 1, width: 300, color: { dark: '#000000', light: '#ffffff' } });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        setQrAssetBuffer(buffer);
        if (qrAssetUrl) URL.revokeObjectURL(qrAssetUrl);
        setQrAssetUrl(URL.createObjectURL(blob));
        setPlacedQR({
          pageIndex: activePageIndex,
          xPercent: 35,
          yPercent: 35,
          widthPercent: 30 // takes up 30% width initially
        });
      }, 'image/png');
    } catch (err) {
      console.error(err);
    }
  };

  // Interactions
  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const handlePointerDown = (e: React.PointerEvent, mode: 'drag' | 'resize') => {
    if (!placedQR) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Explicitly capture pointer
    if (e.target instanceof Element) {
      e.target.setPointerCapture(e.pointerId);
    }

    setInteractionMode(mode);
    setInteractionStart({
      x: e.clientX,
      y: e.clientY,
      startX: placedQR.xPercent,
      startY: placedQR.yPercent,
      startW: placedQR.widthPercent
    });
    setShowGrid(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (interactionMode === 'none' || !interactionStart || !placedQR) return;
    e.preventDefault();

    const rect = getContainerRect();
    if (!rect) return;

    const deltaX = e.clientX - interactionStart.x;
    const deltaY = e.clientY - interactionStart.y;
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    if (interactionMode === 'drag') {
      let newX = interactionStart.startX + deltaXPercent;
      let newY = interactionStart.startY + deltaYPercent;
      
      // Keep inside bounds (approx height using aspect ratio matching width mapped by container's aspect)
      const aspect = rect.height / rect.width;
      const heightPercent = placedQR.widthPercent / aspect;

      newX = Math.max(0, Math.min(newX, 100 - placedQR.widthPercent));
      newY = Math.max(0, Math.min(newY, 100 - heightPercent));

      setPlacedQR({ ...placedQR, xPercent: newX, yPercent: newY });
    } else if (interactionMode === 'resize') {
      let newW = interactionStart.startW + deltaXPercent;
      newW = Math.max(10, Math.min(newW, 80)); // min 10%, max 80% width
      setPlacedQR({ ...placedQR, widthPercent: newW });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setInteractionMode('none');
    setInteractionStart(null);
    setShowGrid(false);
    if (e.target instanceof Element) {
      e.target.releasePointerCapture(e.pointerId);
    }
  };

  const burnAndCompilePDF = async () => {
    if (!file || !qrAssetBuffer || !placedQR) return;
    setProcessing(true);
    setProgressText('Embedding QR code...');

    try {
      const fileBytes = await file.arrayBuffer();
      const pdfDocLib = await PDFDocument.load(fileBytes);
      const pages = pdfDocLib.getPages();

      const targetPage = pages[placedQR.pageIndex];
      const pageW = targetPage.getWidth();
      const pageH = targetPage.getHeight();

      const qrImage = await pdfDocLib.embedPng(qrAssetBuffer);

      const rect = getContainerRect();
      if (rect) {
        const containerWidth = rect.width;
        const containerHeight = rect.height;
        const pdfPageWidth = pageW;
        const pdfPageHeight = pageH;

        // uiX, uiY, uiWidth, uiHeight (from the draggable React component)
        const uiX = (placedQR.xPercent / 100) * containerWidth;
        const uiY = (placedQR.yPercent / 100) * containerHeight;
        const uiWidth = (placedQR.widthPercent / 100) * containerWidth;

        // 1. Calculate a single, uniform scale factor (using width as the baseline)
        const uniformScale = pdfPageWidth / containerWidth;

        // 2. Apply the SAME scale factor to force a perfect square
        const finalSize = uiWidth * uniformScale;

        // 3. Calculate positioning
        const scaledX = uiX * uniformScale;
        // Remember the Y-inversion and bottom-left anchor for pdf-lib!
        const scaledY = pdfPageHeight - (uiY * uniformScale) - finalSize; 

        targetPage.drawImage(qrImage, {
          x: scaledX,
          y: scaledY,
          width: finalSize,
          height: finalSize
        });
      }

      setProgressText('Exporting document...');
      const resultBytes = await pdfDocLib.save();
      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = `QR_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);
    } catch (err) {
      console.error(err);
      alert('Fail to write final file output.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-slate-100 dark:bg-slate-900 overflow-hidden font-sans">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      <ConfirmModal 
        isOpen={showConfirmClear} 
        onClose={() => setShowConfirmClear(false)} 
        onConfirm={confirmClearDocument} 
      />
      
      {!file ? (
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-6 flex items-center pt-safe">
            <button onClick={onBackToDashboard} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
               <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="ml-2 text-xl font-bold text-slate-800 dark:text-slate-100">QR Code Stamp</h1>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm">
              {loadingFile ? (
                <div className="flex flex-col items-center p-12 border bg-white dark:bg-slate-800 rounded-3xl shadow-sm space-y-4">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm">Reading document...</p>
                </div>
              ) : (
                <FileUploader onFileSelected={(files) => handleFileSelected(files[0])} acceptType="pdf" />
              )}
            </div>
          </div>
        </div>
      ) : !qrAssetUrl ? (
        // Split State 1: Configuration View
        <div className="flex-1 flex flex-col p-4 animate-fadeIn">
          <div className="mb-6 flex items-center justify-between pt-safe">
            <div className="flex items-center">
              <button onClick={() => setFile(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-500">
                 <ChevronLeft className="w-6 h-6" />
              </button>
              <h1 className="ml-2 text-xl font-bold text-slate-800 dark:text-slate-100">Configure Data</h1>
            </div>
            <button onClick={handleClearDocument} title="Close / Delete Document" className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-rose-500 rounded-full transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center pt-10">
            <div className="w-full max-w-sm space-y-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
               <div className="mx-auto w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-2xl mb-4">
                 <QrCode className="w-8 h-8" />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Target URL / Text Data</label>
                 <div className="relative">
                   <Link className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400 pointer-events-none" />
                   <input
                     type="text"
                     placeholder="https://example.com"
                     value={qrText}
                     onChange={e => setQrText(e.target.value)}
                     className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                   />
                 </div>
               </div>
               <button
                 onClick={handleGenerateQRAsset}
                 disabled={qrText.trim().length === 0 || qrText === 'https://'}
                 className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
               >
                 <Settings className="w-5 h-5" /> Generate QR Stamp
               </button>
            </div>
          </div>
        </div>
      ) : (
        // Split State 2: Placement Workspace
        <div className="flex-1 flex flex-col h-full overflow-hidden animate-fadeIn relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 shrink-0 pt-safe">
            <div className="flex items-center gap-2">
              <button onClick={() => setQrAssetUrl(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                 <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
              <button onClick={handleClearDocument} title="Close / Delete Document" className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-rose-500 rounded-full transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
               <button 
                 disabled={activePageIndex === 0}
                 onClick={() => { setActivePageIndex(p => p - 1); setPlacedQR(p => p ? {...p, pageIndex: p.pageIndex - 1} : null); }}
                 className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30"
               >Prev</button>
               <span className="text-sm font-mono font-bold text-slate-500">{activePageIndex + 1} / {pageCount}</span>
               <button 
                 disabled={activePageIndex === pageCount - 1}
                 onClick={() => { setActivePageIndex(p => p + 1); setPlacedQR(p => p ? {...p, pageIndex: p.pageIndex + 1} : null); }}
                 className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-30"
               >Next</button>
            </div>
          </div>

          {/* Interactive Canvas Area */}
          <div className="flex-1 relative bg-slate-200 dark:bg-slate-950 overflow-hidden flex items-center justify-center p-4">
            <div 
              ref={containerRef}
              className="relative shadow-2xl bg-white select-none shrink-0"
              style={{
                aspectRatio: `${pageAspectRatio}`,
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            >
               <canvas ref={renderCanvasRef} className="w-full h-full pointer-events-none block" />

               {/* Targeting Grid Feedback overlays */}
               {showGrid && (
                 <div className="absolute inset-0 pointer-events-none grid grid-cols-4 grid-rows-4 z-10 border-2 border-indigo-500/30">
                   {Array.from({length: 16}).map((_, i) => (
                     <div key={i} className="border border-indigo-500/10" />
                   ))}
                   <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-indigo-600/80 text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest backdrop-blur-sm">Aligning to Grid</span>
                   </div>
                 </div>
               )}

               {/* Floating QR Element */}
               {placedQR && placedQR.pageIndex === activePageIndex && (
                 <div 
                   className="absolute touch-none cursor-move flex items-center justify-center z-20 aspect-square border-2 border-indigo-500 shadow-2xl bg-white/90 group"
                   style={{
                     left: `${placedQR.xPercent}%`,
                     top: `${placedQR.yPercent}%`,
                     width: `${placedQR.widthPercent}%`
                   }}
                   onPointerDown={(e) => handlePointerDown(e, 'drag')}
                   onPointerMove={handlePointerMove}
                   onPointerUp={handlePointerUp}
                   onPointerCancel={handlePointerUp}
                 >
                   <img src={qrAssetUrl} alt="QR Code" className="w-[90%] h-[90%] pointer-events-none object-contain mix-blend-multiply" />
                   
                   {/* Resize Handle (Bottom Right) */}
                   <div 
                     className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize bg-indigo-600 text-white rounded-full shadow-lg opacity-80 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                     onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'resize'); }}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerCancel={handlePointerUp}
                   >
                     <Maximize2 className="w-4 h-4" />
                   </div>
                   
                   {/* Drag handler visual icon */}
                   <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                     <Move className="w-4 h-4" />
                   </div>
                 </div>
               )}
            </div>
            
            {renderingPage && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm z-30">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-20 pb-[max(env(safe-area-inset-bottom),1rem)]">
             <button
               onClick={burnAndCompilePDF}
               disabled={processing || !placedQR}
               className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] transition-all text-white font-extrabold text-base rounded-full shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
             >
               {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
               Burn QR & Export PDF
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
