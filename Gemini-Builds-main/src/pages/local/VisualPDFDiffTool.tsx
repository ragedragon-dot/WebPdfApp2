import React, { useState, useEffect, useRef } from 'react';
import { GitPullRequest, ArrowLeft, Loader2, UploadCloud, ChevronRight, ChevronLeft } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

export default function VisualPDFDiffTool({ onBackToDashboard, initialFile }: any) {
  const [fileA, setFileA] = useState<File | null>(initialFile || null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfA, setPdfA] = useState<any>(null);
  const [pdfB, setPdfB] = useState<any>(null);
  
  const canvasARef = useRef<HTMLCanvasElement>(null);
  const canvasBRef = useRef<HTMLCanvasElement>(null);
  const canvasDiffRef = useRef<HTMLCanvasElement>(null);

  const initPdfs = async () => {
    if (!fileA || !fileB) return;
    setLoading(true);
    try {
      const bufferA = await fileA.arrayBuffer();
      const bufferB = await fileB.arrayBuffer();
      if (bufferA.byteLength === 0 || bufferB.byteLength === 0) throw new Error("Empty file buffer");
      
      const taskA = pdfjsLib.getDocument({ data: bufferA });
      const taskB = pdfjsLib.getDocument({ data: bufferB });
      
      const pA = await taskA.promise;
      const pB = await taskB.promise;
      
      setPdfA(pA);
      setPdfB(pB);
      
      const maxPages = Math.max(pA.numPages, pB.numPages);
      setPageCount(maxPages);
      setCurrentPage(1);
    } catch (e) {
      console.error("PDF Load Error:", e);
      alert('Error loading PDFs for comparison.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (fileA && fileB) {
      initPdfs();
    }
  }, [fileA, fileB]);

  const renderPage = async (pdfDoc: any, pageNum: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas || !pdfDoc || pageNum > pdfDoc.numPages) {
      if (canvas) {
         const ctx = canvas.getContext('2d');
         if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return null;
    }
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Fill white bg
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  };

  useEffect(() => {
    if (!pdfA && !pdfB) return;
    
    const drawDiff = async () => {
      setLoading(true);
      await Promise.all([
        renderPage(pdfA, currentPage, canvasARef.current),
        renderPage(pdfB, currentPage, canvasBRef.current)
      ]);
      
      // Perform diff
      if (canvasARef.current && canvasBRef.current && canvasDiffRef.current) {
        const cA = canvasARef.current;
        const cB = canvasBRef.current;
        const cDiff = canvasDiffRef.current;
        
        const maxWidth = Math.max(cA.width, cB.width);
        const maxHeight = Math.max(cA.height, cB.height);
        
        cDiff.width = maxWidth || 800;
        cDiff.height = maxHeight || 1000;
        const ctxDiff = cDiff.getContext('2d');
        if (ctxDiff) {
            ctxDiff.fillStyle = 'white';
            ctxDiff.fillRect(0, 0, cDiff.width, cDiff.height);

            if (cA.width > 0) ctxDiff.drawImage(cA, 0, 0);
            
            ctxDiff.globalCompositeOperation = 'difference';
            if (cB.width > 0) ctxDiff.drawImage(cB, 0, 0);
            
            // The difference is now drawn. Where they are same = black. Where different = colors.
            // Let's invert it or apply a filter so difference is red and same is white.
            // A simple threshold filter.
            const imgData = ctxDiff.getImageData(0, 0, cDiff.width, cDiff.height);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              // If difference is small (close to black), make it white (same)
              if (r < 20 && g < 20 && b < 20) {
                 data[i] = 255;
                 data[i+1] = 255;
                 data[i+2] = 255;
                 data[i+3] = 255; // alpha
              } else {
                 // Different! Make it red highlight
                 data[i] = 255;
                 data[i+1] = 0;
                 data[i+2] = 0;
                 data[i+3] = 255;
              }
            }
            ctxDiff.putImageData(imgData, 0, 0);
            
            // Draw back original A with low opacity to give context, then overlay red
            ctxDiff.globalCompositeOperation = 'source-over';
            ctxDiff.globalAlpha = 0.2;
            if (cA.width > 0) ctxDiff.drawImage(cA, 0, 0);
            ctxDiff.globalAlpha = 1.0;
        }
      }
      setLoading(false);
    };
    drawDiff();
  }, [currentPage, pdfA, pdfB]);

  if (!fileA || !fileB) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="text-center space-y-2">
          <GitPullRequest className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Visual PDF Diff</h2>
          <p className="text-slate-500">Compare two pdfs side by side.</p>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fileA ? fileA.name : 'Select PDF A (Original)'}</span>
            <input type="file" accept="application/pdf" className="hidden" id="upload-a" onChange={(e) => { if(e.target.files?.[0]) setFileA(e.target.files[0]) }} />
            {!fileA && <label htmlFor="upload-a" className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg cursor-pointer text-sm font-medium hover:bg-slate-800">Browse Files</label>}
          </div>

          <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center">
            <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fileB ? fileB.name : 'Select PDF B (Modified)'}</span>
            <input type="file" accept="application/pdf" className="hidden" id="upload-b" onChange={(e) => { if(e.target.files?.[0]) setFileB(e.target.files[0]) }} />
            {!fileB && <label htmlFor="upload-b" className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg cursor-pointer text-sm font-medium hover:bg-slate-800">Browse Files</label>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
         <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="flex space-x-2">
            <button onClick={() => { setFileA(null); setFileB(null); setPdfA(null); setPdfB(null); }} className="text-sm font-medium text-emerald-600 hover:underline">Compare New Files</button>
        </div>
      </div>
      
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-700 dark:text-slate-200">Difference Map (Page {currentPage} of {pageCount})</h3>
        <div className="flex items-center gap-4">
           <button 
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(c => c - 1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium">{currentPage} / {pageCount}</span>
            <button 
              disabled={currentPage >= pageCount || loading}
              onClick={() => setCurrentPage(c => c + 1)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="relative border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 h-[700px] flex justify-center items-start overflow-y-auto w-full p-4">
         {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm">
                 <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
             </div>
         )}
         
         <div className="flex gap-4 items-start w-full justify-center">
             <div className="hidden">
                 <canvas ref={canvasARef} />
                 <canvas ref={canvasBRef} />
             </div>
             <div className="bg-white shadow-md p-1">
                 <canvas ref={canvasDiffRef} className="max-w-full h-auto object-contain" />
             </div>
         </div>
      </div>
    </div>
  );
}
