import React, { useState, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { useDropzone } from 'react-dropzone';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  ChevronLeft, 
  Combine, 
  Download, 
  Loader2, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Plus,
  Layers
} from 'lucide-react';

interface MergePDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

interface MergeItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

export default function MergePDFTool({ 
  onBackToDashboard, 
  initialFile = null,
  onFileLoaded 
}: MergePDFToolProps) {
  const [items, setItems] = useState<MergeItem[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Read page count for a file
  const getPageCount = async (file: File): Promise<number> => {
    try {
      const url = URL.createObjectURL(file);
      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      URL.revokeObjectURL(url);
      return doc.numPages;
    } catch (e) {
      console.error("Error reading page count:", e);
      return 0; // Return zero as a fallback
    }
  };

  const handleAddFiles = async (selectedFiles: File[]) => {
    setLoadingFile(true);
    const newItems: MergeItem[] = [];

    for (const f of selectedFiles) {
      const pageCount = await getPageCount(f);
      newItems.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        name: f.name,
        size: f.size,
        pageCount
      });
    }

    setItems((prev) => [...prev, ...newItems]);
    setLoadingFile(false);
  };

  // Convert initialFile on load
  useEffect(() => {
    if (initialFile) {
      handleAddFiles([initialFile]);
    }
  }, [initialFile]);

  // Handle Drag & Drop for multiple files
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      handleAddFiles(acceptedFiles);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true
  } as any);

  // Action: Move Up
  const moveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index - 1];
      copy[index - 1] = temp;
      return copy;
    });
  };

  // Action: Move Down
  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    setItems((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[index + 1];
      copy[index + 1] = temp;
      return copy;
    });
  };

  // Action: Remove File
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Action: Compile PDF
  const handleMerge = async () => {
    if (items.length < 2) {
      alert('Please add at least two PDF files to merge together.');
      return;
    }

    setProcessing(true);
    setProgressText('Preparing merged layout workspace...');

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setProgressText(`Importing pages from file ${i + 1} of ${items.length}: "${item.name}"...`);
        
        const arrayBuffer = await item.file.arrayBuffer();
        const srcDoc = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      setProgressText('Assembling document nodes & compiling...');
      const mergedBytes = await mergedPdf.save();
      
      setProgressText('Document structured! Triggering download...');
      const downloadBlob = new Blob([mergedBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(downloadBlob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Save to recent files history on our mock engine
      if (items.length > 0 && onFileLoaded) {
        onFileLoaded(items[0].file, mergedPdf.getPageCount());
      }

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 3000);

    } catch (e: any) {
      console.error(e);
      alert(`Synthesis failure: ${e?.message || 'Error occurred while loading or concatenating documents.'}`);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div id="merge-tool-root" className="max-w-4xl mx-auto space-y-6">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Header element */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs font-mono uppercase bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/40">
          <Combine className="w-3.5 h-3.5 animate-pulse" /> Client-Side Merger
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Merge PDF Documents
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xl">
          Combine multiple PDF files into one continuous, high-fidelity PDF instantly. Drag to sort, delete, and download with peace of mind.
        </p>
      </div>

      {/* Upload zone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 cursor-pointer text-center flex flex-col items-center justify-center min-h-[220px] transition-all duration-200 ${
              isDragActive
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-900/40'
            }`}
          >
            <input {...getInputProps()} />
            <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-full mb-3">
              <Plus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isDragActive ? "Drop them here!" : "Drag multiple PDFs"}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal px-2">
              or click to pick from computer
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-2.5 border border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
              Workspace Guidelines
            </span>
            <ul className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5 list-disc pl-3">
              <li>Arrange files sequentially from top to bottom.</li>
              <li>Page dimensions of imported documents will be fully preserved.</li>
              <li>Merge processes are fast and fully sandboxed.</li>
            </ul>
          </div>
        </div>

        {/* Selected files stack and compilation workspace */}
        <div className="md:col-span-2 space-y-4">
          {loadingFile && (
            <div className="flex items-center justify-center p-6 gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Resolving selected document metadata...
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center bg-white dark:bg-slate-900/20 text-slate-400">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2.5" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No PDF files added yet</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Drop multiple files into the left upload hub to construct a merge queue.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-widest">
                  Merge Queue ({items.length} {items.length === 1 ? 'file' : 'files'})
                </span>
                
                <button
                  onClick={() => setItems([])}
                  className="text-[10px] font-bold text-rose-500 dark:text-rose-450 hover:underline cursor-pointer"
                >
                  Clear Queue
                </button>
              </div>

              {/* Stack container of ordered files */}
              <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1 scrollbar">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    id={`merge-item-${item.id}`}
                    className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs transition-colors hover:border-emerald-500/20"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg scale-90 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate pr-2" title={item.name}>
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{formatSize(item.size)}</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                            {item.pageCount} {item.pageCount === 1 ? 'Page' : 'Pages'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sorting & deletion control button block */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className={`p-1.5 rounded-md border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveDown(index)}
                        disabled={index === items.length - 1}
                        className={`p-1.5 rounded-md border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed`}
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 rounded-md border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/20 dark:hover:text-rose-450 transition-colors cursor-pointer"
                        title="Delete from list"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action output controls */}
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={handleMerge}
                  disabled={items.length < 2 || processing}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl transition-all shadow-md hover:scale-103 active:scale-97 cursor-pointer disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed`}
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merge in progress...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download Combined PDF
                    </>
                  )}
                </button>
              </div>

              {processing && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center space-y-1.5 animate-pulse">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest block">
                    Workspace Logs
                  </span>
                  <div className="text-[10px] text-slate-650 dark:text-slate-350 font-mono text-center">
                    {progressText}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
