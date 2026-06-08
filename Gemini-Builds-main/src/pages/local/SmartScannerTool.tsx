import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from '@cantoo/pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useLoadWASM } from '../../hooks/useLoadWASM';
import {
  ChevronLeft,
  Maximize,
  Sparkles,
  Download,
  Loader2,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Check,
  ArrowRight,
  ArrowLeft,
  FileDown,
  RefreshCw,
  Crop,
  ShieldCheck,
  Compass,
  FileCheck2,
  Sparkle,
  Trash2
} from 'lucide-react';

const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

const getOptimizedJpegBytes = async (sourceCanvas: HTMLCanvasElement): Promise<ArrayBuffer> => {
  const MAX_DIMENSION = 1600;
  let width = sourceCanvas.width;
  let height = sourceCanvas.height;

  // Scale down if the image exceeds standard document dimensions
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Draw to a new scaled canvas
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = width;
  scaledCanvas.height = height;
  const ctx = scaledCanvas.getContext('2d');
  
  // Fill with white background to prevent transparent-to-black JPEG artifacts
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }

  // Extract as 75% Quality JPEG
  return new Promise((resolve, reject) => {
    scaledCanvas.toBlob((blob) => {
      if (blob) {
        resolve(blob.arrayBuffer());
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/jpeg', 0.75);
  });
};

const getOptimizedUrlBytes = async (dataUrl: string): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const buffer = await getOptimizedJpegBytes(canvas);
          resolve(buffer);
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('Canvas context failed'));
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

const executeFinalCrop = (sourceCanvas: HTMLCanvasElement, currentSvgPoints: Point[]): HTMLCanvasElement => {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  // Convert normalized SVG points (0 to 1) to absolute pixel coordinates
  const pts = currentSvgPoints.map(p => ({
     x: p.x <= 1 ? p.x * w : p.x, 
     y: p.y <= 1 ? p.y * h : p.y
  }));

  const cv = (window as any).cv;
  let src = cv.imread(sourceCanvas);
  let dst = new cv.Mat();
  
  // Create coordinate matrices
  let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    pts[0].x, pts[0].y, // Top-Left
    pts[1].x, pts[1].y, // Top-Right
    pts[2].x, pts[2].y, // Bottom-Right
    pts[3].x, pts[3].y  // Bottom-Left
  ]);
  
  // Calculate destination dimensions
  const destWidth = Math.max(
    Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
    Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y)
  );
  const destHeight = Math.max(
    Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y),
    Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y)
  );

  let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0, destWidth, 0, destWidth, destHeight, 0, destHeight
  ]);

  // Execute the perspective warp
  let M = cv.getPerspectiveTransform(srcTri, dstTri);
  cv.warpPerspective(src, dst, M, new cv.Size(destWidth, destHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

  // Draw to a hidden temporary canvas
  const hiddenCanvas = document.createElement('canvas');
  cv.imshow(hiddenCanvas, dst);

  // CRITICAL: Cleanup WebAssembly Memory
  src.delete(); dst.delete(); M.delete(); srcTri.delete(); dstTri.delete();

  return hiddenCanvas;
};

interface SmartScannerToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

interface Point {
  x: number; // Normalized coordinate (0.0 to 1.0)
  y: number; // Normalized coordinate (0.0 to 1.0)
}

type FilterType = 'original' | 'grayscale' | 'bw' | 'magic-color' | 'sharpen' | 'sepia';

interface PageState {
  corners: Point[]; // Normalized coordinate handles
  handles?: Point[]; // Alias handles
  croppedImage: string | null;
  filteredImage: string | null;
  croppedWidth: number;
  croppedHeight: number;
  filter: FilterType;
  cropVariations?: Point[][];
  selectedVariationIndex?: number;
  isEdited?: boolean;
  croppedCanvasData?: string;
}

// Coordinate Sorter: TL, TR, BR, BL order
const sortPoints = (points: Point[]): Point[] => {
  if (points.length !== 4) return points;

  // Map elements with sum & difference metrics
  const withMetrics = points.map(p => ({
    p,
    sum: p.x + p.y,
    diff: p.x - p.y
  }));

  // Sort by sum to isolate Top-Left & Bottom-Right
  withMetrics.sort((a, b) => a.sum - b.sum);
  const tl = withMetrics[0].p;
  const br = withMetrics[3].p;

  // Sort remaining two by difference to isolate Bottom-Left and Top-Right
  const remaining = [withMetrics[1].p, withMetrics[2].p];
  remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const bl = remaining[0];
  const tr = remaining[1];

  return [tl, tr, br, bl];
};

export default function SmartScannerTool({
  onBackToDashboard,
  initialFile = null,
  onFileLoaded
}: SmartScannerToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Check OpenCV state helper
  const checkOpenCVReady = useCallback((): boolean => {
    const cv = (window as any).cv;
    return !!(cv && cv.Mat && cv.cvtColor && cv.GaussianBlur && cv.Canny);
  }, []);

  // OpenCV Loader State (Async CDN via custom hook)
  const { loaded: opencvLoaded, error: opencvError } = useLoadWASM({
    src: 'https://docs.opencv.org/4.8.0/opencv.js',
    scriptId: 'opencv-cdn-script',
    checkReady: checkOpenCVReady,
  });

  const opencvLoading = !opencvLoaded && !opencvError;

  // Scan & Crop Workspace State
  const [sourceImage, setSourceImage] = useState<string | null>(null); // Original size source image DataURL
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [corners, setCorners] = useState<Point[]>([]);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [cropVariations, setCropVariations] = useState<Point[][]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);

  const [croppedImage, setCroppedImage] = useState<string | null>(null); // Output crops
  const [croppedWidth, setCroppedWidth] = useState<number>(0);
  const [croppedHeight, setCroppedHeight] = useState<number>(0);
  
  const [filter, setFilter] = useState<FilterType>('original');
  const [filteredImage, setFilteredImage] = useState<string | null>(null); // Filter outputs

  // Master multi-page caching layer state (Tracks processed states across all documents)
  const [pagesData, setPagesData] = useState<Record<number, PageState>>({});
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);

  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [showConfirmClear, setShowConfirmClear] = useState<boolean>(false);

  const handleClearDocument = () => {
    setShowConfirmClear(true);
  };

  const confirmClearDocument = () => {
    setFile(null);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(null);
    setSourceImage(null);
    setCroppedImage(null);
    setFilteredImage(null);
    setPagesData({});
    setPageCount(0);
    setCurrentPage(0);
    setShowPreview(false);
  };

  // Handle Clean up URLs on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Generate standard 10% inside boundary margins as normalized percentage coordinates
  const generateDefaultCorners = () => {
    setCorners([
      { x: 0.1, y: 0.1 }, // TL
      { x: 0.9, y: 0.1 }, // TR
      { x: 0.9, y: 0.9 }, // BR
      { x: 0.1, y: 0.9 }  // BL
    ]);
  };

  // Order the corners (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
  // and map them to percentages (0.0 to 1.0) based on canvas width/height
  const orderAndNormalizeCorners = (
    points: { x: number; y: number }[] | null,
    width: number,
    height: number
  ): Point[] | null => {
    if (!points || points.length !== 4) return null;
    const sorted = sortPoints(points);
    return sorted.map(pt => ({
      x: pt.x / width,
      y: pt.y / height
    }));
  };

  const findDocumentEdges = (canvasElement: HTMLCanvasElement): Point[][] => {
    if (!checkOpenCVReady()) {
      return [];
    }
    const cv = (window as any).cv;
    let src = cv.imread(canvasElement);
    let gray = new cv.Mat();
    let blur = new cv.Mat();
    let edges = new cv.Mat();
    let dilated = new cv.Mat();
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    let M: any = null;
    
    let foundVariations: Point[][] = [];

    try {
      // 1. Grayscale & Blur to remove noise
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      let ksize = new cv.Size(5, 5);
      cv.GaussianBlur(gray, blur, ksize, 0, 0, cv.BORDER_DEFAULT);

      // 2. Dynamic Canny Edge Detection
      // Instead of hardcoded values, we use standard scanner thresholds
      cv.Canny(blur, edges, 75, 200);

      // 3. MORPHOLOGICAL DILATION (The Crucial Fix)
      // This bridges gaps in the Canny lines caused by low contrast/shadows
      M = cv.Mat.ones(5, 5, cv.CV_8U); // 5x5 structural element
      let anchor = new cv.Point(-1, -1);
      cv.dilate(edges, dilated, M, anchor, 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

      // 4. Find Contours
      cv.findContours(dilated, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      // 5. Sort contours by area descending
      let sortableContours = [];
      for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        sortableContours.push({ contour: cnt, area: area });
      }
      sortableContours.sort((item1: any, item2: any) => (item1.area > item2.area) ? -1 : (item1.area < item2.area) ? 1 : 0);

      const totalImageArea = canvasElement.width * canvasElement.height;
      const minDocumentArea = totalImageArea * 0.15; // Lowered slightly to catch smaller variations

      // 6. Find the top 4-point polygons
      for (let i = 0; i < sortableContours.length; i++) {
        if (foundVariations.length >= 3) break; // Stop after finding top 3

        let cnt = sortableContours[i].contour;
        let area = sortableContours[i].area;
        
        if (area < minDocumentArea) continue;

        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          let points = [];
          for (let j = 0; j < 4; j++) {
             points.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1]
             });
          }
          // Normalize immediately and push to variations
          let normalized = orderAndNormalizeCorners(points, canvasElement.width, canvasElement.height);
          if (normalized) {
            foundVariations.push(normalized);
          }
        }
        approx.delete();
      }
    } catch (err) {
      console.error("OpenCV processing error:", err);
    } finally {
      // 7. CRITICAL: Prevent WASM Memory Leaks
      if (src) src.delete();
      if (gray) gray.delete();
      if (blur) blur.delete();
      if (edges) edges.delete();
      if (dilated) dilated.delete(); 
      if (contours) contours.delete();
      if (hierarchy) hierarchy.delete();
      if (M) M.delete();
    }

    // 7. Fallback Logic
    if (foundVariations.length === 0) {
      const fallback = [{x: 0.1, y: 0.1}, {x: 0.9, y: 0.1}, {x: 0.9, y: 0.9}, {x: 0.1, y: 0.9}];
      foundVariations.push(fallback);
    }

    return foundVariations; // Now returns an array of point arrays
  };

  // Run auto detection pipeline
  const runAutoDetect = (canvas: HTMLCanvasElement) => {
    try {
      const variations = findDocumentEdges(canvas);
      if (variations && variations.length > 0) {
        setCropVariations(variations);
        setSelectedVariationIndex(0);
        setCorners(variations[0]);
      } else {
        const fallback = [[
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 }
        ]];
        setCropVariations(fallback);
        setSelectedVariationIndex(0);
        setCorners(fallback[0]);
      }
    } catch (error) {
      console.error("Error in runAutoDetect:", error);
      const fallback = [[
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 }
      ]];
      setCropVariations(fallback);
      setSelectedVariationIndex(0);
      setCorners(fallback[0]);
    }
  };

  // Synchronize state changes to pagesData cache
  const saveCurrentPageState = (pageIdx: number, overrideFields?: Partial<PageState>) => {
    setPagesData(prev => {
      const current = prev[pageIdx] || {
        corners,
        croppedImage,
        filteredImage,
        croppedWidth,
        croppedHeight,
        filter,
        cropVariations,
        selectedVariationIndex,
        isEdited: false,
        handles: corners,
        croppedCanvasData: undefined
      };
      
      const merged = {
        ...current,
        cropVariations: overrideFields?.cropVariations ?? (prev[pageIdx]?.cropVariations || cropVariations),
        selectedVariationIndex: overrideFields?.selectedVariationIndex ?? (prev[pageIdx]?.selectedVariationIndex ?? selectedVariationIndex),
        isEdited: overrideFields?.isEdited ?? prev[pageIdx]?.isEdited ?? current.isEdited,
        handles: overrideFields?.handles ?? prev[pageIdx]?.handles ?? (overrideFields?.corners ?? current.corners),
        croppedCanvasData: overrideFields?.croppedCanvasData ?? prev[pageIdx]?.croppedCanvasData,
        ...overrideFields
      };

      return {
        ...prev,
        [pageIdx]: merged
      };
    });
  };

  const performOfflineWarpAndFilter = async (
    canvas: HTMLCanvasElement,
    selectedCorners: Point[],
    targetFilter: FilterType
  ): Promise<{ outputDataUrl: string; width: number; height: number }> => {
    const cv = (window as any).cv;
    let src = cv.imread(canvas);
    let srcMat: any = null;
    let dstMat: any = null;
    let M: any = null;
    let dst: any = null;
    let filterSrc: any = null;
    let filterDst: any = null;
    let gray: any = null;
    let blurred: any = null;

    try {
      const width = canvas.width;
      const height = canvas.height;

      const [tlPct, trPct, brPct, blPct] = selectedCorners;
      const tl = { x: tlPct.x * width, y: tlPct.y * height };
      const tr = { x: trPct.x * width, y: trPct.y * height };
      const br = { x: brPct.x * width, y: brPct.y * height };
      const bl = { x: blPct.x * width, y: blPct.y * height };

      const widthBottom = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
      const widthTop = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
      const maxWidth = Math.max(widthBottom, widthTop);

      const heightRight = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
      const heightLeft = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
      const maxHeight = Math.max(heightRight, heightLeft);

      const targetWidth = Math.round(maxWidth);
      const targetHeight = Math.round(maxHeight);

      let srcCoords = [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y
      ];
      srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcCoords);

      let dstCoords = [
        0, 0,
        targetWidth, 0,
        targetWidth, targetHeight,
        0, targetHeight
      ];
      dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);

      M = cv.getPerspectiveTransform(srcMat, dstMat);
      let dsize = new cv.Size(targetWidth, targetHeight);
      dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      const warpedCanvas = document.createElement('canvas');
      cv.imshow(warpedCanvas, dst);

      let finalDataUrl = warpedCanvas.toDataURL('image/png');

      if (targetFilter !== 'original') {
        const tempImg = new Image();
        tempImg.src = finalDataUrl;
        await new Promise<void>((resolve) => {
          tempImg.onload = () => resolve();
        });

        filterSrc = cv.imread(tempImg);
        filterDst = new cv.Mat();

        if (targetFilter === 'grayscale') {
          cv.cvtColor(filterSrc, filterDst, cv.COLOR_RGBA2GRAY, 0);
        } else if (targetFilter === 'bw') {
          gray = new cv.Mat();
          cv.cvtColor(filterSrc, gray, cv.COLOR_RGBA2GRAY, 0);
          blurred = new cv.Mat();
          let ksize = new cv.Size(5, 5);
          cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);
          cv.adaptiveThreshold(
            blurred,
            filterDst,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            15,
            3
          );
        } else if (targetFilter === 'magic-color') {
          filterSrc.convertTo(filterDst, -1, 1.35, 20);
        } else if (targetFilter === 'sharpen') {
          let kernel = cv.matFromArray(3, 3, cv.CV_32F, [
             0, -1,  0,
            -1,  5, -1,
             0, -1,  0
          ]);
          cv.filter2D(filterSrc, filterDst, cv.CV_8U, kernel);
          kernel.delete();
        } else if (targetFilter === 'sepia') {
          let kernel = cv.matFromArray(4, 4, cv.CV_32F, [
            0.393, 0.769, 0.189, 0,
            0.349, 0.686, 0.168, 0,
            0.272, 0.534, 0.131, 0,
            0,     0,     0,     1
          ]);
          cv.transform(filterSrc, filterDst, kernel);
          kernel.delete();
        }

        const resCanvas = document.createElement('canvas');
        cv.imshow(resCanvas, filterDst);
        finalDataUrl = resCanvas.toDataURL('image/png');
      }

      return {
        outputDataUrl: finalDataUrl,
        width: targetWidth,
        height: targetHeight
      };
    } finally {
      if (src) src.delete();
      if (srcMat) srcMat.delete();
      if (dstMat) dstMat.delete();
      if (M) M.delete();
      if (dst) dst.delete();
      if (filterSrc) filterSrc.delete();
      if (filterDst) filterDst.delete();
      if (gray) gray.delete();
      if (blurred) blurred.delete();
    }
  };

  const handleBatchAutoCropAndExport = async () => {
    if (!file || !fileUrl) return;
    if (!checkOpenCVReady()) {
      alert("OpenCV Engine is not loaded or ready yet. Please try again in a few seconds.");
      return;
    }
    try {
      setProcessing(true);
      setBatchProgress({ current: 0, total: pageCount });
      setProgressText(`Preparing batch document scan for ${pageCount} pages...`);

      const loadingTask = pdfjsLib.getDocument({ url: fileUrl });
      const doc = await loadingTask.promise;

      let currentPagesData = { ...pagesData };

      for (let i = 0; i < pageCount; i++) {
        setBatchProgress({ current: i + 1, total: pageCount });
        setProgressText(`Auto-cropping and filtering page ${i + 1} of ${pageCount}...`);

        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error(`Failed to create 2D context for page ${i + 1}`);
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport } as any).promise;

        const variations = findDocumentEdges(canvas);
        const selectedCorners = (variations && variations.length > 0) ? variations[0] : [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 0.9, y: 0.9 },
          { x: 0.1, y: 0.9 }
        ];

        const targetFilter = filter || 'original';
        const warpResult = await performOfflineWarpAndFilter(canvas, selectedCorners, targetFilter);

        currentPagesData[i] = {
          corners: selectedCorners,
          handles: selectedCorners,
          croppedImage: warpResult.outputDataUrl,
          croppedCanvasData: warpResult.outputDataUrl,
          filteredImage: warpResult.outputDataUrl,
          croppedWidth: warpResult.width,
          croppedHeight: warpResult.height,
          filter: targetFilter,
          cropVariations: variations,
          selectedVariationIndex: 0,
          isEdited: true
        };

        await new Promise(r => setTimeout(r, 20));
      }

      setPagesData(currentPagesData);

      const updatedCache = currentPagesData[currentPage];
      if (updatedCache) {
        setCorners(updatedCache.corners);
        setCroppedImage(updatedCache.croppedImage);
        setFilteredImage(updatedCache.filteredImage);
        setCroppedWidth(updatedCache.croppedWidth);
        setCroppedHeight(updatedCache.croppedHeight);
        setFilter(updatedCache.filter);
        setShowPreview(false);
        if (updatedCache.cropVariations) {
          setCropVariations(updatedCache.cropVariations);
          setSelectedVariationIndex(updatedCache.selectedVariationIndex ?? 0);
        }
      }

      setProgressText("Finalizing and compiling final PDF document...");
      const pdfDoc = await PDFDocument.create();

      const originalPdfBytes = await file.arrayBuffer();
      const originalPdfDoc = await PDFDocument.load(originalPdfBytes);

      for (let i = 0; i < pageCount; i++) {
        setProgressText(`Stitching compiled page ${i + 1} of ${pageCount}...`);
        const item = currentPagesData[i];

        if (item && item.isEdited && item.croppedCanvasData) {
          const response = await fetch(item.croppedCanvasData);
          const arrayBuffer = await response.arrayBuffer();
          const embeddedPng = await pdfDoc.embedPng(arrayBuffer);
          const { width, height } = embeddedPng.scale(1.0);
          const pdfPage = pdfDoc.addPage([width, height]);
          pdfPage.drawImage(embeddedPng, {
            x: 0,
            y: 0,
            width,
            height
          });
        } else {
          const [copiedPage] = await pdfDoc.copyPages(originalPdfDoc, [i]);
          pdfDoc.addPage(copiedPage);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfLocalUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = pdfLocalUrl;
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      link.download = `${baseName}_batch_scanned.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(pdfLocalUrl), 2000);

    } catch (err: any) {
      console.error("Batch processing failed:", err);
      alert("Batch auto-cropping failed: " + (err.message || err));
    } finally {
      setProcessing(false);
      setBatchProgress(null);
      setProgressText("");
    }
  };

  // Scale interactive overlays based on displayed sizing bounds
  const updateDisplaySize = () => {
    if (imageRef.current) {
      setDisplaySize({
        width: imageRef.current.clientWidth,
        height: imageRef.current.clientHeight
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateDisplaySize);
    return () => window.removeEventListener('resize', updateDisplaySize);
  }, []);

  // Handle PDF rendering page step
  const loadPdfPage = async (docUrl: string, pageIndex: number, forceRestoreCache = true) => {
    try {
      setProcessing(true);
      setProgressText(`Rendering PDF Page ${pageIndex + 1} at high-definition zoom...`);

      const loadingTask = pdfjsLib.getDocument({ url: docUrl });
      const doc = await loadingTask.promise;
      const page = await doc.getPage(pageIndex + 1);

      // Render at pixel-density 2x scale for sharp document parsing
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to acquire canvas rendering context.');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport } as any).promise;

      const dataUrl = canvas.toDataURL('image/png');
      setOriginalSize({ width: canvas.width, height: canvas.height });
      setSourceImage(dataUrl);

      // Check pagesData cache
      const cached = pagesData[pageIndex];
      if (cached && forceRestoreCache) {
        setCorners(cached.corners);
        setCroppedImage(cached.croppedImage);
        setFilteredImage(cached.filteredImage);
        setCroppedWidth(cached.croppedWidth);
        setCroppedHeight(cached.croppedHeight);
        setFilter(cached.filter);
        setShowPreview(false);
        if (cached.cropVariations) {
          setCropVariations(cached.cropVariations);
          setSelectedVariationIndex(cached.selectedVariationIndex ?? 0);
        } else {
          setCropVariations([cached.corners]);
          setSelectedVariationIndex(0);
        }
      } else {
        // Reset crop steps
        setCroppedImage(null);
        setFilteredImage(null);
        setFilter('original');
        setShowPreview(false);

        // Perform Auto Detect asynchronously
        setTimeout(() => {
          runAutoDetect(canvas);
        }, 100);
      }

    } catch (err: any) {
      console.error(err);
      alert('Fail to load and render requested PDF page.');
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  // Convert files on receipt
  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setSourceImage(null);
    setCroppedImage(null);
    setFilteredImage(null);
    setFilter('original');
    setShowPreview(false);
    setPagesData({});
    
    try {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      if (selectedFile.type === 'application/pdf' || selectedFile.name.endsWith('.pdf')) {
        const loadingTask = pdfjsLib.getDocument({ url });
        const doc = await loadingTask.promise;
        setPageCount(doc.numPages);
        setCurrentPage(0);
        onFileLoaded?.(selectedFile, doc.numPages);
        
        // Render first page immediately
        await loadPdfPage(url, 0, false);
      } else {
        // Direct image loading
        setPageCount(1);
        setCurrentPage(0);
        onFileLoaded?.(selectedFile, 1);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight });
            setSourceImage(img.src);
            runAutoDetect(canvas);
          }
        };
        img.onerror = () => {
          alert('Failed to load image format.');
        };
        img.src = url;
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to initialize document. Make sure it is non-corrupt.');
      setFile(null);
    } finally {
      setLoadingFile(false);
    }
  }, [onFileLoaded]);

  // Load initial file automatically if forwarded
  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, handleFileSelected]);

  // Interactive coordinate handle dragging (Normalized 0.0 - 1.0 logic)
  const handleMouseDown = (index: number, e: React.MouseEvent<SVGCircleElement>) => {
    e.preventDefault();
    setDraggingIndex(index);
  };

  const handleTouchStart = (index: number, e: React.TouchEvent<SVGCircleElement>) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(index);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingIndex === null || !imageRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    let pctX = (e.clientX - rect.left) / rect.width;
    let pctY = (e.clientY - rect.top) / rect.height;

    pctX = Math.max(0, Math.min(1, pctX));
    pctY = Math.max(0, Math.min(1, pctY));

    setCorners(prev => {
      const next = [...prev];
      next[draggingIndex] = { x: pctX, y: pctY };
      return next;
    });
  }, [draggingIndex]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (draggingIndex === null || !imageRef.current || !containerRef.current || e.touches.length === 0) return;
    
    // Lock viewport to prevent scrolling or rubber-banding while cropping
    if (e.cancelable) {
      e.preventDefault();
    }
    e.stopPropagation();

    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    let pctX = (touch.clientX - rect.left) / rect.width;
    let pctY = (touch.clientY - rect.top) / rect.height;

    pctX = Math.max(0, Math.min(1, pctX));
    pctY = Math.max(0, Math.min(1, pctY));

    setCorners(prev => {
      const next = [...prev];
      next[draggingIndex] = { x: pctX, y: pctY };
      return next;
    });
  }, [draggingIndex]);

  const handleMouseUp = useCallback(() => {
    if (draggingIndex !== null) {
      // Sync manual coordinate modification back into session page cache
      saveCurrentPageState(currentPage, { corners });
      setDraggingIndex(null);
    }
  }, [draggingIndex, currentPage, corners]);

  useEffect(() => {
    if (draggingIndex !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [draggingIndex, handleMouseMove, handleTouchMove, handleMouseUp]);

  // Force automatic re-detect on demand
  const handleAutoDetectClick = () => {
    if (!sourceImage) return;
    const tempImg = new Image();
    tempImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = tempImg.naturalWidth;
      canvas.height = tempImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempImg, 0, 0);
        runAutoDetect(canvas);
      }
    };
    tempImg.src = sourceImage;
  };

  // Rotate clockwise 90 degrees
  const handleRotate = async () => {
    if (!sourceImage) return;
    try {
      setProcessing(true);
      setProgressText('Rotating page 90° clockwise...');

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
        img.src = sourceImage;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const rotatedUrl = canvas.toDataURL('image/png');
      
      setOriginalSize({ width: canvas.width, height: canvas.height });
      setSourceImage(rotatedUrl);

      setCorners(prev => {
        if (prev.length !== 4) return prev;
        const rotated = prev.map(pt => ({
          x: 1 - pt.y,
          y: pt.x
        }));
        return sortPoints(rotated);
      });

      setCropVariations(prevVariations => {
        return prevVariations.map(variation => {
          if (variation.length !== 4) return variation;
          const rotated = variation.map(pt => ({
            x: 1 - pt.y,
            y: pt.x
          }));
          return sortPoints(rotated);
        });
      });

      // Clear any previous crop edits to allow adjusting again on the rotated state
      setCroppedImage(null);
      setFilteredImage(null);

    } catch (err) {
      console.error('Failed to rotate document:', err);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  // Reset handles to 105% outer boundary mapping
  const handleCropFree = () => {
    setCorners([
      { x: 0, y: 0 },   // TL
      { x: 1, y: 0 },   // TR
      { x: 1, y: 1 },   // BR
      { x: 0, y: 1 }    // BL
    ]);
  };

  // Force re-detection or layout fallback reset
  const handleRetakeReset = () => {
    // Delete save settings for the current image
    setCroppedImage(null);
    setFilteredImage(null);
    setFilter('original');
    setShowPreview(false);
    saveCurrentPageState(currentPage, {
      isEdited: false,
      croppedImage: null,
      filteredImage: null,
      filter: 'original',
      croppedCanvasData: undefined
    });

    if (checkOpenCVReady()) {
      handleAutoDetectClick();
    } else {
      generateDefaultCorners();
    }
  };

  // Perform Perspective Crop Warp
  const handleApplyCrop = async (shouldShowPreview: boolean = true) => {
    if (!checkOpenCVReady() || !sourceImage || corners.length !== 4) return;

    let src: any = null;
    let srcMat: any = null;
    let dstMat: any = null;
    let M: any = null;
    let dst: any = null;

    try {
      setProcessing(true);
      setProgressText('Recalculating 3D perspective projection and flattening canvas...');

      const tempImg = new Image();
      const loadPromise = new Promise<void>((resolve, reject) => {
        tempImg.onload = () => resolve();
        tempImg.onerror = (e) => reject(e);
        tempImg.src = sourceImage;
      });
      await loadPromise;

      const cv = (window as any).cv;
      src = cv.imread(tempImg);

      // Re-scale percentage coordinates into raw dimensions
      const [tlPct, trPct, brPct, blPct] = corners;
      const tl = { x: tlPct.x * originalSize.width, y: tlPct.y * originalSize.height };
      const tr = { x: trPct.x * originalSize.width, y: trPct.y * originalSize.height };
      const br = { x: brPct.x * originalSize.width, y: brPct.y * originalSize.height };
      const bl = { x: blPct.x * originalSize.width, y: blPct.y * originalSize.height };

      // 1. Calculate Target Sizing bounds using relative vector distance math
      const widthBottom = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
      const widthTop = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
      const maxWidth = Math.max(widthBottom, widthTop);

      const heightRight = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
      const heightLeft = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
      const maxHeight = Math.max(heightRight, heightLeft);

      const targetWidth = Math.round(maxWidth);
      const targetHeight = Math.round(maxHeight);

      // 2. Maps matrices float arrays
      let srcCoords = [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y
      ];
      srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcCoords);

      let dstCoords = [
        0, 0,
        targetWidth, 0,
        targetWidth, targetHeight,
        0, targetHeight
      ];
      dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);

      // 3. Perspective grid warp
      M = cv.getPerspectiveTransform(srcMat, dstMat);
      let dsize = new cv.Size(targetWidth, targetHeight);
      dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

      // 4. Output back onto clean canvas
      const croppedCanvas = document.createElement('canvas');
      cv.imshow(croppedCanvas, dst);

      const outputDataUrl = croppedCanvas.toDataURL('image/png');
      setCroppedWidth(targetWidth);
      setCroppedHeight(targetHeight);
      setCroppedImage(outputDataUrl);
      
      if (shouldShowPreview) {
        setShowPreview(true);
      } else {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1500);
      }

      // Instantly synchronize results back to pages cache
      saveCurrentPageState(currentPage, {
        croppedImage: outputDataUrl,
        croppedWidth: targetWidth,
        croppedHeight: targetHeight,
        filteredImage: outputDataUrl, // default until filter process updates
        filter: filter || 'original',
        isEdited: true,
        croppedCanvasData: outputDataUrl,
        handles: corners
      });

      return outputDataUrl;

    } catch (err: any) {
      console.error(err);
      alert('Perspective distortion correction failed: ' + (err.message || err));
    } finally {
      // Clear WebAssembly allocations to guarantee no browser heap crashes
      if (src) src.delete();
      if (srcMat) srcMat.delete();
      if (dstMat) dstMat.delete();
      if (M) M.delete();
      if (dst) dst.delete();

      setProcessing(false);
      setProgressText('');
    }
  };

  // Filter Image Generation
  const processFilterData = async (sourceUrl: string, selectedFilter: FilterType) => {
    if (!checkOpenCVReady() || selectedFilter === 'original') {
      return sourceUrl;
    }
    const cv = (window as any).cv;

    let src: any = null;
    let dst: any = null;
    let gray: any = null;
    let blurred: any = null;

    try {
      const tempImg = new Image();
      tempImg.src = sourceUrl;
      await new Promise<void>((resolve) => {
        tempImg.onload = () => resolve();
      });

      src = cv.imread(tempImg);
      dst = new cv.Mat();

      if (selectedFilter === 'grayscale') {
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
      } else if (selectedFilter === 'bw') {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

        // De-noise via quick Gaussian
        blurred = new cv.Mat();
        let ksize = new cv.Size(5, 5);
        cv.GaussianBlur(gray, blurred, ksize, 0, 0, cv.BORDER_DEFAULT);

        // Adaptive thresholding converting grey or shadows directly into readable high-contrast print sheet
        cv.adaptiveThreshold(
          blurred,
          dst,
          255,
          cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          cv.THRESH_BINARY,
          15,
          3
        );
      } else if (selectedFilter === 'magic-color') {
        // Whitens backgrounds while saturating document elements to make printed texts signature layers pop
        // src.convertTo(dst, rtype, alpha, beta) (alpha: contrast multiplier, beta: brightness boost offset)
        src.convertTo(dst, -1, 1.35, 20);
      } else if (selectedFilter === 'sharpen') {
        let kernel = cv.matFromArray(3, 3, cv.CV_32F, [
           0, -1,  0,
          -1,  5, -1,
           0, -1,  0
        ]);
        cv.filter2D(src, dst, cv.CV_8U, kernel);
        kernel.delete();
      } else if (selectedFilter === 'sepia') {
        let kernel = cv.matFromArray(4, 4, cv.CV_32F, [
          0.393, 0.769, 0.189, 0,
          0.349, 0.686, 0.168, 0,
          0.272, 0.534, 0.131, 0,
          0,     0,     0,     1
        ]);
        cv.transform(src, dst, kernel);
        kernel.delete();
      }

      const resCanvas = document.createElement('canvas');
      cv.imshow(resCanvas, dst);
      const resultUrl = resCanvas.toDataURL('image/png');
      return resultUrl;
    } catch (err) {
      console.error('Filter execution failed: ', err);
      return sourceUrl;
    } finally {
      if (src) src.delete();
      if (dst) dst.delete();
      if (gray) gray.delete();
      if (blurred) blurred.delete();
    }
  };

  // Sync Adaptive Filter Generation on Crop edits
  useEffect(() => {
    const targetBaseImage = showPreview ? croppedImage : sourceImage;
    if (!targetBaseImage) {
      setFilteredImage(null);
      return;
    }

    let active = true;
    const generate = async () => {
      try {
        const filteredUrl = await processFilterData(targetBaseImage, filter);
        if (active) {
          setFilteredImage(filteredUrl);
          // Sync filtered data to cache state only if we're dealing with a cropped sheet
          if (showPreview && croppedImage) {
            saveCurrentPageState(currentPage, {
              filteredImage: filteredUrl,
              filter,
              croppedCanvasData: filteredUrl
            });
          }
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setFilteredImage(targetBaseImage);
          if (showPreview && croppedImage) {
            saveCurrentPageState(currentPage, {
              filteredImage: croppedImage,
              filter,
              croppedCanvasData: croppedImage
            });
          }
        }
      }
    };

    generate();

    return () => {
      active = false;
    };
  }, [croppedImage, sourceImage, showPreview, filter, currentPage]);

  const handleSaveCurrentPage = async () => {
    if (!sourceImage || !corners || corners.length !== 4) {
      console.warn("No active canvas or crop points to save.");
      return { currentCropped: croppedImage, currentFiltered: filteredImage };
    }

    try {
      const sourceCanvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
           const canvas = document.createElement('canvas');
           canvas.width = img.width;
           canvas.height = img.height;
           const ctx = canvas.getContext('2d');
           if (ctx) ctx.drawImage(img, 0, 0);
           resolve(canvas);
        };
        img.onerror = reject;
        img.src = sourceImage;
      });

      // 1. Physically cut the image using the current SVG coordinates
      const warpedCanvas = executeFinalCrop(sourceCanvas, corners);
      
      // 2. Compress the physically cut image into lightweight JPEG bytes
      const savedBlob = await getOptimizedJpegBytes(warpedCanvas); 
      const savedDataUrl = warpedCanvas.toDataURL('image/jpeg', 0.85);
      
      // 3. Save the correctly cropped bytes into the React state dictionary
      setPagesData((prev) => ({
        ...prev,
        [currentPage]: {
          ...prev[currentPage],
          corners,
          croppedImage: savedDataUrl,
          filteredImage: savedDataUrl, // The preview filter might not be applied, but this fixes the "ghost crop" bug
          croppedWidth: warpedCanvas.width,
          croppedHeight: warpedCanvas.height,
          filter,
          cropVariations,
          selectedVariationIndex,
          isEdited: true,
          croppedCanvasData: savedDataUrl
        }
      }));

      console.log(`Page ${currentPage + 1} successfully cropped and saved.`);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);

      return { currentCropped: savedDataUrl, currentFiltered: savedDataUrl };
    } catch (error) {
      console.error("Failed to crop and save page:", error);
      return { currentCropped: croppedImage, currentFiltered: filteredImage };
    }
  };

  // Navigation handlers with atomic automated caching
  const handleNextPage = async () => {
    if (currentPage < pageCount - 1 && fileUrl) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      await loadPdfPage(fileUrl, nextPage, true);
    }
  };

  const handlePrevPage = async () => {
    if (currentPage > 0 && fileUrl) {
      const prevPage = currentPage - 1;
      setCurrentPage(prevPage);
      await loadPdfPage(fileUrl, prevPage, true);
    }
  };

  // Downloader: Export active document sheets as clean PNGs
  const handleDownloadPng = () => {
    const activeImage = filteredImage || croppedImage;
    if (!activeImage || !file) return;

    const link = document.createElement('a');
    link.href = activeImage;
    const suffix = filter === 'bw' ? '_scan_bw' : filter === 'grayscale' ? '_scan_gray' : filter === 'magic-color' ? '_scan_magic' : '_scan_cropped';
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    link.download = `${baseName}${suffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exporters: Compile ALL annotated/scanned sheets into a master PDF document
  const handleDownloadPdf = async (compileAllPages: boolean = false) => {
    // 1. CRITICAL CATCH: Force-save the currently visible page before exporting
    // This guarantees the last page is included even if the user didn't click "Save"
    const { currentCropped, currentFiltered } = await handleSaveCurrentPage();

    const activeImage = currentFiltered || currentCropped || filteredImage || croppedImage;
    if (!file) return;

    const isPdfFile = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    try {
      setProcessing(true);
      setProgressText(compileAllPages ? 'Compiling all pages & stitching dynamic perspective transformations...' : 'Stitching current cropped document sheet into PDF...');

      const pdfDoc = await PDFDocument.create();

      // Ensure the current page's latest state is saved locally in our snapshot
      // Merge with the newly guaranteed active image to prevent stale closure!
      const finalExportData: Record<number, PageState> = { ...pagesData };
      
      // 2. Process the currently visible page instantly (Bypassing React setState)
      let activeCanvasBlob: ArrayBuffer | null = null;
      let activeDataUrl: string | undefined = undefined;
      
      if (sourceImage && corners && corners.length === 4) {
        const sourceCanvas = await new Promise<HTMLCanvasElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
             const canvas = document.createElement('canvas');
             canvas.width = img.width;
             canvas.height = img.height;
             const ctx = canvas.getContext('2d');
             if (ctx) ctx.drawImage(img, 0, 0);
             resolve(canvas);
          };
          img.onerror = reject;
          img.src = sourceImage;
        });

        const croppedCanvas = executeFinalCrop(sourceCanvas, corners);
        
        activeCanvasBlob = await getOptimizedJpegBytes(croppedCanvas);
        activeDataUrl = croppedCanvas.toDataURL('image/jpeg', 0.85);
      }

      finalExportData[currentPage] = {
        ...pagesData[currentPage],
        corners,
        croppedImage: activeDataUrl || currentCropped || croppedImage,
        filteredImage: activeDataUrl || currentFiltered || filteredImage,
        croppedWidth,
        croppedHeight,
        filter,
        cropVariations,
        selectedVariationIndex,
        isEdited: true,
        croppedCanvasData: activeDataUrl || currentFiltered || currentCropped || filteredImage || croppedImage || undefined
      };
      
      // Update the React state in the background for consistency
      setPagesData(finalExportData);

      if (compileAllPages && fileUrl && pageCount > 1) {
        if (isPdfFile) {
          const originalPdfBytes = await file.arrayBuffer();
          const originalPdfDoc = await PDFDocument.load(originalPdfBytes);

          for (let i = 0; i < pageCount; i++) {
            setProgressText(`Compiling page ${i + 1} of ${pageCount}...`);
            const item = finalExportData[i];

            if (item && item.isEdited) {
              let arrayBuffer: ArrayBuffer;
              if (i === currentPage && activeCanvasBlob) {
                 arrayBuffer = activeCanvasBlob;
              } else if (item.croppedCanvasData) {
                 arrayBuffer = await getOptimizedUrlBytes(item.croppedCanvasData);
              } else {
                 arrayBuffer = await getOptimizedUrlBytes(item.croppedImage || item.filteredImage || '');
              }
              const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
              const { width, height } = embeddedJpg.scale(1.0);
              const pdfPage = pdfDoc.addPage([width, height]);
              pdfPage.drawImage(embeddedJpg, {
                x: 0,
                y: 0,
                width,
                height
              });
            } else {
              // Copy original page directly to retain 100% of native vector metadata
              const [copiedPage] = await pdfDoc.copyPages(originalPdfDoc, [i]);
              pdfDoc.addPage(copiedPage);
            }
          }
        } else {
          // Fallback if uploading a direct set of images
          for (let i = 0; i < pageCount; i++) {
            setProgressText(`Embedding image page ${i + 1} of ${pageCount}...`);
            const item = finalExportData[i];

            if (item && item.isEdited) {
              let arrayBuffer: ArrayBuffer;
              if (i === currentPage && activeCanvasBlob) {
                 arrayBuffer = activeCanvasBlob;
              } else if (item.croppedCanvasData) {
                 arrayBuffer = await getOptimizedUrlBytes(item.croppedCanvasData);
              } else {
                 arrayBuffer = await getOptimizedUrlBytes(item.croppedImage || item.filteredImage || '');
              }
              const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
              const { width, height } = embeddedJpg.scale(1.0);
              const pdfPage = pdfDoc.addPage([width, height]);
              pdfPage.drawImage(embeddedJpg, {
                x: 0,
                y: 0,
                width,
                height
              });
            }
          }
        }
      } else {
        // Single page target compiling
        if (isPdfFile) {
          const item = finalExportData[currentPage];
          if (item && item.isEdited) {
            let arrayBuffer: ArrayBuffer;
            if (activeCanvasBlob) {
               arrayBuffer = activeCanvasBlob;
            } else if (item.croppedCanvasData) {
               arrayBuffer = await getOptimizedUrlBytes(item.croppedCanvasData);
            } else {
               arrayBuffer = await getOptimizedUrlBytes(item.croppedImage || item.filteredImage || '');
            }
            const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
            const { width, height } = embeddedJpg.scale(1.0);
            const pdfPage = pdfDoc.addPage([width, height]);
            pdfPage.drawImage(embeddedJpg, {
              x: 0,
              y: 0,
              width,
              height
            });
          } else {
            // Copy original page directly from original PDF document representation
            const originalPdfBytes = await file.arrayBuffer();
            const originalPdfDoc = await PDFDocument.load(originalPdfBytes);
            const [copiedPage] = await pdfDoc.copyPages(originalPdfDoc, [currentPage]);
            pdfDoc.addPage(copiedPage);
          }
        } else {
          let arrayBuffer: ArrayBuffer;
          if (activeCanvasBlob) {
             arrayBuffer = activeCanvasBlob;
          } else if (activeImage) {
             arrayBuffer = await getOptimizedUrlBytes(activeImage);
          } else {
            alert('Please flatten and crop the current document boundary first.');
            return;
          }
          const embeddedJpg = await pdfDoc.embedJpg(arrayBuffer);
          const { width, height } = embeddedJpg.scale(1.0);
          const page = pdfDoc.addPage([width, height]);
          page.drawImage(embeddedJpg, {
            x: 0,
            y: 0,
            width,
            height
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfLocalUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = pdfLocalUrl;
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const targetSuffix = compileAllPages ? '_full_scanned' : '_scanned';
      link.download = `${baseName}${targetSuffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(pdfLocalUrl), 2000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to compile PDF document: ' + (err.message || err));
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  // SVG coordinate multipliers for rendering percentages on dynamic elements
  const scaleX = displaySize.width || 1;
  const scaleY = displaySize.height || 1;

  // Poly points coordinate string
  const polygonPointsString = corners.map(pt => `${pt.x * scaleX},${pt.y * scaleY}`).join(' ');

  if (opencvLoading) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs select-none">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-5 text-center max-w-sm mx-4">
          <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
          <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-lg">Initializing Machine Learning Engine...</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading dynamic computer vision models for image alignment and auto-crop borders...</p>
        </div>
      </div>
    );
  }

  if (opencvError) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600">
          <Loader2 className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-extrabold text-slate-900 dark:text-white text-lg">Initialization Failed</h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {opencvError}
        </p>
        <button
          onClick={onBackToDashboard}
          className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
        >
          Back To Dashboard
        </button>
      </div>
    );
  }

  return (
    <div id="smart-scanner-root" className="container mx-auto max-w-6xl space-y-6 py-2">
      <ConfirmModal 
        isOpen={showConfirmClear} 
        onClose={() => setShowConfirmClear(false)} 
        onConfirm={confirmClearDocument} 
      />
      {/* Upper Navigation Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-lg border border-slate-250 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="Return to Dashboard menu"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                Premium Engine
              </span>
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
                Smart Doc Scanner & Crop
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Clean yellowing tones, correct skewing perspectives, and generate pristine high-contrast document scans.
            </p>
          </div>
        </div>

        {/* OpenCV WebAssembly state pill & Global Actions */}
        <div className="flex items-center gap-3">
          {opencvLoading ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-700 dark:text-indigo-400 font-medium">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0"></span>
              Initializing WebAssembly OpenCV Vision Core...
            </div>
          ) : opencvError ? (
            <div className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-xs text-amber-700 dark:text-amber-400 font-medium">
              Offline Boundary Engine Active
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              WASM Core Loaded & Active
            </div>
          )}
          {file && (
            <button 
              onClick={handleClearDocument}
              title="Close / Delete Document"
              className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-rose-500 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900/50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Pure CSS Spinning Ring Overlay to bypass JavaScript thread freezing */}
      {processing && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-emerald-600 animate-spin" />
            <h4 className="font-bold text-slate-800 dark:text-slate-100">AI Vision Lab processing</h4>
            <p className="text-xs text-slate-500 transition-all">{progressText || 'Recalculating canvas lines...'}</p>
          </div>
        </div>
      )}

      {/* Main interface workspace */}
      {!file ? (
        <div className="max-w-xl mx-auto py-8">
          <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="all"
          />
          
          <div className="mt-8 rounded-xl bg-slate-50 dark:bg-slate-900/45 p-5 border border-slate-200 dark:border-slate-800 space-y-3.5 block select-none">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" /> Professional-grade scanner logic:
            </h3>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2.5 leading-relaxed list-decimal list-inside">
              <li>Upload photos containing tilted angles, skewing perspective, or low contrast.</li>
              <li>WASM OpenCV auto-calculates boundary points dynamically within milliseconds.</li>
              <li>Tweak corner nodes easily. Target positions are fully responsive to screen orientation and resize events.</li>
              <li>Select filters to whiten paper backgrounds and optimize printer ink consumption!</li>
            </ul>
          </div>
        </div>      ) : !showPreview ? (
        /* ==================== CROP & FILTER REVIEW INTERFACE (DARK THEME) ==================== */
        <div className="flex flex-col min-h-[600px] bg-slate-950 text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-900 select-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-900 bg-slate-900/50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setFile(null);
                  setSourceImage(null);
                  setCroppedImage(null);
                  setFilteredImage(null);
                  setPagesData({});
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                title="Change document file"
                id="crop-review-back"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-extrabold tracking-wide uppercase text-slate-200">
                Adjust Borders
              </h2>
              {pagesData[currentPage]?.isEdited && (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-fade-in">
                  Saved
                </span>
              )}
            </div>

            {pageCount > 1 && (
              <div className="flex items-center gap-2.5 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 0 || processing}
                  className="text-slate-400 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                  id="crop-review-prev-page"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-slate-300">
                  {currentPage + 1} / {pageCount}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === pageCount - 1 || processing}
                  className="text-slate-400 hover:text-white disabled:opacity-30 transition-all cursor-pointer"
                  id="crop-review-next-page"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {pageCount > 1 && (
                <button
                  onClick={handleBatchAutoCropAndExport}
                  disabled={processing}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 active:scale-95 text-slate-950 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  id="btn-batch-header"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>Auto-Crop All & Export</span>
                </button>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-widest">
                WASM Core Active
              </span>
            </div>
          </div>

          {/* Center Stage (The Image) */}
          <div className="flex-1 flex items-center justify-center p-6 bg-slate-900/90 overflow-hidden relative min-h-[400px]">
            {sourceImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-hidden p-4">
                {/* Shrink-Wrap Wrapper Strategy */}
                <div 
                  className="relative inline-block max-w-full max-h-[50vh] shadow-2xl select-none" 
                  ref={containerRef}
                  id="shrink-wrap-wrapper"
                >
                  <img
                    ref={imageRef}
                    src={filteredImage || sourceImage}
                    onLoad={updateDisplaySize}
                    className="block max-h-[50vh] max-w-full h-auto w-auto pointer-events-none select-none rounded shadow-2xl border border-slate-805"
                    alt="Source document preview"
                    id="shrink-wrap-image"
                  />

                  {/* SVG Boundary Overlay */}
                  {displaySize.width > 0 && displaySize.height > 0 && corners.length === 4 && (
                    <svg
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      width={displaySize.width}
                      height={displaySize.height}
                      id="svg-boundary-overlay"
                    >
                      {/* Interactive quadrilateral boundary box connecting point vectors with brand Cyan */}
                      <polygon
                        points={polygonPointsString}
                        className="fill-cyan-500/15 stroke-cyan-500 stroke-[3.5] pointer-events-none"
                        style={{ strokeDasharray: '4 3' }}
                      />

                      {/* Interactive Drag Handles with Cyan Theme */}
                      {corners.map((pt, idx) => (
                        <g key={idx}>
                          {/* Large touch target handle */}
                          <circle
                            cx={pt.x * scaleX}
                            cy={pt.y * scaleY}
                            r="22"
                            className="fill-transparent hover:fill-cyan-400/20 active:fill-cyan-400/35 cursor-move transition-colors duration-150 pointer-events-auto"
                            style={{ pointerEvents: 'auto' }}
                            onMouseDown={(e) => handleMouseDown(idx, e)}
                            onTouchStart={(e) => handleTouchStart(idx, e)}
                            id={`handle-touch-target-${idx}`}
                          />
                          {/* Visible Cyan Node indicator */}
                          <circle
                            cx={pt.x * scaleX}
                            cy={pt.y * scaleY}
                            r="8"
                            className="fill-cyan-400 stroke-white stroke-2 shadow-xl pointer-events-none"
                            id={`handle-visible-${idx}`}
                          />
                          {/* Node label helper */}
                          <text
                            x={pt.x * scaleX}
                            y={pt.y * scaleY - 14}
                            className="text-[10px] font-extrabold fill-cyan-400 font-mono select-none pointer-events-none"
                            textAnchor="middle"
                            style={{ filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.9))' }}
                          >
                            {idx === 0 ? 'TL' : idx === 1 ? 'TR' : idx === 2 ? 'BR' : 'BL'}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <p className="text-xs text-slate-400">Rendering visual sheet...</p>
              </div>
            )}
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="border-t border-slate-900 bg-slate-950 p-4 space-y-4 shadow-2xl">
            {/* Row 1: Filter Selector */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase select-none">
                CURRENT FILTER
              </span>
              <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800" id="filter-selection-buttons">
                {[
                  { id: 'original', label: 'Original' },
                  { id: 'magic-color', label: 'Vibrant' },
                  { id: 'bw', label: 'Magic B&W' },
                  { id: 'sharpen', label: 'Sharpen' },
                  { id: 'sepia', label: 'Sepia' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setFilter(opt.id as FilterType);
                    }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      filter === opt.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    id={`filter-opt-${opt.id}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Crop Variations Selector */}
            {cropVariations.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-2 border-t border-slate-900/60 pb-1">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-extrabold tracking-wider text-cyan-400 uppercase select-none">
                    CROP VARIATIONS
                  </span>
                  <span className="text-[9px] text-slate-500">
                    Select a variation to automatically snap the crop boundary handles
                  </span>
                </div>
                <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800" id="crop-variations-buttons">
                  {cropVariations.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVariationIndex(idx);
                        setCorners(cropVariations[idx]);
                        saveCurrentPageState(currentPage, {
                          corners: cropVariations[idx],
                          selectedVariationIndex: idx
                        });
                      }}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        selectedVariationIndex === idx
                          ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                      }`}
                      id={`crop-variation-btn-${idx}`}
                    >
                      Option {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Row 2: Action Tools */}
            <div className="grid grid-cols-6 gap-2 sm:gap-3">
              <button
                onClick={handleAutoDetectClick}
                className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 hover:bg-indigo-900/40 text-indigo-400 group transition-all cursor-pointer"
                title="Automatically detect edges to crop"
                id="action-auto-crop"
              >
                <Sparkles className="w-4.5 h-4.5 transition-colors group-hover:text-indigo-300" />
                <span className="text-[10px] mt-1 font-bold">Auto Crop</span>
              </button>

              <button
                onClick={handleRotate}
                className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:text-white text-slate-300 transition-all cursor-pointer group"
                title="Rotate image 90 degrees clockwise"
                id="action-rotate"
              >
                <RotateCcw className="w-4.5 h-4.5 text-slate-450 group-hover:text-cyan-400 transition-colors transform rotate-180" />
                <span className="text-[10px] mt-1 font-bold">Rotate</span>
              </button>

              <button
                onClick={handleCropFree}
                className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:text-white text-slate-300 transition-all cursor-pointer group"
                title="Reset 4 handles to absolute image corners (0-100%)"
                id="action-crop-free"
              >
                <Crop className="w-4.5 h-4.5 text-slate-450 group-hover:text-cyan-400 transition-colors" />
                <span className="text-[10px] mt-1 font-bold">Crop Free</span>
              </button>

              <button
                onClick={handleRetakeReset}
                className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:text-white text-slate-300 transition-all cursor-pointer group"
                title="Re-run edge auto-alignment"
                id="action-retake-reset"
              >
                <RefreshCw className="w-4.5 h-4.5 text-slate-450 group-hover:text-cyan-400 transition-colors" />
                <span className="text-[10px] mt-1 font-bold">Retake / Reset</span>
              </button>

              {pagesData[currentPage]?.isEdited && currentPage < pageCount - 1 ? (
                <button
                  onClick={handleNextPage}
                  disabled={processing}
                  className="flex flex-col items-center justify-center py-2.5 rounded-xl border border-cyan-500/50 bg-cyan-950/30 hover:bg-cyan-900/50 text-cyan-400 group col-span-1 transition-all cursor-pointer"
                  title="Go to next page"
                  id="action-next-page"
                >
                  <ArrowRight className="w-4.5 h-4.5 transition-transform group-hover:translate-x-1" />
                  <span className="text-[10px] mt-1 font-bold">Next Page</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveCurrentPage}
                  disabled={pagesData[currentPage]?.isEdited || processing}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all cursor-pointer group col-span-1 ${
                    pagesData[currentPage]?.isEdited
                      ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-400 cursor-default opacity-80'
                      : justSaved
                      ? 'border-emerald-500 bg-emerald-950/45 text-emerald-400 animate-pulse'
                      : 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-300 hover:text-emerald-400'
                  }`}
                  title={pagesData[currentPage]?.isEdited ? "Already saved" : "Save crop settings for this page"}
                  id="action-save-crop-page"
                >
                  <Check className={`w-4.5 h-4.5 transition-colors ${pagesData[currentPage]?.isEdited || justSaved ? 'text-emerald-400 font-bold' : 'text-slate-450 group-hover:text-emerald-500'}`} />
                  <span className="text-[10px] mt-1 font-bold">{pagesData[currentPage]?.isEdited || justSaved ? 'Saved!' : 'Save'}</span>
                </button>
              )}

              <button
                onClick={() => handleDownloadPdf(true)}
                disabled={processing}
                className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 hover:opacity-90 disabled:opacity-50 text-slate-950 font-extrabold text-xs transition-all shadow-md cursor-pointer col-span-1 select-none group"
                title="Compile & Download full PDF"
                id="action-export-multipage"
              >
                <FileDown className="w-4.5 h-4.5 text-slate-950 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] mt-1 font-extrabold">Export</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== PREVIEW SCREEN (POLISHED RESULTS) ==================== */
        <div className="flex flex-col min-h-[550px] bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-800 select-none">
          {/* Preview Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-805 bg-white dark:bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-750 dark:text-slate-250 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-bold transition-colors cursor-pointer"
                id="preview-back-to-borders"
              >
                <ChevronLeft className="w-4 h-4" />
                Adjust Borders
              </button>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                Preview Flattened Scan
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {pageCount > 1 && (
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                  Page {currentPage + 1} of {pageCount}
                </span>
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setSourceImage(null);
                  setCroppedImage(null);
                  setFilteredImage(null);
                  setPagesData({});
                }}
                className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
                id="preview-change-file"
              >
                Change File
              </button>
            </div>
          </div>

          {/* Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start">
            {/* Output Center Preview Frame */}
            <div className="lg:col-span-7 flex flex-col items-center justify-center p-6 bg-slate-100/50 dark:bg-slate-950/45 rounded-xl border border-slate-200 dark:border-slate-801 min-h-[400px]">
              {filteredImage || croppedImage ? (
                <div className="relative inline-block rounded-xl shadow-2xl bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 overflow-hidden max-w-full">
                  <img
                    src={filteredImage || croppedImage || undefined}
                    className="max-h-[55vh] max-w-full h-auto w-auto object-contain rounded"
                    alt="Flattened scanner result"
                    id="preview-flattened-image"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                  <p className="text-xs text-slate-500">Applying dynamic filters...</p>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-4 font-semibold uppercase tracking-wider select-none">
                3D Perspective Corrected Output • {croppedWidth}x{croppedHeight} px
              </p>
            </div>

            {/* Export & Actions Sidebar */}
            <div className="lg:col-span-5 space-y-5">
              {/* Filter Panel on Cropped View */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  CURRENT FILTER
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Refine coloring presets for the clean flattened print sheet dynamically:
                </p>

                <div className="grid grid-cols-2 gap-2" id="preview-filter-selector">
                  {[
                    { id: 'original', label: 'Original' },
                    { id: 'grayscale', label: 'Grayscale' },
                    { id: 'bw', label: 'Magic B&W' },
                    { id: 'magic-color', label: 'Vibrant' },
                    { id: 'sharpen', label: 'Sharpen' },
                    { id: 'sepia', label: 'Sepia' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setFilter(opt.id as FilterType)}
                      className={`px-3 py-2 text-xs font-bold rounded-lg border text-center cursor-pointer transition-all ${
                        filter === opt.id
                          ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-bold shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                      id={`preview-filter-opt-${opt.id}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950/40 text-[11px] text-slate-500 italic leading-snug">
                  {filter === 'bw' 
                    ? 'Adaptive Gaussian limits noise spots and renders high-definition print text.' 
                    : filter === 'magic-color' 
                    ? 'Preserves colored signatures, seals, or ink drawings while whitening standard margins.'
                    : filter === 'grayscale' 
                    ? 'Removes blue, green, and red hues into absolute black-and-grey gradients.' 
                    : 'Displays native background pixel values without enhancement.'}
                </div>
              </div>

              {/* Document Export Suite */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Export Document
                </h3>

                <div className="space-y-2.5">
                  {pageCount > 1 && (
                    <>
                      <button
                        onClick={() => handleDownloadPdf(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-lg shadow-sm cursor-pointer transition-all"
                        id="export-full-pdf"
                        disabled={processing}
                      >
                        <FileCheck2 className="w-4 h-4" /> Export Full Document ({pageCount} pages)
                      </button>

                      <button
                        onClick={handleBatchAutoCropAndExport}
                        disabled={processing}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-indigo-650 hover:opacity-90 active:scale-[0.98] text-white font-bold text-sm rounded-lg shadow-md cursor-pointer transition-all border border-cyan-500/20"
                        id="batch-autocrop-export"
                      >
                        <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" /> Auto-Crop All & Export
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDownloadPdf(false)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-all"
                    id="export-page-pdf"
                    disabled={processing}
                  >
                    <FileDown className="w-4 h-4 text-emerald-500" /> Export Current Page PDF
                  </button>
                  
                  <button
                    onClick={handleDownloadPng}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-805 dark:text-slate-205 font-bold text-xs rounded-lg cursor-pointer transition-colors"
                    id="export-png-download"
                    disabled={processing}
                  >
                    <Download className="w-4 h-4 text-emerald-500" /> Download as PNG
                  </button>
                </div>

                {pageCount > 1 && (
                  <div className="pt-4 border-t border-slate-150 dark:border-slate-800/80 flex items-center justify-between gap-3">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 0 || processing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 disabled:opacity-50 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous Page
                    </button>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === pageCount - 1 || processing}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-750 disabled:opacity-50 text-[11px] font-bold cursor-pointer transition-all"
                    >
                      Next Page <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Processing Loading Overlay */}
      {batchProgress && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-md select-none">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 text-center max-w-sm mx-4 w-full">
            <div className="relative flex items-center justify-center">
              {/* Outer spinning border */}
              <div className="w-16 h-16 rounded-full border-4 border border-slate-800 border-t-cyan-400 animate-spin shrink-0" />
              <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse absolute" />
            </div>

            <div className="space-y-1">
              <h4 className="font-extrabold text-cyan-400 text-sm uppercase tracking-wider">
                Batch Auto-Crop Active
              </h4>
              <p className="text-xs text-slate-300 font-medium">
                Auto-cropping page <span className="font-mono text-cyan-400 text-sm font-bold">{batchProgress.current}</span> of <span className="font-mono text-slate-400 text-sm font-bold">{batchProgress.total}</span>
              </p>
            </div>

            {/* Real Progress Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all duration-300 ease-out shadow-[0_0_8px_#22d3ee]"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>

            <div className="text-[10px] text-slate-400 bg-slate-950/50 px-3 py-1 rounded border border-slate-800/80 font-mono tracking-tight select-none">
              WASM Core • Running OpenCV Perspective Warp
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
