import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  ChevronLeft,
  PenTool,
  Download,
  Loader2,
  Trash2,
  CheckCircle,
  FolderOpen,
  MousePointer,
  RotateCcw,
  Sliders,
  Type,
  Edit3,
  FileCheck,
  Eye,
  Info
} from 'lucide-react';

interface SignPDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

interface PlacedSignature {
  pageIndex: number; // 0-based
  x: number; // relative percent 0-100
  y: number; // relative percent 0-100
  scale: number; // multiplier for size, e.g., 1.0 (default width ~120px)
}

const AVAILABLE_FONTS = [
  { id: 'Caveat', name: 'Caveat Script', css: 'Caveat, cursive' },
  { id: 'Great Vibes', name: 'Great Vibes', css: '"Great Vibes", cursive' },
  { id: 'Dancing Script', name: 'Dancing Script', css: '"Dancing Script", cursive' },
  { id: 'Alex Brush', name: 'Alex Brush', css: '"Alex Brush", cursive' },
  { id: 'Sacramento', name: 'Sacramento', css: '"Sacramento", cursive' },
  { id: 'Yellowtail', name: 'Yellowtail', css: '"Yellowtail", cursive' },
  { id: 'Playball', name: 'Playball', css: '"Playball", cursive' },
  { id: 'Parisienne', name: 'Parisienne', css: '"Parisienne", cursive' },
];

