import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  ChevronLeft, 
  FileSearch, 
  FileText, 
  Copy, 
  Download, 
  Loader2, 
  Settings, 
  Check, 
  Sparkles,
  Zap,
  Flame,
  ArrowRight,
  X
} from 'lucide-react';

interface OCRPDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

type OCRMode = 'fast' | 'deep';

export default function OCRPDFTool({ 
  onBackToDashboard, 
  initialFile = null,
  onFileLoaded 
}: OCRPDFToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Lazy model/dependency states
  const [tesseractInstance, setTesseractInstance] = useState<any>(null);
  const [tesseractLoading, setTesseractLoading] = useState<boolean>(true);
  const [tesseractError, setTesseractError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const initTesseract = async () => {
      try {
        const module = await import('tesseract.js');
        if (active) {
          const loadedTesseract = module.default || module;
          if (!loadedTesseract || !loadedTesseract.recognize) {
            throw new Error("Invalid Tesseract module loaded.");
          }
          setTesseractInstance(loadedTesseract);
          setTesseractLoading(false);
        }
      } catch (err: any) {
        console.error("Failed to dynamically load tesseract.js:", err);
        if (active) {
          setTesseractError(err.message || "Failed to download OCR pattern parsing components.");
          setTesseractLoading(false);
        }
      }
    };
    initTesseract();
    return () => {
      active = false;
    };
  }, []);

  // App settings/state
  const [ocrMode, setOCRMode] = useState<OCRMode>('fast');
  const [extractedText, setExtractedText] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Lifecycles and memory cleans
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setPageCount(0);
    setExtractedText('');
    
    try {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      setPageCount(doc.numPages);
      
      onFileLoaded?.(selectedFile, doc.numPages);
    } catch (err: any) {
      console.error(err);
      alert('Error loading document. Please feed a non-secure regular single PDF file.');
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

  // Copy text action
  const handleCopyToClipboard = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Could not copy:", err);
    }
  };

  // Download raw extracted characters as TXT file
  const handleDownloadTxt = () => {
    if (!extractedText || !file) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const originalName = file.name.endsWith('.pdf') ? file.name.substring(0, file.name.length - 4) : file.name;
    link.download = `${originalName}_extracted_${ocrMode}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 2000);
  };

  // Perform Extract
  const startExtraction = async () => {
    if (!file || !fileUrl) return;

    setProcessing(true);
    setProgressText('Opening document rendering pipelines...');
    setExtractedText('');

    try {
      const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
      const doc = await loadingTask.promise;

      if (ocrMode === 'fast') {
        // Fast extract (native PDF text layer)
        let nativeTextJoined = '';
        for (let i = 1; i <= doc.numPages; i++) {
          setProgressText(`Reading native text objects: page ${i} of ${doc.numPages}...`);
          const page = await doc.getPage(i);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          
          nativeTextJoined += `--- PAGE ${i} ---\n${pageText || '[No native selectable characters on this page]'}\n\n`;
        }
        
        setExtractedText(nativeTextJoined.trim());
      } else {
        // Scanned Deep OCR via Tesseract.js (renders to high-dpi Canvas object client-side)
        let deepTextJoined = '';
        for (let i = 1; i <= doc.numPages; i++) {
          setProgressText(`Rendering page ${i} of ${doc.numPages} onto canvas workspace...`);
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 }); // 2.0 scale ensures sharp text profiles
          
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to instantiate local canvas rendering context.');

          // Render PDF frame on Canvas
          await page.render({
            canvasContext: ctx,
            viewport
          } as any).promise;

          setProgressText(`Launching client-side optical recognizer on page ${i} of ${doc.numPages}...`);
          
          if (!tesseractInstance) {
            throw new Error("The OCR machine learning engine has not materialized yet.");
          }
          
          const { data: { text } } = await tesseractInstance.recognize(canvas, 'eng', {
            logger: (m: any) => {
              if (m.status === 'recognizing text') {
                setProgressText(`Analyzing page ${i}/${doc.numPages}: ${Math.round(m.progress * 105) > 100 ? 100 : Math.round(m.progress * 100)}% compiled`);
              }
            }
          });

          deepTextJoined += `--- PAGE ${i} (DEEP OCR) ---\n${text}\n\n`;
        }
        
        setExtractedText(deepTextJoined.trim());
      }
    } catch (err: any) {
      console.error(err);
      alert(`OCR Pipeline Error: ${err?.message || 'Error occurred during character extraction.'}`);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPageCount(0);
    setExtractedText('');
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1000;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (tesseractLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs select-none">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-5 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
          <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">Initializing Machine Learning Engine...</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading dynamic OCR engine libraries for secure on-device document transcription...</p>
        </div>
      </div>
    );
  }

  if (tesseractError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600">
          <Loader2 className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">Initialization Failed</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {tesseractError}
        </p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-805 dark:hover:bg-slate-755 dark:text-slate-250 rounded-lg transition-colors cursor-pointer"
        >
          Back To Dashboard
        </button>
      </div>
    );
  }

  return (
    <div id="ocr-tool-root" className="max-w-4xl mx-auto space-y-6">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono uppercase bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/40">
          <FileSearch className="w-3.5 h-3.5" /> HTML5 Character OCR
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          OCR PDF & Document Text Extractor
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xl">
          Instantly grab text layers from digital PDFs or perform client-side deep optical scan matching for legacy hardcopy scans.
        </p>
      </div>

      {!file ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-xs">
          <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="pdf"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-5">
            {/* Input card files details */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-250 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-850 dark:text-slate-200 uppercase tracking-wider">
                  Settings Node
                </span>
                <button
                  onClick={handleClear}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg text-slate-500 scale-90">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-250 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">
                    {formatSize(file.size)} • {pageCount} Pages
                  </p>
                </div>
              </div>

              {/* Segmented control for selector modes */}
              <div className="space-y-2.5 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Extraction Mode
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/50 dark:border-slate-850">
                  <button
                    onClick={() => setOCRMode('fast')}
                    className={`py-2 px-1 text-[10px] font-extrabold uppercase rounded-lg text-center transition-all focus:outline-none cursor-pointer flex flex-col items-center gap-1 ${
                      ocrMode === 'fast'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${ocrMode === 'fast' ? 'text-amber-500' : 'text-slate-400'}`} />
                    Fast Native
                  </button>
                  <button
                    onClick={() => setOCRMode('deep')}
                    className={`py-2 px-1 text-[10px] font-extrabold uppercase rounded-lg text-center transition-all focus:outline-none cursor-pointer flex flex-col items-center gap-1 ${
                      ocrMode === 'deep'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                    }`}
                  >
                    <Flame className={`w-3.5 h-3.5 ${ocrMode === 'deep' ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                    Deep OCR Scan
                  </button>
                </div>
              </div>

              {/* Dynamic instruction logs based on mode selection */}
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-850">
                {ocrMode === 'fast' 
                  ? "Reconstructs unicode character structures instantly from text layers in standard PDF document nodes."
                  : "Generates high-definition picture layers onto a web canvas and OCR translates via Tesseract's web assembly client pipeline."
                }
              </p>

              <button
                onClick={startExtraction}
                disabled={processing}
                className="w-full py-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow transition-all hover:scale-102 active:scale-98 disabled:opacity-50 disabled:scale-100 cursor-pointer"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-emerald-355" />
                    Run Text Extraction
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results section */}
          <div className="md:col-span-8 flex flex-col h-full space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col flex-1 space-y-4 min-h-[350px]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Extracted Document Text Output
                </span>

                {extractedText && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyToClipboard}
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          Copy Text
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleDownloadTxt}
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-350 hover:text-emerald-505 flex items-center gap-1 bg-slate-50 dark:bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      Save TXT
                    </button>
                  </div>
                )}
              </div>

              {/* Inner logger display if processing, otherwise simple Textarea output */}
              {processing ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-350">
                    Executing browser text translation...
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 py-1 px-4 rounded bg-slate-50 dark:bg-slate-950 font-mono border border-slate-100 dark:border-slate-850">
                    {progressText}
                  </p>
                </div>
              ) : extractedText ? (
                <textarea
                  id="ocr-text-output-area"
                  readOnly
                  value={extractedText}
                  className="flex-1 w-full text-xs p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl font-mono text-slate-700 dark:text-slate-300 focus:outline-none resize-none scrollbar min-h-[300px]"
                  placeholder="Extracted character lines will materialize here..."
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-450 dark:text-slate-600 min-h-[290px]">
                  <FileSearch className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-450">Output Empty</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                    Choose an extraction mode in the parameters board and click "Run Text Extraction" to pull strings.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
