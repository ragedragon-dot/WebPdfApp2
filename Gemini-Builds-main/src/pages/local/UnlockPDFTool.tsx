import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from '@cantoo/pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  ChevronLeft, 
  Unlock, 
  Download, 
  Loader2, 
  FileText, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  X,
  KeyRound,
  Lock,
  CheckCircle2
} from 'lucide-react';

const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

interface UnlockPDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

export default function UnlockPDFTool({ 
  onBackToDashboard, 
  initialFile = null,
  onFileLoaded 
}: UnlockPDFToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Decryption states
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [successfullyUnlocked, setSuccessfullyUnlocked] = useState<boolean>(false);

  // App running states
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  // Memory leaks cleanups
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  // Analyzes file encryption without requiring a password upfront
  const analyzeFileSelected = useCallback(async (selectedFile: File) => {
    setLoadingFile(true);
    setIsEncrypted(false);
    setPassword('');
    setDecryptError(null);
    setSuccessfullyUnlocked(false);
    setPageCount(0);

    try {
      const url = URL.createObjectURL(selectedFile);
      setFileUrl(url);
      setFile(selectedFile);

      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      const docPageCount = doc.numPages;
      setPageCount(docPageCount);
      setIsEncrypted(false);
      onFileLoaded?.(selectedFile, docPageCount);
    } catch (err: any) {
      if (err.name === 'PasswordException') {
        setIsEncrypted(true);
        onFileLoaded?.(selectedFile, 0);
      } else {
        console.error(err);
        alert('Error analyzing document. Please import a standard valid PDF file.');
        setFile(null);
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        setFileUrl(null);
      }
    } finally {
      setLoadingFile(false);
    }
  }, [fileUrl, onFileLoaded]);

  // Load from dashboard routing
  useEffect(() => {
    if (initialFile) {
      analyzeFileSelected(initialFile);
    }
  }, [initialFile, analyzeFileSelected]);

  // Main decryption action: load with password and save without it
  const handleDecryptAndDownload = async () => {
    if (!file) return;
    
    setProcessing(true);
    setDecryptError(null);
    setProgressText('Preparing PDF payload bytes...');

    try {
      const fileArrayBuffer = await file.arrayBuffer();

      setProgressText('Challenging document block credentials...');
      
      const pdfDoc = await PDFDocument.load(fileArrayBuffer, { password: password });
      
      setProgressText('Security key matched! Removing trailing credentials layers...');
      const decryptedPdfBytes = await pdfDoc.save(); // Saves without password parameters, stripping security
      
      const flattenedBytes = new Uint8Array(decryptedPdfBytes);

      // Analyze page count of unlocked PDF using pdfjs-dist
      try {
        const unlockedBlob = new Blob([flattenedBytes], { type: 'application/pdf' });
        const tempUrl = URL.createObjectURL(unlockedBlob);
        const loadingTask = pdfjsLib.getDocument({ url: tempUrl });
        const doc = await loadingTask.promise;
        setPageCount(doc.numPages);
        onFileLoaded?.(file, doc.numPages);
        URL.revokeObjectURL(tempUrl);
      } catch (e) {
        console.error('Failed to parse page count of decrypted PDF:', e);
      }

      setSuccessfullyUnlocked(true);
      setProgressText('Compiling raw decrypted lines. Compiling download streams...');

      const blob = new Blob([flattenedBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      const originalName = file.name.endsWith('.pdf') ? file.name.substring(0, file.name.length - 4) : file.name;
      link.download = `${originalName}_unlocked.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 3000);

    } catch (e: any) {
      console.error(e);
      let errorMsg = 'Decrypt credentials mismatch. Verify passwords and try again.';
      if (e?.message && (e.message.indexOf('password') !== -1 || e.message.indexOf('Password') !== -1 || e.message.indexOf('decrypt') !== -1)) {
        errorMsg = 'Incorrect password. Verification challenge failed.';
      }
      setDecryptError(errorMsg);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPageCount(0);
    setPassword('');
    setIsEncrypted(false);
    setDecryptError(null);
    setSuccessfullyUnlocked(false);
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
    <div id="unlock-tool-root" className="max-w-4xl mx-auto space-y-6">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Navigation header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-450 font-bold text-xs font-mono uppercase bg-emerald-50 dark:bg-emerald-955/35 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/40">
          <Unlock className="w-3.5 h-3.5 animate-pulse" /> Decryption Stripper
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Unlock PDF Document
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xl">
          Instantly strip password restrictions and export clean open versions. All keys are processed 100% locally in your sandboxed browser.
        </p>
      </div>

      {!file ? (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-xs">
          <FileUploader 
            onFileSelected={(files) => analyzeFileSelected(files[0])} 
            acceptType="pdf"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 font-sans">
          {/* File details column */}
          <div className="md:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-850 dark:text-slate-250 uppercase tracking-widest">
                  Documents Node
                </span>
                <button
                  onClick={handleClear}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-lg text-slate-500 scale-90 ${
                  isEncrypted ? 'bg-rose-50 dark:bg-rose-955/20 text-rose-600' : 'bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-250 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">
                    {formatSize(file.size)} {pageCount > 0 && `• ${pageCount} Pages`}
                  </p>
                </div>
              </div>

              {/* Unlock trigger UI card based on encryption status */}
              {isEncrypted ? (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2 relative">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                      Enter Security Password
                    </label>
                    <div className="relative">
                      <input
                        id="unencrypt-pdf-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Required password..."
                        className="w-full text-xs pr-10 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-750 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {decryptError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-955/25 border border-rose-100 dark:border-rose-900/30 text-[10px] font-semibold text-rose-600 rounded-xl">
                      {decryptError}
                    </div>
                  )}

                  <button
                    onClick={handleDecryptAndDownload}
                    disabled={processing || !password}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all hover:scale-102 active:scale-98 disabled:opacity-45 disabled:scale-100 cursor-pointer"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        Unlocking...
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                        Unlock & Download Open PDF
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl space-y-2 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-650 mx-auto" />
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">File already open</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal">
                      This file does not have any active password protections or locked encryption containers.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Secure Challenge status mock display */}
          <div className="md:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm space-y-6">
              {isEncrypted ? (
                <div className="relative border border-slate-250 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 rounded-xl p-5 flex flex-col items-center justify-center min-h-[190px] text-center overflow-hidden">
                  {successfullyUnlocked ? (
                    <>
                      <div className="p-4 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 rounded-full mb-3 shadow-xs border border-emerald-100">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-250">
                        Unlocked Successfully!
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-normal">
                        Your browser generated record has been successfully compiled and saved with empty permissions schemas, making it fully unlocked.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="p-4 bg-rose-50 dark:bg-rose-955/20 text-rose-600 rounded-full mb-3 shadow-sm border border-rose-100 dark:border-rose-900/30 scale-103 animate-pulse">
                        <Lock className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                        Security Restrictions Active
                      </p>
                      <p className="text-[10px] text-slate-505 dark:text-slate-400 max-w-sm mt-1 leading-normal">
                        This PDF is currently sealed by standard crypto wrappers. Provide matching passwords to remove editing boundaries, printing locks, and view limitations.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative border border-slate-250 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 rounded-xl p-5 flex flex-col items-center justify-center min-h-[190px] text-center overflow-hidden">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-955/20 text-emerald-600 rounded-full mb-3 shadow-sm border border-emerald-100">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <p className="text-xs font-bold text-slate-850 dark:text-slate-200">
                    Sufficient Privileges Available
                  </p>
                  <p className="text-[10px] text-slate-505 dark:text-slate-400 max-w-sm mt-1 leading-normal">
                    This file is completely open and does not demand any password decrypt calls. You can use standard edit, split, paginate, or watermark tools inside the workspace natively.
                  </p>
                </div>
              )}

              {processing && (
                <div className="bg-slate-50 dark:bg-slate-905 border border-slate-150 dark:border-slate-800 rounded-xl p-3 text-center space-y-1 animate-pulse">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block font-sans">
                    Challenge Output Logs
                  </span>
                  <div className="text-[10px] text-slate-655 dark:text-slate-350 font-mono">
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
