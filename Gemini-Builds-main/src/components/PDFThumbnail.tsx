import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Loader2, EyeOff, Check, Trash2 } from 'lucide-react';

interface PDFThumbnailProps {
  key?: any;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
  pageNumber: number;
  isExcluded: boolean;
  onToggleExclude: () => void;
}

export default function PDFThumbnail({
  pdfDocument,
  pageNumber,
  isExcluded,
  onToggleExclude
}: PDFThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Intersection Observer for lazy rendering of thumbnails
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !pdfDocument || !canvasRef.current) return;

    let isMounted = true;

    async function renderThumb() {
      setLoading(true);
      setError(false);
      try {
        const page = await pdfDocument!.getPage(pageNumber);
        
        if (!isMounted) return;

        // Desired size width around 180px
        const origViewport = page.getViewport({ scale: 1.0 });
        const desiredWidth = 160;
        const scale = desiredWidth / origViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Cancel previous render task if exists
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        const renderTask = page.render(renderContext as any);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException' && isMounted) {
          console.error(`Error rendering page ${pageNumber} thumbnail:`, err);
          setError(true);
          setLoading(false);
        }
      }
    }

    renderThumb();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [isVisible, pdfDocument, pageNumber]);

  return (
    <div
      ref={containerRef}
      id={`page-item-container-${pageNumber}`}
      onClick={onToggleExclude}
      className={`relative group rounded-xl border-2 transition-all duration-200 select-none overflow-hidden cursor-pointer flex flex-col justify-between ${
        isExcluded
          ? 'border-red-400 dark:border-red-500/50 bg-red-50/20 dark:bg-red-950/10 grayscale opacity-80 scale-98 shadow-sm'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500/50 hover:shadow-md'
      }`}
    >
      {/* Page Header Header */}
      <div className={`px-3 py-1.5 border-b flex items-center justify-between text-xs font-semibold ${
        isExcluded 
          ? 'border-red-100 bg-red-50/50 text-red-700 dark:border-red-950/30' 
          : 'border-slate-100 bg-slate-50 text-slate-700 dark:border-slate-800/40 dark:text-slate-300'
      }`}>
        <span>Page {pageNumber}</span>
        {isExcluded ? (
          <span className="flex items-center text-[10px] text-red-600 dark:text-red-400 gap-1 uppercase tracking-wider font-bold">
            <EyeOff className="w-3 h-3" /> Exclude
          </span>
        ) : (
          <span className="flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 gap-1 uppercase tracking-wider font-bold">
            <Check className="w-3 h-3" /> Keep
          </span>
        )}
      </div>

      {/* Rendering Box */}
      <div className="flex-1 flex items-center justify-center p-4 bg-slate-50/40 dark:bg-slate-950/20 min-h-[180px] relative">
        {!isVisible ? (
          <div className="text-slate-400 text-[10px] font-sans">Scroll to view</div>
        ) : loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            <span className="text-[10px] text-slate-400">Rendering...</span>
          </div>
        ) : error ? (
          <div className="text-xs text-red-500">Render Failed</div>
        ) : null}

        <canvas
          ref={canvasRef}
          className={`mx-auto rounded transition-opacity duration-300 shadow bg-white ${
            loading || error ? 'opacity-0 h-0 w-0' : 'opacity-100'
          }`}
        />

        {/* Overlay Hover Button Indicator */}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center text-white text-xs font-bold gap-1.5 rounded-b-xl">
          {isExcluded ? (
            <span className="bg-emerald-600 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Restore Page
            </span>
          ) : (
            <span className="bg-red-600 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Remove Page
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