export default function SignPDFTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: SignPDFToolProps) {
  // Parsing states
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [activePageIndex, setActivePageIndex] = useState<number>(0); // 0-based index

  // Signature creation options
  const [sigType, setSigType] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState<string>('');
  const [typedFont, setTypedFont] = useState<string>('Caveat');
  const [sigColor, setSigColor] = useState<string>('#020617'); // slate-950, royal-600, violet-600
  
  // Placed Signature metadata
  const [signatureAssetUrl, setSignatureAssetUrl] = useState<string | null>(null);
  const [signatureAssetBuffer, setSignatureAssetBuffer] = useState<ArrayBuffer | null>(null);
  const [placedSig, setPlacedSig] = useState<PlacedSignature | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Layout rendering triggers
  const [renderingPage, setRenderingPage] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Refs for drawing pad and active pdf canvas
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  // Manage revocation of memoryURLs
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (signatureAssetUrl) URL.revokeObjectURL(signatureAssetUrl);
    };
  }, [fileUrl, signatureAssetUrl]);

  const handleClearDocument = () => {
    setShowConfirmClear(true);
  };

  const confirmClearDocument = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setTypedName('');
    setPlacedSig(null);
    if (signatureAssetUrl) URL.revokeObjectURL(signatureAssetUrl);
    setSignatureAssetUrl(null);
    setSignatureAssetBuffer(null);
    setPageCount(0);
    setPdfDoc(null);
  };

  // Read upload PDF
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setPdfDoc(null);
    setPageCount(0);
    setActivePageIndex(0);
    setPlacedSig(null);

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
      alert('Failed to parse document. Check that it is a healthy, non-encrypted file.');
      setFile(null);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    } finally {
      setLoadingFile(false);
    }
  }, [fileUrl, onFileLoaded]);

  // Handle initialization of file if provided via state
  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, handleFileSelected]);

  // Draw Page viewport dynamically inside the workspace
  const renderPDFPage = useCallback(async () => {
    if (!pdfDoc || !renderCanvasRef.current) return;
    setRenderingPage(true);

    try {
      // 1-based index for pdf-js
      const page = await pdfDoc.getPage(activePageIndex + 1);
      
      const canvas = renderCanvasRef.current;
      const container = canvas.parentElement;
      if (!container) return;

      const viewport = page.getViewport({ scale: 1.0 });
      // Calculate responsive width capping at 480px width for standard letter portrait
      const containerWidth = Math.min(container.clientWidth || 450, 480);
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
      console.error('Error drawing viewport:', err);
    } finally {
      setRenderingPage(false);
    }
  }, [pdfDoc, activePageIndex]);

  // Synchronize canvas draw on change active index
  useEffect(() => {
    if (pdfDoc) {
      renderPDFPage();
    }
  }, [pdfDoc, activePageIndex, renderPDFPage]);

  // Drawing pad events listeners
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;

    ctx.strokeStyle = sigColor;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignatureTick = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('clientX' in e ? e.clientX : e.touches[0].clientX) - rect.left;
    const y = ('clientY' in e ? e.clientY : e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearDrawingPad = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Convert handwritten text or canvas stroke list into PNG ObjectURL asset
  const handleSaveSignatureAsset = async (keepPlacement: boolean = false) => {
    if (sigType === 'draw') {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;

      // Create a recolored dynamic high contrast stamp matching latest picked color
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = canvas.width;
      renderCanvas.height = canvas.height;
      const rCtx = renderCanvas.getContext('2d');
      if (rCtx) {
        rCtx.drawImage(canvas, 0, 0);
        rCtx.globalCompositeOperation = 'source-in';
        rCtx.fillStyle = sigColor;
        rCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
      }

      // Save renderCanvas contents to Blob
      renderCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const arrayBuffer = await blob.arrayBuffer();
        setSignatureAssetBuffer(arrayBuffer);

        if (signatureAssetUrl) URL.revokeObjectURL(signatureAssetUrl);
        setSignatureAssetUrl(URL.createObjectURL(blob));

        if (!keepPlacement || !placedSig) {
          // Place initially in center of sheet
          setPlacedSig({
            pageIndex: activePageIndex,
            x: 40,
            y: 45,
            scale: 1.0
          });
        }
      }, 'image/png');
    } else {
      // Bakes Typed Name using offscreen canvas to render text in handwritten style
      if (typedName.trim().length === 0) {
        alert('Please type your name first!');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 450;
      canvas.height = 130;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Anti-aliasing text
        ctx.fillStyle = sigColor;
        
        let drawingFont = `bold 50px Caveat`;
        if (typedFont === 'Great Vibes') {
          drawingFont = `italic 46px "Great Vibes"`;
        } else if (typedFont === 'Dancing Script') {
          drawingFont = `bold 42px "Dancing Script"`;
        } else if (typedFont === 'Alex Brush') {
          drawingFont = `normal 48px "Alex Brush"`;
        } else if (typedFont === 'Sacramento') {
          drawingFont = `normal 52px "Sacramento"`;
        } else if (typedFont === 'Yellowtail') {
          drawingFont = `italic 42px "Yellowtail"`;
        } else if (typedFont === 'Playball') {
          drawingFont = `normal 44px "Playball"`;
        } else if (typedFont === 'Parisienne') {
          drawingFont = `normal 48px "Parisienne"`;
        }
        
        ctx.font = drawingFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
         
        // Add text shadows for smoother digital ink
        ctx.shadowColor = sigColor + '20';
        ctx.shadowBlur = 1;

        ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

        canvas.toBlob(async (blob) => {
          if (!blob) return;
          const arrayBuffer = await blob.arrayBuffer();
          setSignatureAssetBuffer(arrayBuffer);

          if (signatureAssetUrl) URL.revokeObjectURL(signatureAssetUrl);
          setSignatureAssetUrl(URL.createObjectURL(blob));

          if (!keepPlacement || !placedSig) {
            setPlacedSig({
              pageIndex: activePageIndex,
              x: 40,
              y: 45,
              scale: 1.0
            });
          }
          
          setIsSheetOpen(false);
        }, 'image/png');
      }
    }
  };

  // Canvas Click Event: quick placing coordinate mapping
  const handleCanvasOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureAssetUrl || !placedSig) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const percentX = (clickX / rect.width) * 100;
    const percentY = (clickY / rect.height) * 100;

    setPlacedSig((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        pageIndex: activePageIndex,
        x: Math.max(0, Math.min(percentX - (15 * prev.scale), 100)), // Offset slightly to center the stamp click
        y: Math.max(0, Math.min(percentY - (5 * prev.scale), 100))
      };
    });
  };

  // Relatives placement setters
  const adjustScale = (newScale: number) => {
    setPlacedSig((prev) => (prev ? { ...prev, scale: newScale } : null));
  };

  const adjustX = (newX: number) => {
    setPlacedSig((prev) => (prev ? { ...prev, x: newX } : null));
  };

  const adjustY = (newY: number) => {
    setPlacedSig((prev) => (prev ? { ...prev, y: newY } : null));
  };

  // Compile placed signature coordinates using pdf-lib and export
  const burnAndCompilePDF = async () => {
    if (!file || !signatureAssetBuffer || !placedSig) return;
    setProcessing(true);
    setProgressText('Opening document bytes...');

    try {
      const fileBuffer = await file.arrayBuffer();
      const pdfDocLib = await PDFDocument.load(fileBuffer);
      const pages = pdfDocLib.getPages();
      
      // Select appropriate page
      const targetPage = pages[placedSig.pageIndex];
      const pageW = targetPage.getWidth();
      const pageH = targetPage.getHeight();

      setProgressText('Embedding signature ink...');
      const sigImg = await pdfDocLib.embedPng(signatureAssetBuffer);

      // Width coordinates mapping. Standard signature is 120 points wide inside scaled context matching display.
      const renderCanvas = renderCanvasRef.current;
      const pdfContainerWidth = renderCanvas ? renderCanvas.clientWidth : pageW;
      const pdfContainerHeight = renderCanvas ? renderCanvas.clientHeight : pageH;

      const sigWidth = 125 * placedSig.scale;
      const sigHeight = (sigWidth / sigImg.width) * sigImg.height;
      
      const stampElement = document.getElementById('visible-signature-stamp');
      
      const screenData = {
        pdfContainerWidth,
        pdfContainerHeight,
        sigX: (placedSig.x / 100) * pdfContainerWidth,
        sigY: (placedSig.y / 100) * pdfContainerHeight,
        sigWidth: stampElement ? stampElement.clientWidth : sigWidth,
        sigHeight: stampElement ? stampElement.clientHeight : sigHeight
      };

      // 1. Calculate Scale
      const scaleX = pageW / screenData.pdfContainerWidth;
      const scaleY = pageH / screenData.pdfContainerHeight;

      // 2. Scale the signature dimensions
      const finalWidth = screenData.sigWidth * scaleX;
      const finalHeight = screenData.sigHeight * scaleY;

      // 3. Translate X
      const finalX = screenData.sigX * scaleX;

      // 4. Translate Y (Invert axis AND account for the image's own height)
      // The DOM Y is the top edge. We need the PDF Y, which is the bottom edge.
      const finalY = pageH - ((screenData.sigY + screenData.sigHeight) * scaleY);

      targetPage.drawImage(sigImg, {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight
      });

      setProgressText('Assembling signed PDF output...');
      const resultBytes = await pdfDocLib.save();
      const blob = new Blob([resultBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(blob);

      // Trigger automatic sheet download 
      const link = document.createElement('a');
      link.href = dlUrl;
      const dotIdx = file.name.lastIndexOf('.');
      const baseName = dotIdx !== -1 ? file.name.substring(0, dotIdx) : file.name;
      link.download = `${baseName}_signed.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);
    } catch (err) {
      console.error(err);
      alert('An error occurred while compiling your final PDF document. Verify it is not restricted.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div id="sign-pdf-view" className="flex flex-col h-[100dvh] lg:h-auto lg:block lg:space-y-6 max-w-5xl mx-auto pt-2 lg:py-2">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      <ConfirmModal 
        isOpen={showConfirmClear} 
        onClose={() => setShowConfirmClear(false)} 
        onConfirm={confirmClearDocument} 
      />
      {/* Upper header */}
      <div className="flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 lg:pb-6 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-0">
        <div className="space-y-1.5">
          <button
            onClick={onBackToDashboard}
            className="group inline-flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Sign PDF Document
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Draw or type your legal electronic signature and place it with point-precision on any page of your file.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {file && (
            <button
              onClick={handleClearDocument}
              title="Close / Delete Document"
              className="p-2.5 text-rose-500 hover:text-rose-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {file && signatureAssetUrl && (
            <button
              onClick={burnAndCompilePDF}
              disabled={processing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileCheck className="w-3.5 h-3.5" />
                  Burn & Download PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!file ? (
        /* PDF Selection area */
        <div className="max-w-xl mx-auto py-10">
          {loadingFile ? (
            <div className="flex flex-col items-center justify-center p-14 border rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Parsing document structure...
              </p>
            </div>
          ) : (
            <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="pdf"
          />
          )}
        </div>
      ) : (
        /* Workspace interface */
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 lg:gap-8 relative items-start h-[calc(100dvh-4.5rem)] lg:h-auto overflow-hidden lg:overflow-visible -mx-4 lg:mx-0">
          
          {/* Visual Canvas PDF Preview area (Full Canvas Mobile, Sticky Desktop) */}
          <div className="lg:col-span-7 flex flex-col flex-1 shrink-0 space-y-2 lg:space-y-4 lg:sticky lg:top-0 z-10 bg-[#f8fafc] dark:bg-[#030712] pt-2 lg:pt-0 pb-2 lg:pb-0 h-full lg:h-auto border-b lg:border-transparent border-slate-200 dark:border-slate-800 px-4 lg:px-0">
            <div className="flex items-center justify-between border-b pb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Interactive Page Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={activePageIndex === 0}
                  onClick={() => {
                    setActivePageIndex((prev) => Math.max(0, prev - 1));
                    setPlacedSig((prev) => prev ? { ...prev, pageIndex: Math.max(0, prev.pageIndex - 1) } : null);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Prev
                </button>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {activePageIndex + 1} / {pageCount}
                </span>
                <button
                  disabled={activePageIndex === pageCount - 1}
                  onClick={() => {
                    setActivePageIndex((prev) => Math.min(pageCount - 1, prev + 1));
                    setPlacedSig((prev) => prev ? { ...prev, pageIndex: Math.min(pageCount - 1, prev.pageIndex + 1) } : null);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-700 text-xs font-bold rounded"
                >
                  Next
                </button>
              </div>
            </div>

            {/* Document sheet body stack */}
            <div className="relative mx-auto border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 rounded-xl flex items-center justify-center flex-1 w-full lg:min-h-[350px] shadow-sm select-none overflow-hidden touch-none">
              
              <div className="relative overflow-auto max-h-[100%] max-w-[100%] flex items-center justify-center pointer-events-auto">
                <canvas
                  ref={renderCanvasRef}
                  className="rounded shadow bg-white transition-opacity duration-350 shrink-0"
                  style={{ opacity: renderingPage ? 0.6 : 1 }}
                />

                {/* Coordinate Click listener overlay layer */}
                {signatureAssetUrl && (
                  <div
                    onClick={handleCanvasOverlayClick}
                    className="absolute inset-0 z-10 cursor-crosshair"
                    title="Click anywhere to reposition your signature stamp"
                  >
                    {/* Live placed signature bounds preview element */}
                    {placedSig && placedSig.pageIndex === activePageIndex && (
                      <div
                        id="visible-signature-stamp"
                        style={{
                          left: `${placedSig.x}%`,
                          top: `${placedSig.y}%`,
                          width: `${125 * placedSig.scale}px`,
                          transformOrigin: 'top left'
                        }}
                        className="absolute border border-dashed border-emerald-500 bg-emerald-50/10 pointer-events-none p-1 shadow-md rounded"
                      >
                        <img
                          src={signatureAssetUrl}
                          className="w-full h-auto object-contain pointer-events-none"
                          alt="Live Signature Placement"
                        />
                        <div className="absolute -top-5 left-0 bg-emerald-600 text-white text-[9px] px-1 font-bold rounded shadow uppercase">
                          Placed
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Screen spinner */}
                {renderingPage && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/5 backdrop-blur-xs rounded">
                    <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 p-3 rounded-lg text-xs text-slate-500 leading-normal">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                {signatureAssetUrl 
                  ? "Click directly on the document preview above to place or move your signature stamp onto that exact position."
                  : "First create or draw a signature on the right-hand panel, then click Apply to enable document placement."}
              </p>
            </div>
          </div>

          {/* Setup FAB for Mobile */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className={`lg:hidden fixed bottom-8 right-6 p-4 bg-emerald-600 text-white rounded-full shadow-2xl z-40 transition-transform ${isSheetOpen ? 'scale-0' : 'scale-100 hover:scale-105 active:scale-95'} focus:outline-none`}
            title="Create Signature"
          >
            <Edit3 className="w-6 h-6" />
          </button>

          {/* Mobile Overlay Backdrop */}
          {isSheetOpen && (
            <div 
              className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
              onClick={() => setIsSheetOpen(false)}
            />
          )}

          {/* Signature Builder Panel & Settings Area (Bottom Sheet on Mobile, Column on Desktop) */}
          <div className={`
            fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:border-none p-5 lg:p-0 rounded-t-3xl lg:rounded-none
            transition-transform duration-300 transform ${isSheetOpen ? 'translate-y-0 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]' : 'translate-y-full pointer-events-none lg:pointer-events-auto'}
            lg:relative lg:translate-y-0 lg:z-auto lg:bg-transparent lg:col-span-5 space-y-6 flex-1 lg:overflow-visible pb-[max(env(safe-area-inset-bottom),1.5rem)] lg:pb-0 max-h-[85vh] lg:max-h-none overflow-y-auto px-5 lg:px-0 pt-6 lg:pt-0
          `}>
            
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6 lg:hidden" onClick={() => setIsSheetOpen(false)} />
            
            {/* Ink drawing & typing cards */}
            <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 lg:p-5 space-y-6">
              <div className="flex items-center gap-1.5 border-b pb-3 border-slate-100 dark:border-slate-800">
                <Edit3 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Signature Creator
                </h3>
              </div>

              {/* Tabs selector toggler */}
              <div id="sig-type-tabs" className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSigType('draw')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all focus:outline-none ${
                    sigType === 'draw'
                      ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  Draw Signature
                </button>
                <button
                  type="button"
                  onClick={() => setSigType('type')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-all focus:outline-none ${
                    sigType === 'type'
                      ? 'bg-white dark:bg-slate-850 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Type className="w-3.5 h-3.5" />
                  Type Signature
                </button>
              </div>

              {/* Ink Drawing Mode */}
              {sigType === 'draw' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                      Canvas Drawing Pad
                    </span>
                    <button
                      type="button"
                      onClick={clearDrawingPad}
                      className="text-[10px] font-black text-red-500 dark:text-red-400 hover:underline flex items-center gap-1 focus:outline-none"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Stroke
                    </button>
                  </div>
                  
                  <div className="border border-slate-300 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/50">
                    <canvas
                      ref={drawCanvasRef}
                      width={450}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={drawSignatureTick}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={drawSignatureTick}
                      onTouchEnd={stopDrawing}
                      className="w-full h-[140px] bg-white cursor-pen touch-none"
                    />
                  </div>
                </div>
              ) : (
                /* Text Typing Mode */
                <div className="space-y-4 animate-fadeIn">
                  <div id="type-entry-name" className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                      Full Name
                    </span>
                    <input
                      type="text"
                      maxLength={24}
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full text-sm px-3.5 py-2.5 border rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div id="type-style-font" className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                      Script Font Design ({AVAILABLE_FONTS.length} styles loaded)
                    </span>
                    <div className="grid grid-cols-2 gap-2 max-h-[148px] overflow-y-auto scrollbar pr-1">
                      {AVAILABLE_FONTS.map((font) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => setTypedFont(font.id)}
                          style={{ fontFamily: font.css }}
                          className={`py-1.5 px-2 border rounded-lg text-sm sm:text-base tracking-wide transition-all text-center truncate focus:outline-none ${
                            typedFont === font.id
                              ? 'border-emerald-500 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500 font-bold'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                          title={font.name}
                        >
                          {typedName.trim() || font.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Ink color select */}
              <div id="sign-color-select" className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Ink Color & Custom Picker
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { name: 'Pitch Black', code: '#020617', bg: 'bg-slate-950' },
                    { name: 'Royal Blue', code: '#2563eb', bg: 'bg-blue-600' },
                    { name: 'Vintage Purple', code: '#6366f1', bg: 'bg-indigo-500' }
                  ].map((color) => (
                    <button
                      key={color.code}
                      type="button"
                      onClick={() => setSigColor(color.code)}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md border focus:outline-none transition-all ${
                        sigColor === color.code
                          ? 'border-emerald-500 bg-emerald-50/10 text-slate-800 dark:text-slate-100 font-bold'
                          : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${color.bg} border border-white/20`} />
                      {color.name}
                    </button>
                  ))}

                  {/* HTML5 sleek integrated color picker input */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                    <label className="relative flex items-center justify-center w-7 h-7 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden cursor-pointer bg-white dark:bg-slate-900 hover:border-slate-400 transition-colors">
                      <input
                        type="color"
                        value={sigColor}
                        onChange={(e) => setSigColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        style={{ backgroundColor: sigColor }}
                        className="w-4 h-4 rounded shadow-2xs border border-slate-200/50 dark:border-slate-700/50"
                      />
                    </label>
                    <input
                      type="text"
                      maxLength={7}
                      value={sigColor}
                      onChange={(e) => setSigColor(e.target.value)}
                      placeholder="#020617"
                      className="text-[11px] font-mono font-semibold uppercase bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-1.5 py-1 w-20 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Apply Signature action button */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveSignatureAsset(false)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all focus:outline-none"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply ink to Document
                </button>

                {signatureAssetUrl && placedSig && (
                  <button
                    type="button"
                    onClick={() => handleSaveSignatureAsset(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all focus:outline-none cursor-pointer hover:border-emerald-500/40"
                    title="Render your new font style, name text, or picked color onto your active signature without resetting coordinates"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500 text-emerald-600 animate-spin-once" />
                    Reload Live Signature Properties
                  </button>
                )}
              </div>
            </div>

            {/* Position coordinate sliders (Active when signature exists) */}
            {placedSig && signatureAssetUrl && (
              <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-5 space-y-5 animate-fadeIn">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                  Reposition Stamp
                </h3>

                <div className="space-y-4">
                  {/* Aspect stamp scaling slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                      <span>Stamp Size (Scale)</span>
                      <span className="font-mono">{placedSig.scale.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.1"
                      value={placedSig.scale}
                      onChange={(e) => adjustScale(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 cursor-ew-resize h-1 bg-slate-100 dark:bg-slate-850 rounded"
                    />
                  </div>

                  {/* Positioning Coordinate sliders */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Horiz. X</span>
                        <span className="font-mono">{Math.round(placedSig.x)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="1"
                        value={placedSig.x}
                        onChange={(e) => adjustX(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-ew-resize h-1 bg-slate-100 dark:bg-slate-850 rounded"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Vert. Y</span>
                        <span className="font-mono">{Math.round(placedSig.y)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="90"
                        step="1"
                        value={placedSig.y}
                        onChange={(e) => adjustY(parseInt(e.target.value))}
                        className="w-full accent-emerald-500 cursor-ew-resize h-1 bg-slate-100 dark:bg-slate-850 rounded"
                      />
                    </div>
                  </div>
                </div>

                {processing && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg text-center animate-pulse border border-emerald-100 dark:border-emerald-900/30">
                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-emerald-600 mb-1" />
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{progressText}</span>
                  </div>
                )}

                {/* Final burn down CTA button */}
                <button
                  type="button"
                  onClick={burnAndCompilePDF}
                  disabled={processing}
                  className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow focus:ring-2 focus:ring-slate-500 cursor-pointer"
                >
                  {processing ? (
                    'Burning digital signature and recompiling...'
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4 text-emerald-400" />
                      Sign PDF & Download Document
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
