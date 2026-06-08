import React, { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, AlertCircle, Maximize2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the pdfjs worker URL with modern jsdelivr ESM path
const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

interface PDFCanvasViewerProps {
  url: string;
}

export default function PDFCanvasViewer({ url }: PDFCanvasViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.2);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const renderPage = async (pageNumber: number, currentScale: number, doc: any) => {
    if (!doc || !canvasRef.current) return;
    setIsRendering(true);

    try {
      // Cancel active rendering if any
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
      setIsRendering(false);
    } catch (err: any) {
      if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
        return;
      }
      console.error('PDF rendering error:', err);
      setError('Unable to render PDF page onto canvas.');
      setIsRendering(false);
    }
  };

  // Document loading loop
  useEffect(() => {
    let isMounted = true;

    const loadPdfJsAndDoc = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Initialize document loading
        const loadingTask = pdfjsLib.getDocument({
          url,
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/standard_fonts/`,
          cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/cmaps/`,
          cMapPacked: true,
        });
        const doc = await loadingTask.promise;

        if (!isMounted) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setPageNum(1);
        setIsLoading(false);

        // Initial render
        await renderPage(1, scale, doc);
      } catch (err: any) {
        console.error('PDF initialization error:', err);
        if (isMounted) {
          setError('Failed to initialize PDF render session. Please try a different document.');
          setIsLoading(false);
        }
      }
    };

    loadPdfJsAndDoc();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [url]);

  // Handle subsequent attribute / page triggers
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pageNum, scale, pdfDoc);
    }
  }, [pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) {
      setPageNum(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (pageNum < numPages) {
      setPageNum(prev => prev + 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(3.0, prev + 0.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  };

  const handleFitWidth = () => {
    if (!containerRef.current || !pdfDoc) return;
    try {
      const containerWidth = containerRef.current.clientWidth - 48; // inner margin padding
      pdfDoc.getPage(pageNum).then((page: any) => {
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const newScale = containerWidth / unscaledViewport.width;
        setScale(Number(newScale.toFixed(2)));
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* Top action controller toolbar */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 flex items-center justify-between shadow-sm select-none shrink-0 z-10">
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevPage}
            disabled={pageNum <= 1 || isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Previous Page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2 min-w-[75px] text-center">
            Page {pageNum} / {numPages || '?'}
          </span>

          <button
            onClick={handleNextPage}
            disabled={pageNum >= numPages || isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Next Page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.6 || isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 2.8 || isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          <button
            onClick={handleFitWidth}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Fit to Width"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrolling viewport canvas wrapper */}
      <div className="flex-1 overflow-auto p-6 md:p-8 flex items-start justify-center bg-slate-100 dark:bg-slate-950 relative">
        {isLoading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-100/85 dark:bg-slate-950/85 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Loading PDF document render process...</p>
          </div>
        )}

        {isRendering && !isLoading && (
          <div className="absolute bottom-4 right-4 z-20 bg-white/90 dark:bg-slate-900/90 shadow-md border border-slate-200 dark:border-slate-800 rounded-lg py-1.5 px-3 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 animate-fade-in pointer-events-none">
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span>Rendering Canvas...</span>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 max-w-sm mt-12">
            <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Render Failure</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{error}</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 shadow-xl rounded-lg border border-slate-250 dark:border-slate-800 flex items-center justify-center overflow-hidden">
            <canvas ref={canvasRef} />
          </div>
        )}
      </div>
    </div>
  );
}
