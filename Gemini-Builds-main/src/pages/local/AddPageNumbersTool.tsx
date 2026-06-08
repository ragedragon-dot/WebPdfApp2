import React, { useState, useEffect, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  ChevronLeft, 
  Hash, 
  Download, 
  Loader2, 
  FileText, 
  Settings, 
  X,
  Sliders,
  Sparkles
} from 'lucide-react';

interface AddPageNumbersToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

type PositionType = 'bottom-center' | 'bottom-right' | 'top-center' | 'top-right';
type FormatType = 'page-x' | 'page-x-of-y';

export default function AddPageNumbersTool({ 
  onBackToDashboard, 
  initialFile = null,
  onFileLoaded 
}: AddPageNumbersToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Configuration options state
  const [position, setPosition] = useState<PositionType>('bottom-center');
  const [format, setFormat] = useState<FormatType>('page-x-of-y');
  const [margin, setMargin] = useState<number>(36); // standard 0.5 inch (36pt)
  const [fontSize, setFontSize] = useState<number>(10);
  const [textColorHex, setTextColorHex] = useState<string>('#475569'); // Slate-600
  
  // App work state
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  // Memory lifecycle cleanup
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setPageCount(0);
    
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
      alert('Error analyzing file. Please import a standard, unlocked PDF.');
      setFile(null);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    } finally {
      setLoadingFile(false);
    }
  }, [fileUrl, onFileLoaded]);

  // Hook initial file if passed from dashboard
  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, handleFileSelected]);

  // Convert Hex string color to pdf-lib rgb fractional scale (0-1)
  const hexToRgb = (hex: string) => {
    let r = 71, g = 85, b = 105; // slate-600 defaults
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (match && match.length === 3) {
      r = parseInt(match[0], 16);
      g = parseInt(match[1], 16);
      b = parseInt(match[2], 16);
    }
    return rgb(r / 255, g / 255, b / 255);
  };

  const handleAddPageNumbers = async () => {
    if (!file) return;

    setProcessing(true);
    setProgressText('Loading PDF Document indexes into core...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const totalPages = pages.length;

      setProgressText('Embedding typography engine components...');
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pageNumberColor = hexToRgb(textColorHex);

      setProgressText('Calculating coordinates & rendering pages sequentially...');
      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const pageNum = i + 1;
        const { width, height } = page.getSize();

        // Build string content based on format choice
        const text = format === 'page-x' 
          ? `Page ${pageNum}` 
          : `Page ${pageNum} of ${totalPages}`;

        const textWidth = helveticaFont.widthOfTextAtSize(text, fontSize);

        // Compute coordinate mappings
        let x = 0;
        let y = 0;

        switch (position) {
          case 'bottom-center':
            x = (width - textWidth) / 2;
            y = margin;
            break;
          case 'bottom-right':
            x = width - textWidth - margin;
            y = margin;
            break;
          case 'top-center':
            x = (width - textWidth) / 2;
            y = height - margin - fontSize;
            break;
          case 'top-right':
            x = width - textWidth - margin;
            y = height - margin - fontSize;
            break;
        }

        // Write page node
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: helveticaFont,
          color: pageNumberColor,
        });
      }

      setProgressText('Baking and saving compiled records...');
      const compiledBytes = await pdfDoc.save();
      
      setProgressText('Download initialization starting...');
      const blob = new Blob([compiledBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      const baseName = file.name.endsWith('.pdf') ? file.name.substring(0, file.name.length - 4) : file.name;
      link.download = `${baseName}_numbered_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 3000);

    } catch (e: any) {
      console.error(e);
      alert(`Stamping Failure: ${e?.message || 'Error occurred while drawing page indices.'}`);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPageCount(0);
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

  return (
    <div id="pagenum-tool-root" className="max-w-4xl mx-auto space-y-6">
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
          <Hash className="w-3.5 h-3.5" /> Pagination Stamp Node
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Add Page Numbers
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xl">
          Apply elegant headers or footers with automated numbers across your PDF. Perfect for reports, ebooks, and structured folders.
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
          {/* File details and Live Layout settings */}
          <div className="md:col-span-4 space-y-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350 flex items-center gap-1.5 font-sans">
                  <Sliders className="w-4 h-4 text-emerald-600" /> Options Panel
                </span>
                <button
                  onClick={handleClear}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Position Parameter input */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                  Stamp Position
                </label>
                <select
                  id="page-numbers-position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as PositionType)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:border-emerald-500 font-sans text-slate-700 dark:text-slate-200"
                >
                  <option value="bottom-center">Bottom-Center</option>
                  <option value="bottom-right">Bottom-Right</option>
                  <option value="top-center">Top-Center</option>
                  <option value="top-right">Top-Right</option>
                </select>
              </div>

              {/* Format Parameter input */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                  Numbering Format
                </label>
                <select
                  id="page-numbers-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as FormatType)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-xl focus:outline-none focus:border-emerald-500 font-sans text-slate-700 dark:text-slate-200"
                >
                  <option value="page-x">Page X</option>
                  <option value="page-x-of-y">Page X of Y</option>
                </select>
              </div>

              {/* Slider for Margin Offset */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">
                  <span>Margin Offset</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{margin}px</span>
                </div>
                <input
                  id="page-numbers-margin-slider"
                  type="range"
                  min={12}
                  max={100}
                  step={4}
                  value={margin}
                  onChange={(e) => setMargin(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 dark:accent-emerald-450 cursor-pointer"
                />
                <span className="text-[9px] text-slate-450 dark:text-slate-500 leading-normal block">
                  Defines minimum distance in pixels from the edge boundaries.
                </span>
              </div>

              {/* Font Size Parameter Input */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">
                  <span>Font Size</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{fontSize}pt</span>
                </div>
                <input
                  id="page-numbers-fontsize-slider"
                  type="range"
                  min={8}
                  max={24}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-emerald-600 dark:accent-emerald-450 cursor-pointer"
                />
              </div>

              {/* Color Selector */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                  Stamp Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="page-numbers-color-picker"
                    type="color"
                    value={textColorHex}
                    onChange={(e) => setTextColorHex(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-slate-200"
                  />
                  <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-350">
                    {textColorHex.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Document Preview and download Action area */}
          <div className="md:col-span-8 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/35 text-emerald-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {file.name}
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">
                    Size: {formatSize(file.size)} • Total indices: <span className="text-emerald-600 font-bold font-sans">{pageCount} Pages</span>
                  </p>
                </div>
              </div>

              {/* Mini visual mockup card showcasing relative positioning */}
              <div className="relative border border-slate-250 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl p-4 flex flex-col justify-between min-h-[190px] text-center select-none overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
                  <Hash className="w-40 h-40 font-mono" />
                </div>

                {/* Top positioning row */}
                <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                  <div className={`p-1.5 rounded transition-all ${
                    position === 'top-center' ? 'hidden' : 'opacity-0'
                  }`}>
                    Placeholder
                  </div>
                  <div className={`p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-semibold transition-all ${
                    position === 'top-center' ? 'opacity-100 scale-105' : 'opacity-20 text-slate-400 border-dashed border-slate-300'
                  }`}>
                    {format === 'page-x' ? 'Page X' : `Page 1 of ${pageCount || 'Y'}`}
                  </div>
                  <div className={`p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-semibold transition-all ${
                    position === 'top-right' ? 'opacity-100 scale-105' : 'opacity-20 text-slate-400 border-dashed border-slate-300'
                  }`}>
                    {format === 'page-x' ? 'Page X' : `Page 1 of ${pageCount || 'Y'}`}
                  </div>
                </div>

                {/* Mock middle elements */}
                <div className="py-4 px-6 text-center space-y-2">
                  <p className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                    Pagination Coordinates Mockup
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-normal">
                    This interactive schema displays where your pagination stamp will be drawn relative to individual layout dimensions.
                  </p>
                </div>

                {/* Bottom positioning row */}
                <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                  <div className="p-1.5 opacity-0">Placeholder</div>
                  <div className={`p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-semibold transition-all ${
                    position === 'bottom-center' ? 'opacity-100 scale-105' : 'opacity-20 text-slate-400 border-dashed border-slate-300'
                  }`}>
                    {format === 'page-x' ? 'Page X' : `Page 1 of ${pageCount || 'Y'}`}
                  </div>
                  <div className={`p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-semibold transition-all ${
                    position === 'bottom-right' ? 'opacity-100 scale-105' : 'opacity-20 text-slate-400 border-dashed border-slate-300'
                  }`}>
                    {format === 'page-x' ? 'Page X' : `Page 1 of ${pageCount || 'Y'}`}
                  </div>
                </div>
              </div>

              {/* Compile and Download buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={handleClear}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl"
                >
                  Clear File
                </button>
                <button
                  onClick={handleAddPageNumbers}
                  disabled={processing}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow transition-all hover:scale-103 active:scale-97 disabled:opacity-45 disabled:scale-100 cursor-pointer"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rendering Numbers...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Stamp & Download PDF
                    </>
                  )}
                </button>
              </div>

              {processing && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-3 text-center space-y-1 animate-pulse">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">
                    Workspace Logs
                  </span>
                  <div className="text-[10px] text-slate-650 dark:text-slate-350 font-mono">
                    {progressText}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
