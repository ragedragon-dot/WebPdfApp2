import React, { useState, useEffect, useCallback } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  ChevronLeft,
  Stamp,
  Download,
  Loader2,
  FileText,
  FileLock,
  Compass,
  Settings,
  X,
  Plus,
  Type,
  ImageIcon,
  Trash2
} from 'lucide-react';

interface WatermarkToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

export default function WatermarkTool({ 
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: WatermarkToolProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);

  // Watermark parameters state
  const [stampType, setStampType] = useState<'text' | 'image'>('text');
  const [stampText, setStampText] = useState<string>('CONFIDENTIAL');
  const [textColor, setTextColor] = useState<string>('#ef4444'); // Tailwind red-500
  const [fontSize, setFontSize] = useState<number>(48);
  const [rotation, setRotation] = useState<number>(-45); // Degrees
  const [opacity, setOpacity] = useState<number>(0.25); // 0.1 to 0.9
  const [pageRange, setPageRange] = useState<'all' | 'first'>('all');
  const [position, setPosition] = useState<string>('Center');

  // Multi-image upload for image-watermark
  const [stampImageFile, setStampImageFile] = useState<File | null>(null);
  const [stampImageUrl, setStampImageUrl] = useState<string | null>(null);
  const [stampImageScale, setStampImageScale] = useState<number>(1.0);
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  // States
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Clean memory leaks
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      if (stampImageUrl) URL.revokeObjectURL(stampImageUrl);
    };
  }, [fileUrl, stampImageUrl]);

  const handleClearDocument = () => {
    setShowConfirmClear(true);
  };

  const confirmClearDocument = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setStampText('CONFIDENTIAL');
    setStampImageFile(null);
    if (stampImageUrl) URL.revokeObjectURL(stampImageUrl);
    setStampImageUrl(null);
    setPageCount(0);
  };

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
    } catch (err) {
      console.error(err);
      alert('Failed to analyze document. Select a raw healthy PDF document.');
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

  const handleImageWatermarkSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selected = files[0];
      setStampImageFile(selected);
      if (stampImageUrl) URL.revokeObjectURL(stampImageUrl);
      setStampImageUrl(URL.createObjectURL(selected));
    }
  };

  // Convert Hex string color to pdf-lib rgb fractional scale (0-1)
  const hexToRgb = (hex: string) => {
    let r = 239, g = 68, b = 68;
    const match = hex.replace('#', '').match(/.{1,2}/g);
    if (match && match.length === 3) {
      r = parseInt(match[0], 16);
      g = parseInt(match[1], 16);
      b = parseInt(match[2], 16);
    }
    return rgb(r / 255, g / 255, b / 255);
  };

  const getCoordinates = (pageWidth: number, pageHeight: number, contentW: number, contentH: number, pos: string) => {
    const margin = 30;
    // Calculate center of object because rotation pivots on origin,
    // wait PDF-lib text origin is bottom-left, but rotation pivots on translation point if we map it?
    // Actually, simple bounding box:
    let x = (pageWidth - contentW) / 2;
    // For text, y is baseline. Let's just approximate height bounding
    let y = (pageHeight - contentH) / 2;

    switch (pos) {
      case 'Top-Left': x = margin; y = pageHeight - contentH - margin; break;
      case 'Top-Center': x = (pageWidth - contentW) / 2; y = pageHeight - contentH - margin; break;
      case 'Top-Right': x = pageWidth - contentW - margin; y = pageHeight - contentH - margin; break;
      case 'Center-Left': x = margin; y = (pageHeight - contentH) / 2; break;
      case 'Center': x = (pageWidth - contentW) / 2; y = (pageHeight - contentH) / 2; break;
      case 'Center-Right': x = pageWidth - contentW - margin; y = (pageHeight - contentH) / 2; break;
      case 'Bottom-Left': x = margin; y = margin; break;
      case 'Bottom-Center': x = (pageWidth - contentW) / 2; y = margin; break;
      case 'Bottom-Right': x = pageWidth - contentW - margin; y = margin; break;
      default: break;
    }
    return { x, y };
  };

  const cssPositionClass = (pos: string) => {
     switch (pos) {
      case 'Top-Left': return 'top-8 left-8 transform-none';
      case 'Top-Center': return 'top-8 left-1/2 -translate-x-1/2';
      case 'Top-Right': return 'top-8 right-8 transform-none';
      case 'Center-Left': return 'top-1/2 -translate-y-1/2 left-8';
      case 'Center': return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
      case 'Center-Right': return 'top-1/2 -translate-y-1/2 right-8';
      case 'Bottom-Left': return 'bottom-8 left-8 transform-none';
      case 'Bottom-Center': return 'bottom-8 left-1/2 -translate-x-1/2';
      case 'Bottom-Right': return 'bottom-8 right-8 transform-none';
      default: return 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    }
  };

  // Burn watermark using pdf-lib
  const compileWatermarkedPDF = async () => {
    if (!file) return;
    if (stampType === 'image' && !stampImageFile) {
      alert('Please upload a watermark image first!');
      return;
    }

    setProcessing(true);
    setProgressText('Opening document arrays...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();

      const indexesToStamp: number[] = [];
      if (pageRange === 'all') {
        for (let i = 0; i < pages.length; i++) indexesToStamp.push(i);
      } else {
        indexesToStamp.push(0);
      }

      if (stampType === 'text') {
        setProgressText('Baking watermark fonts...');
        const customFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontColorRgb = hexToRgb(textColor);

        for (let i = 0; i < indexesToStamp.length; i++) {
          const pageIdx = indexesToStamp[i];
          setProgressText(`Stamping page ${pageIdx + 1} of ${pages.length}...`);
          const page = pages[pageIdx];
          const { width, height } = page.getSize();

          const textW = customFont.widthOfTextAtSize(stampText, fontSize);
          const textH = fontSize; // Approximate bounding height
          
          const coords = getCoordinates(width, height, textW, textH, position);

          page.drawText(stampText, {
            x: coords.x,
            y: coords.y,
            size: fontSize,
            font: customFont,
            color: fontColorRgb,
            opacity: opacity,
            rotate: degrees(rotation) // Notice rotation revolves around x,y
          });
        }
      } else if (stampType === 'image' && stampImageFile) {
        setProgressText('Compiling watermark visual asset...');
        const imageBytes = await stampImageFile.arrayBuffer();
        
        let embeddedImg;
        if (stampImageFile.type === 'image/png') {
          embeddedImg = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedImg = await pdfDoc.embedJpg(imageBytes);
        }

        for (let i = 0; i < indexesToStamp.length; i++) {
          const pageIdx = indexesToStamp[i];
          setProgressText(`Stamping page ${pageIdx + 1} of ${pages.length}...`);
          const page = pages[pageIdx];
          const { width, height } = page.getSize();

          const finalW = (width * 0.45) * stampImageScale;
          const finalH = (finalW / embeddedImg.width) * embeddedImg.height;

          const coords = getCoordinates(width, height, finalW, finalH, position);

          page.drawImage(embeddedImg, {
            x: coords.x,
            y: coords.y,
            width: finalW,
            height: finalH,
            opacity: opacity,
            rotate: degrees(rotation)
          });
        }
      }

      setProgressText('Recompiling document layouts...');
      const editedBytes = await pdfDoc.save();
      const resultBlob = new Blob([editedBytes], { type: 'application/pdf' });
      const dlUrl = URL.createObjectURL(resultBlob);

      const link = document.createElement('a');
      link.href = dlUrl;
      const dotIndex = file.name.lastIndexOf('.');
      const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
      link.download = `${baseName}_watermarked.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(dlUrl), 100);
    } catch (err) {
      console.error(err);
      alert('Failed to stamp watermark. Choose standard documents non-protected.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="relative flex flex-col h-[100dvh] w-full overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      <ConfirmModal 
        isOpen={showConfirmClear} 
        onClose={() => setShowConfirmClear(false)} 
        onConfirm={confirmClearDocument} 
      />
      
      {!file ? (
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-6 flex items-center pt-safe">
            <button
              onClick={onBackToDashboard}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="ml-2 text-xl font-bold text-slate-800 dark:text-slate-100">Add Watermark</h1>
          </div>
          <div className="flex-1 flex flex-col justify-center items-center">
            <div className="w-full max-w-sm">
              {loadingFile ? (
                <div className="flex flex-col items-center justify-center p-12 border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-sm space-y-4">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium font-mono">Scanning document...</p>
                </div>
              ) : (
                <FileUploader 
                  onFileSelected={(files) => handleFileSelected(files[0])} 
                  acceptType="pdf"
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top 50% Live Preview Area */}
          <div className="h-[45dvh] lg:h-[50dvh] bg-[#ebebeb] dark:bg-[#0a0a0a] relative overflow-hidden flex items-center justify-center pt-[env(safe-area-inset-top)] border-b border-slate-300 dark:border-slate-800 shrink-0">
            {/* Header controls inside preview area */}
            <div className="absolute top-2 left-1 right-2 flex justify-between z-10 pt-safe pl-safe pr-safe">
              <button onClick={() => onBackToDashboard()} className="p-2.5 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors">
                 <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={handleClearDocument} title="Close / Delete Document" className="p-2.5 bg-black/20 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white transition-colors">
                 <Trash2 className="w-5 h-5" />
              </button>
            </div>

            {/* Document sheet representation */}
            <div className="relative w-[70vw] lg:w-auto h-[80%] aspect-[1/1.4] bg-white border shadow-2xl safe-area-px flex items-center justify-center overflow-hidden">
               <div className="text-slate-300 pointer-events-none flex flex-col items-center select-none">
                 <FileText className="w-12 h-12 mb-2 stroke-1" />
                 <span className="text-xs uppercase font-bold tracking-widest text-slate-400">PDF Sheet</span>
               </div>
               
               {/* Live mapped watermark */}
               <div 
                 className={`absolute transition-all duration-300 ease-in-out px-4 py-2 ${cssPositionClass(position)} flex items-center justify-center pointer-events-none select-none`}
                 style={{ 
                   color: textColor, 
                   opacity: opacity, 
                   transform: `${cssPositionClass(position).includes('translate') ? '' : ''} rotate(${rotation}deg)`,
                   transformOrigin: 'center center' // visually
                 }}
               >
                  {stampType === 'text' ? (
                    <span 
                       style={{ fontSize: `${Math.max(12, fontSize * 0.4)}px` }} 
                       className="font-black whitespace-nowrap overflow-visible"
                    >
                      {stampText || 'CONFIDENTIAL'}
                    </span>
                  ) : stampImageFile && stampImageUrl ? (
                    <img 
                      src={stampImageUrl} 
                      alt="Watermark asset" 
                      style={{ transform: `scale(${stampImageScale * 0.5})` }}
                      className="max-h-[50px] object-contain drop-shadow" 
                    />
                  ) : null}
               </div>

               {/* 3x3 layout hints faintly drawn */}
               <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-10">
                 {[Array(9)].map((_, i) => <div key={i} className="border border-slate-500/30"></div>)}
               </div>
            </div>
          </div>

          {/* Bottom 50% Config Deck - Independent Scroll */}
          <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 px-5 pt-6 pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-24 space-y-8 scrollbar-hide">
            
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Options
              </h2>
            </div>
            
            {/* Type selector */}
            <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex gap-1">
              <button
                onClick={() => setStampType('text')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${stampType === 'text' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Type className="w-4 h-4"/> Text
              </button>
              <button
                onClick={() => setStampType('image')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${stampType === 'image' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ImageIcon className="w-4 h-4"/> Image
              </button>
            </div>

            {/* Content Input */}
            {stampType === 'text' ? (
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={stampText}
                  onChange={e => setStampText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-4 rounded-2xl text-base font-bold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                
                <div className="flex gap-4">
                  <select 
                    value={fontSize} 
                    onChange={e => setFontSize(parseInt(e.target.value))}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm font-bold text-slate-800 dark:text-slate-100 appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={24}>Small Font</option>
                    <option value={48}>Medium Font</option>
                    <option value={72}>Large Font</option>
                    <option value={120}>Huge Font</option>
                  </select>
                  <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl">
                     {[
                       { color: '#ef4444' },
                       { color: '#3b82f6' },
                       { color: '#10b981' },
                       { color: '#000000' },
                     ].map(c => (
                       <button
                         key={c.color}
                         onClick={() => setTextColor(c.color)}
                         className={`w-8 h-8 rounded-full border-2 transition-transform ${textColor === c.color ? 'scale-110 border-slate-300 dark:border-slate-600 shadow-md' : 'border-transparent'}`}
                         style={{ backgroundColor: c.color }}
                       />
                     ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                 <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleImageWatermarkSelected}
                    className="hidden"
                    id="mobile-image-watermark-input"
                  />
                  {stampImageFile ? (
                    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{stampImageFile.name}</span>
                      <button onClick={() => setStampImageFile(null)} className="p-2 bg-red-100 text-red-600 rounded-full">
                         <X className="w-4 h-4"/>
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="mobile-image-watermark-input" className="block w-full text-center p-8 bg-slate-50 dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl active:bg-slate-100 transition-colors">
                      <div className="mx-auto w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                         <Plus className="w-6 h-6" />
                      </div>
                      <span className="block text-sm font-bold text-slate-700 dark:text-slate-300">Tap to upload Logo</span>
                    </label>
                  )}
                  {stampImageFile && (
                    <div className="space-y-4 pt-2">
                       <div className="flex justify-between items-center text-sm font-bold text-slate-600 dark:text-slate-400">
                         <span>Image Scale</span>
                         <span>{stampImageScale.toFixed(1)}x</span>
                       </div>
                       <input 
                         type="range" min="0.4" max="2.0" step="0.1" value={stampImageScale}
                         onChange={e => setStampImageScale(parseFloat(e.target.value))}
                         className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none accent-indigo-500"
                       />
                    </div>
                  )}
              </div>
            )}

            {/* Geometry adjustments */}
            <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
               {/* 3x3 Grid Matrix Selector */}
               <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Snap Layout position</h4>
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-3xl w-48 mx-auto aspect-square">
                    {[
                      'Top-Left', 'Top-Center', 'Top-Right',
                      'Center-Left', 'Center', 'Center-Right',
                      'Bottom-Left', 'Bottom-Center', 'Bottom-Right'
                    ].map(pos => (
                      <button
                        key={pos}
                        onClick={() => setPosition(pos)}
                        className={`w-full h-full rounded-2xl border-2 transition-all shadow-sm ${position === pos ? 'bg-indigo-500 border-indigo-600 shadow-indigo-500/20 shadow-lg scale-105' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}
                      />
                    ))}
                  </div>
               </div>

               {/* Opacity Slider */}
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-600 dark:text-slate-400">
                    <span>Opacity</span>
                    <span>{Math.round(opacity * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0.1" max="1.0" step="0.05" value={opacity}
                    onChange={e => setOpacity(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                  />
               </div>

               {/* Rotation Slider */}
               <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm font-bold text-slate-600 dark:text-slate-400">
                    <span>Rotation</span>
                    <span>{rotation}°</span>
                  </div>
                  <input 
                    type="range" min="-90" max="90" step="5" value={rotation}
                    onChange={e => setRotation(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                  />
               </div>
            </div>
            
            <div className="h-20" /> {/* Extra bottom padding to ensure visible scrolling space */}
          </div>

          {/* Bottom Fixed Action Button anchored to Safe Area */}
          <div className="absolute bottom-0 left-0 right-0 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={compileWatermarkedPDF}
              disabled={processing || (stampType === 'image' && !stampImageFile)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-full font-extrabold text-base flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:shadow-none"
            >
              <Stamp className="w-5 h-5" />
              Add Watermark
            </button>
          </div>
        </>
      )}
    </div>
  );
}
