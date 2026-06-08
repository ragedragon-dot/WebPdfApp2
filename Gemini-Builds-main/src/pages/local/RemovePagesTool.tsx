import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import PDFThumbnail from '../../components/PDFThumbnail';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  FileText, 
  Trash2, 
  ChevronLeft, 
  Download, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  Undo2,
  CheckSquare,
  Square
} from 'lucide-react';

// Configure the pdfjs worker URL with modern jsdelivr ESM path
const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

interface RemovePagesToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

export default function RemovePagesTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: RemovePagesToolProps) {
  // Main states
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  
  // Indices are 0-based for internal state array (representing. page index)
  const [excludedPages, setExcludedPages] = useState<number[]>([]);
  
  // App UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manage revocation of URL object when file changes or unmounts
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  // Load PDF file via pdfjs-dist
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoading(true);
    setLoadingText('Analyzing document metadata...');
    setErrorMsg(null);
    setExcludedPages([]);

    try {
      // 1. Create a clean local ObjectURL
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      // 2. Load PDF document proxy to read length
      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      
      setPdfDocProxy(doc);
      setPageCount(doc.numPages);
      onFileLoaded?.(selectedFile, doc.numPages);
    } catch (err: any) {
      console.error('Error parsing PDF file:', err);
      if (err.message && err.message.includes('Password')) {
        setErrorMsg('This PDF is password protected. Please unlock or decrypt it first.');
      } else {
        setErrorMsg('Failed to process. This file may be corrupted, invalid, or encrypted.');
      }
      setFile(null);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  }, [fileUrl, onFileLoaded]);

  // Handle initialization of file if provided via state
  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, handleFileSelected]);

  // Toggle page excision
  const togglePageExclude = (pageIdx: number) => {
    setExcludedPages((prev) => {
      if (prev.includes(pageIdx)) {
        return prev.filter((idx) => idx !== pageIdx);
      }
      // Guarantee we don't exclude ALL pages
      if (prev.length === pageCount - 1) {
        alert("You must keep at least one page in your document!");
        return prev;
      }
      return [...prev, pageIdx];
    });
  };

  // Select all or Clear all exclusions
  const clearExclusions = () => setExcludedPages([]);
  const excludeAllExceptFirst = () => {
    const allExceptFirst = Array.from({ length: pageCount - 1 }, (_, i) => i + 1);
    setExcludedPages(allExceptFirst);
  };

  // Convert arrayBuffer and execute the main page deletion using pdf-lib
  const handleProcessAndDownload = async () => {
    if (!file || excludedPages.length === 0) return;
    
    setLoading(true);
    setLoadingText('Saving and compiling new PDF document...');
    
    try {
      // 1. Convert file object into native array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // 2. Load bytes into pdfDocs in pdf-lib
      const sourcePdfDoc = await PDFDocument.load(arrayBuffer);
      const targetPdfDoc = await PDFDocument.create();

      // 3. Compile target indices
      const keptPageIndices: number[] = [];
      for (let i = 0; i < pageCount; i++) {
        if (!excludedPages.includes(i)) {
          keptPageIndices.push(i);
        }
      }

      if (keptPageIndices.length === 0) {
        throw new Error("Cannot save close to 0 pages.");
      }

      // 4. Copy and paste pages
      const copiedPages = await targetPdfDoc.copyPages(sourcePdfDoc, keptPageIndices);
      copiedPages.forEach((page) => targetPdfDoc.addPage(page));

      // 5. Save document bytes & generate ObjectURL downlader
      const resultBytes = await targetPdfDoc.save();
      const resultBlob = new Blob([resultBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(resultBlob);

      // Create download trigger
      const extensionIndex = file.name.lastIndexOf('.');
      const baseName = extensionIndex !== -1 ? file.name.substring(0, extensionIndex) : file.name;
      const downloadName = `${baseName}_edited.pdf`;

      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Instantly revoke after download execution to avoid storage growth
      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);

    } catch (err: any) {
      console.error('Error generating modified PDF:', err);
      alert(`Failed to compile PDF: ${err?.message || 'Unknown error during page adjustment.'}`);
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  // Clear selections and go back to start
  const handleReset = () => {
    setFile(null);
    setPdfDocProxy(null);
    setPageCount(0);
    setExcludedPages([]);
    setErrorMsg(null);
    if (fileUrl) {
      URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    }
  };

  const isSaving = !!file && loading && (loadingText.includes('Saving') || loadingText.includes('compiling'));

  return (
    <div id="remove-pages-root" className="max-w-6xl mx-auto space-y-6 py-2">
      <ProcessingOverlay isOpen={isSaving} progressText={loadingText} />
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button
          id="btn-back-dashboard"
          onClick={onBackToDashboard}
          className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors gap-1.5 focus:outline-none"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        
        {file && (
          <span className="text-xs text-slate-500 font-mono flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-slate-100 dark:border-slate-850">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </span>
        )}
      </div>

      {/* Main Container Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 sm:p-8">
        
        {/* Loading Global Overlay */}
        {loading && !isSaving && (
          <div id="processing-overlay" className="absolute inset-0 bg-white/90 dark:bg-slate-950/90 z-50 flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Processing Document
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm text-center">
              {loadingText || 'Just a moment while we process the document contents locally...'}
            </p>
          </div>
        )}

        {/* 1. File Upload Screen if no file loaded */}
        {!file ? (
          <div className="space-y-6 max-w-xl mx-auto py-4">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Remove PDF Pages
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 px-4">
                Upload your document to display scroll-loaded visual thumbnails. Tap or hover over any thumbnail to designate it for deletion.
              </p>
            </div>

            {errorMsg && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 dynamic-shrink" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-red-800 dark:text-red-300">Could Not Open File</h4>
                  <p className="text-[11px] text-red-700 dark:text-red-400 font-sans leading-relaxed">
                    {errorMsg}
                  </p>
                </div>
              </div>
            )}

            <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="pdf"
          />
          </div>
        ) : (
          /* 2. Visual Grid Page Selection Mode */
          <div className="space-y-6">
            
            {/* Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Designate Pages to Exclude
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {excludedPages.length} of {pageCount} pages marked for exclusion ({pageCount - excludedPages.length} pages remaining).
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn-quick-clear-exclusions"
                  onClick={clearExclusions}
                  disabled={excludedPages.length === 0}
                  className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  <Square className="w-3.5 h-3.5 mr-1" /> Keep All
                </button>

                <button
                  id="btn-quick-exclude-except-first"
                  onClick={excludeAllExceptFirst}
                  disabled={excludedPages.length === pageCount - 1}
                  className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                >
                  <CheckSquare className="w-3.5 h-3.5 mr-1" /> Exclude Tail
                </button>

                <button
                  id="btn-reset-file"
                  onClick={handleReset}
                  className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Swap File
                </button>

                <button
                  id="btn-compile-download"
                  onClick={handleProcessAndDownload}
                  disabled={excludedPages.length === 0}
                  className={`inline-flex items-center text-xs font-bold px-4 py-2 rounded-lg text-white shadow focus:outline-none transition-all ${
                    excludedPages.length === 0
                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Compile & Download
                </button>
              </div>
            </div>

            {/* Visual Indication of the Action */}
            {excludedPages.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/40 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-1.5 font-sans">
                  <Trash2 className="w-4 h-4 text-amber-600" />
                  Warning: compiling will create a brand new PDF without the {excludedPages.length} marked {excludedPages.length === 1 ? 'page' : 'pages'}.
                </span>
                <button 
                  onClick={clearExclusions}
                  className="font-bold underline text-amber-900 dark:text-amber-200 hover:opacity-80 cursor-pointer"
                >
                  Keep All
                </button>
              </div>
            )}

            {/* Grid distribution */}
            <div 
              id="pdf-thumbnails-grid" 
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 max-h-[560px] overflow-y-auto pr-3 scrollbar"
            >
              {Array.from({ length: pageCount }, (_, idx) => {
                const pageNum = idx + 1;
                const isExcluded = excludedPages.includes(idx);
                return (
                  <PDFThumbnail
                    key={pageNum}
                    pdfDocument={pdfDocProxy}
                    pageNumber={pageNum}
                    isExcluded={isExcluded}
                    onToggleExclude={() => togglePageExclude(idx)}
                  />
                );
              })}
            </div>

            {/* Instructions */}
            <div className="text-center text-[10px] text-slate-400 mt-2 font-sans">
              * Thumbnails load dynamically as you scroll. Click any page card to toggle exclusion status.
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
