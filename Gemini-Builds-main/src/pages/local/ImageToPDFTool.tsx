import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument, PageSizes } from 'pdf-lib';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import {
  ChevronLeft,
  Image as ImageIcon,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Plus,
  Compass,
  Layout,
  Maximize2,
  FileImage,
  Sparkles,
  Download,
  Loader2,
  Grid
} from 'lucide-react';

interface ImageToPDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

interface ImageItem {
  id: string;
  file: File;
  objectUrl: string;
  name: string;
  rotation: number; // 0, 90, 180, 270 degrees
}

export default function ImageToPDFTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: ImageToPDFToolProps) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'A4' | 'LETTER' | 'IMAGE'>('A4');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [margin, setMargin] = useState<number>(20); // 0, 10, 20, 40 px  
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      objectUrl: URL.createObjectURL(file),
      name: file.name,
      rotation: 0
    }));
    setImages((prev) => [...prev, ...newItems]);
    if (acceptedFiles.length > 0) {
      onFileLoaded?.(acceptedFiles[0], acceptedFiles.length);
    }
  }, [onFileLoaded]);

  // Handle initialization of file if provided via state
  useEffect(() => {
    if (initialFile) {
      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        file: initialFile,
        objectUrl: URL.createObjectURL(initialFile),
        name: initialFile.name,
        rotation: 0
      };
      setImages((prev) => {
        if (prev.some((img) => img.name === initialFile.name && img.file.size === initialFile.size)) {
          return prev;
        }
        return [...prev, newItem];
      });
    }
  }, [initialFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    multiple: true
  } as any);

  // Revoke URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.objectUrl));
    };
  }, []);

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === images.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setImages((prev) => {
      const clone = [...prev];
      const temp = clone[index];
      clone[index] = clone[targetIndex];
      clone[targetIndex] = temp;
      return clone;
    });
  };

  const handleRotateImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  // Process all images to standard Canvas, rotate, and write to PDF
  const compilePDF = async () => {
    if (images.length === 0) return;
    setProcessing(true);
    setProgressText('Preparing environment...');

    try {
      const pdfDoc = await PDFDocument.create();

      for (let index = 0; index < images.length; index++) {
        const item = images[index];
        setProgressText(`Processing image ${index + 1} of ${images.length}: ${item.name}...`);

        // 1. Create helper image element to load and measure
        const img = new Image();
        img.src = item.objectUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        // 2. Draw on offscreen canvas to bake rotations and get clean JPEG bytes
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create offscreen canvas context.');

        // Determine rotated dimension
        const isRotated90or270 = item.rotation === 90 || item.rotation === 270;
        const width = isRotated90or270 ? img.height : img.width;
        const height = isRotated90or270 ? img.width : img.height;

        canvas.width = width;
        canvas.height = height;

        // Perform rotation transformations
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        // Export as High-Quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const response = await fetch(dataUrl);
        const jpegBytes = await response.arrayBuffer();

        // 3. Embed image in PDF Document
        const pdfImage = await pdfDoc.embedJpg(jpegBytes);

        // 4. Determine Page size
        let pw = 0;
        let ph = 0;

        if (pageSize === 'A4') {
          const size = PageSizes.A4;
          pw = orientation === 'PORTRAIT' ? size[0] : size[1];
          ph = orientation === 'PORTRAIT' ? size[1] : size[0];
        } else if (pageSize === 'LETTER') {
          const size = PageSizes.Letter;
          pw = orientation === 'PORTRAIT' ? size[0] : size[1];
          ph = orientation === 'PORTRAIT' ? size[1] : size[0];
        } else {
          // 'IMAGE' (Auto) - Match rotated image dimensions with modest default resolution scaling
          const ratio = width / height;
          // Scale to friendly dimensions around 1200 max scale
          if (width > height) {
            pw = Math.min(1200, width);
            ph = pw / ratio;
          } else {
            ph = Math.min(1200, height);
            pw = ph * ratio;
          }
        }

        const page = pdfDoc.addPage([pw, ph]);

        // 5. Place image centering inside page margin
        const innerWidth = pw - margin * 2;
        const innerHeight = ph - margin * 2;

        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;

        // Aspect ratio preserve scaling
        const scale = Math.min(innerWidth / imgWidth, innerHeight / imgHeight);
        const finalW = imgWidth * scale;
        const finalH = imgHeight * scale;

        // Coordinates centered
        const finalX = margin + (innerWidth - finalW) / 2;
        const finalY = margin + (innerHeight - finalH) / 2;

        page.drawImage(pdfImage, {
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH
        });
      }

      setProgressText('Assembling document...');
      const resultBytes = await pdfDoc.save();
      const resultBlob = new Blob([resultBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(resultBlob);

      // Launch downloader
      const link = document.createElement('a');
      link.href = dlUrl;
      link.download = `images_converted_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);
    } catch (err) {
      console.error(err);
      alert('An error occurred while building your PDF file. Please verify file integrity.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div id="image-to-pdf-view" className="space-y-6 max-w-5xl mx-auto py-2">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Back button and title strip */}
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
            Image to PDF Layout
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Render and compile PNG, JPG, or WEBP photos into a polished, portable document layout.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <button
              onClick={compilePDF}
              disabled={processing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Compiling...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Compile & Download
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {images.length === 0 ? (
        /* Empty Upload Interface */
        <div className="max-w-xl mx-auto py-10">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 cursor-pointer transition-all duration-200 text-center flex flex-col items-center justify-center min-h-[260px] ${
              isDragActive
                ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500/50 bg-white dark:bg-slate-900'
            }`}
          >
            <input {...getInputProps()} />
            <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mb-4 group-hover:scale-105 transition-transform">
              <FileImage className="w-9 h-9 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Drag & drop images here
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
              Supports PNG, JPG, JPEG, and WEBP formats. Mix and match formats to place on multiple pages.
            </p>
            <span className="text-[10px] font-bold text-slate-400 mt-4 px-3 py-1 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800 font-mono">
              Purely local file conversion block
            </span>
          </div>
        </div>
      ) : (
        /* Dynamic Split Working Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Photos Grid Stream Layout */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between border-b pb-2 mb-2">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-emerald-600" />
                Image Sequence ({images.length} {images.length === 1 ? 'image' : 'images'})
              </h3>
              <button
                onClick={() => setImages([])}
                className="text-xs font-bold text-red-500 dark:text-red-400/80 hover:underline"
              >
                Clear All
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  id={`image-card-${img.id}`}
                  className="relative group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shadow-xs"
                >
                  {/* Aspect preserved dynamic thumbnails */}
                  <div className="aspect-square bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-3 relative group-hover:bg-slate-100/50 dark:group-hover:bg-slate-900 transition-colors">
                    <img
                      src={img.objectUrl}
                      alt={img.name}
                      style={{ transform: `rotate(${img.rotation}deg)` }}
                      className="max-h-full max-w-full object-contain rounded shadow-xs transition-transform duration-200"
                    />
                    
                    {/* Badge item listing indices */}
                    <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[11px] font-black h-5 px-1.5 min-w-5 rounded flex items-center justify-center font-mono select-none">
                      #{index + 1}
                    </div>

                    {/* Quick removal and rotate button indicators */}
                    <div className="absolute top-2 right-2 flex gap-1opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleRotateImage(img.id)}
                        title="Rotate 90deg CW"
                        className="p-1 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-200 shadow-xs focus:outline-none"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveImage(img.id)}
                        title="Delete Image"
                        className="p-1 bg-white hover:bg-red-50 text-red-600 rounded border border-slate-200 shadow-xs focus:outline-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Move Up Down items */}
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-[80px]" title={img.name}>
                      {img.name}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveImage(index, 'up')}
                        disabled={index === 0}
                        title="Move Page Up"
                        className="p-1 rounded bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 disabled:opacity-40 border border-slate-200/50 dark:border-slate-800"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveImage(index, 'down')}
                        disabled={index === images.length - 1}
                        title="Move Page Down"
                        className="p-1 rounded bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-350 disabled:opacity-40 border border-slate-200/50 dark:border-slate-800"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Append additional cards box */}
              <div
                {...getRootProps()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl hover:border-emerald-500/70 dark:hover:border-emerald-500/40 p-4 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] aspect-square text-slate-400 group hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5"
              >
                <input {...getInputProps()} />
                <Plus className="w-6 h-6 text-slate-400 group-hover:scale-110 transition-transform mb-1.5" />
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
                  Add Images
                </span>
                <span className="text-[9px] text-slate-400 text-center px-2 mt-0.5 leading-normal">
                  JPG, PNG, WEBP
                </span>
              </div>
            </div>
          </div>

          {/* Settings Options Layout Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div id="settings-strip" className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-5 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-emerald-500" />
                Page Settings
              </h3>

              {/* Page Format sizing */}
              <div id="option-size-select" className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Page Dimensions
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setPageSize('A4');
                    }}
                    className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all text-center focus:outline-none ${
                      pageSize === 'A4'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    A4 Size
                  </button>
                  <button
                    onClick={() => {
                      setPageSize('LETTER');
                    }}
                    className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all text-center focus:outline-none ${
                      pageSize === 'LETTER'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    Letter
                  </button>
                  <button
                    onClick={() => {
                      setPageSize('IMAGE');
                    }}
                    className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all text-center focus:outline-none ${
                      pageSize === 'IMAGE'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                    }`}
                  >
                    Match Image
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {pageSize === 'IMAGE'
                    ? 'Page scales precisely to the item shape with preservations.'
                    : 'Centers photos perfectly within standard sheets.'}
                </p>
              </div>

              {/* Layout Orientations and sheets details */}
              {pageSize !== 'IMAGE' && (
                <div id="option-orientation-select" className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                    Orientation
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrientation('PORTRAIT')}
                      className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all text-center focus:outline-none ${
                        orientation === 'PORTRAIT'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => setOrientation('LANDSCAPE')}
                      className={`py-2 px-3 border rounded-lg text-xs font-bold transition-all text-center focus:outline-none ${
                        orientation === 'LANDSCAPE'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              )}

              {/* Page padding margins option */}
              <div id="option-margin-select" className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
                  Margins Sizes
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'None', val: 0 },
                    { label: 'Thin', val: 10 },
                    { label: 'Medium', val: 20 },
                    { label: 'Thick', val: 40 }
                  ].map((m) => (
                    <button
                      key={m.label}
                      onClick={() => setMargin(m.val)}
                      className={`py-1.5 px-0 border rounded-lg text-xs font-semibold tracking-wide transition-all text-center focus:outline-none capitalize ${
                        margin === m.val
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compilation actions summaries */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 leading-normal space-y-1.5">
                <div className="flex justify-between font-medium">
                  <span>Input Files:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono font-bold">{images.length} item(s)</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Page Yield:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono font-bold">{images.length} page(s)</span>
                </div>
              </div>

              {/* Progress and compilation indicator boxes */}
              {processing && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 space-y-2 text-center animate-pulse">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Active Compilation</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-normal">
                    {progressText}
                  </p>
                </div>
              )}

              <button
                onClick={compilePDF}
                disabled={processing}
                className="w-full flex items-center justify-center gap-1.5 py-3 bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-extrabold shadow transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Building PDF bytes...
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-emerald-400" />
                    Compile and Generate PDF
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
