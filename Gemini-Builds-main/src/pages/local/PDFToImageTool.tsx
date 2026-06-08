import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import {
  ChevronLeft,
  FileImage,
  Image as ImageIcon,
  Download,
  Loader2,
  Settings,
  Archive,
  RefreshCw,
  Zap,
  Layers,
  FileText
} from 'lucide-react';

interface PDFToImageToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

export default function PDFToImageTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: PDFToImageToolProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  
  // Settings
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [scale, setScale] = useState<number>(1.5); // 1.0x, 1.5x, 2.0x, 2.5x crispness
  const [prefix, setPrefix] = useState<string>('page');

  // App running statuses
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clean object url on unload
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Handle PDF file selection
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setErrorMsg(null);
    setPdfDoc(null);
    setPageCount(0);

    try {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      // Extract filename minus extension for prefix default
      const dotIndex = selectedFile.name.lastIndexOf('.');
      const rawName = dotIndex !== -1 ? selectedFile.name.substring(0, dotIndex) : selectedFile.name;
      setPrefix(rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'));

      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      onFileLoaded?.(selectedFile, doc.numPages);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Failed to read PDF. This file may be secured, encrypted, or corrupted.');
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

  // Core ZIP Compilation & Image Renderer
  const compileZIP = async () => {
    if (!pdfDoc) return;
    setProcessing(true);
    setProgressText('Initializing pipeline...');

    try {
      const zip = new JSZip();

      for (let i = 1; i <= pageCount; i++) {
        setProgressText(`Rendering page ${i} of ${pageCount}...`);
        const page = await pdfDoc.getPage(i);

        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`Could not construct context for page ${i}`);

        // Draw onto local canvas
        await page.render({
          canvasContext: ctx,
          viewport: viewport
        } as any).promise;

        const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
        const fileExt = exportFormat;

        // Extract blob bytes
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), mimeType, 0.95);
        });

        if (blob) {
          const formattedIndex = String(i).padStart(3, '0');
          zip.file(`${prefix}_${formattedIndex}.${fileExt}`, blob);
        }
      }

      setProgressText('Compressing image files into ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const dlUrl = URL.createObjectURL(zipBlob);

      // Download
      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = `${prefix}_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);
    } catch (err) {
      console.error(err);
      alert('Failed to extract images. Verify that this PDF is fully non-encrypted.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div id="pdf-to-image-view" className="space-y-6 max-w-5xl mx-auto py-2">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Title Strip Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1.5">
          <button
            onClick={onBackToDashboard}
            className="group inline-flex items-center text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            PDF to Image Converter
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Convert standard PDF files into high-resolution JPG or PNG formats, cleanly bundled inside a single ZIP.
          </p>
        </div>

        {file && pdfDoc && (
          <button
            onClick={compileZIP}
            disabled={processing}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            {processing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Rendering ZIP...
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                Render & Download ZIP
              </>
            )}
          </button>
        )}
      </div>

      {!file ? (
        /* Upload module */
        <div className="max-w-xl mx-auto py-10">
          {loadingFile ? (
            <div className="flex flex-col items-center justify-center p-14 border rounded-2xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                Parsing PDF layout structure...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/35 rounded-lg text-xs leading-normal">
                  {errorMsg}
                </div>
              )}
              <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="pdf"
          />
            </div>
          )}
        </div>
      ) : (
        /* Render Grid Split working screen */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* File summary and progress card */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-500" />
                Document Metadata
              </h3>
              <button
                onClick={() => {
                  setFile(null);
                  if (fileUrl) URL.revokeObjectURL(fileUrl);
                  setFileUrl(null);
                  setPdfDoc(null);
                }}
                className="text-xs text-red-500 hover:underline font-bold"
              >
                Choose Another File
              </button>
            </div>

            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-xl">
                  <FileImage className="w-6 h-6" />
                </div>
                <div className="space-y-1 truncate-wrap">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate pr-6" title={file.name}>
                    {file.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    Size: {(file.size / (1024 * 1024)).toFixed(2)} MB • {pageCount} Page(s)
                  </p>
                </div>
              </div>

              {/* Status and instruction strip */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg text-xs text-slate-600 dark:text-slate-300 leading-normal border border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">How it works</span>
                Every single page of the document will be rasterized to an HTMLCanvas inside this sandbox, and then compressed into a high-utility ZIP package. Works offline and protects personal data.
              </div>
            </div>
          </div>

          {/* Export Configurations Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-emerald-500" />
                Image Export Options
              </h3>

              {/* Format selection */}
              <div id="export-format-select" className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Export Format
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setExportFormat('png')}
                    className={`py-2 px-3 border rounded-lg text-xs font-bold tracking-wider text-center focus:outline-none ${
                      exportFormat === 'png'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    PNG (Lossless)
                  </button>
                  <button
                    onClick={() => setExportFormat('jpeg')}
                    className={`py-2 px-3 border rounded-lg text-xs font-bold tracking-wider text-center focus:outline-none ${
                      exportFormat === 'jpeg'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    JPEG (Compressed)
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {exportFormat === 'png'
                    ? 'Excellent quality and transparency preservation layout.'
                    : 'Ideal for photographically rich documents and light files.'}
                </p>
              </div>

              {/* Resolution settings */}
              <div id="export-scale-select" className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Image Density (Resolution)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: '1.0x Standard', value: 1.0 },
                    { label: '1.5x Medium', value: 1.5 },
                    { label: '2.0x High', value: 2.0 },
                    { label: '2.5x Max', value: 2.5 }
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setScale(item.value)}
                      className={`py-1.5 px-1 border rounded-lg text-[10px] font-bold transition-all text-center focus:outline-none ${
                        scale === item.value
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {item.value.toFixed(1)}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Filename Prefix template */}
              <div id="export-prefix-input" className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Image Name Prefix
                </span>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="Prefix text"
                  className="w-full text-xs font-mono font-bold px-3 py-2 border rounded-lg border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 select-none">
                  Filename format: <span className="font-mono text-[9px] font-bold text-slate-500">{prefix}_001.{exportFormat}</span>
                </p>
              </div>

              {/* Progress and indicators */}
              {processing && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl space-y-2 animate-pulse text-center">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Active Extraction</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono leading-normal">
                    {progressText}
                  </p>
                </div>
              )}

              {/* Download CTA */}
              <button
                onClick={compileZIP}
                disabled={processing}
                className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow focus:ring-2 focus:ring-slate-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Baking zip archival bundle...
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-emerald-400" />
                    Convert Document with {scale.toFixed(1)}x Quality
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
