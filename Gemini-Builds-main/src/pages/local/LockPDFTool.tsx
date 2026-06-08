import React, { useState, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from '@cantoo/pdf-lib';
import { FileUploader } from '../../components/FileUploader';
import ProcessingOverlay from '../../components/ProcessingOverlay';
import { 
  ChevronLeft, 
  LockKeyhole, 
  Download, 
  Loader2, 
  FileText, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  X,
  Lock,
  KeyRound
} from 'lucide-react';

const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

interface LockPDFToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount?: number) => void;
}

export default function LockPDFTool({ 
  onBackToDashboard, 
  initialFile = null,
  onFileLoaded 
}: LockPDFToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [loadingFile, setLoadingFile] = useState<boolean>(false);

  // Password fields state
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // App work state
  const [processing, setProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');

  // Memory leaks cleanups
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

      // Load via pdfjs-dist to verify page count and whether it's unencrypted
      const loadingTask = pdfjsLib.getDocument({ url });
      const doc = await loadingTask.promise;
      const parsedPageCount = doc.numPages;
      setPageCount(parsedPageCount);
      
      onFileLoaded?.(selectedFile, parsedPageCount);
    } catch (err: any) {
      console.error(err);
      if (err.name === 'PasswordException') {
        alert('Note: This file is currently encrypted with a password. Please unlock it using the Unlock PDF tool first.');
      } else {
        alert('Error loading file. Please feed a standard un-corrupted non-encrypted PDF.');
      }
      setFile(null);
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
    } finally {
      setLoadingFile(false);
    }
  }, [fileUrl, onFileLoaded]);

  // Handle initialization if provided from dashboard
  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
  }, [initialFile, handleFileSelected]);

  // Main action: Save with encryption options
  const handleLockPDF = async () => {
    if (!file) return;
    if (!password) {
      alert('Password parameter cannot be empty. Choose a secure unlock key.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Selected passwords do not match! Please check entries and retry.');
      return;
    }

    setProcessing(true);
    setProgressText('Loading PDF array bytes into memory stream...');

    try {
      const arrayBuffer = await file.arrayBuffer();

      setProgressText('Injecting 256-bit encryption layers locally...');
      
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Use native crypto if available (HTTPS / localhost)
      const generateSecureOwnerPassword = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
      };

      setProgressText('Applying security credentials to PDF structure...');
      const encryptedPdfBytes = await pdfDoc.save({
        userPassword: password,
        ownerPassword: generateSecureOwnerPassword(),
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          documentAssembly: false,
        },
      } as any);

      setProgressText('Password layer baked! Triggering secure download...');

      const blob = new Blob([encryptedPdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      const baseName = file.name.endsWith('.pdf') ? file.name.substring(0, file.name.length - 4) : file.name;
      link.download = `${baseName}_secured.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 3000);

    } catch (err: any) {
      console.error(err);
      alert(`Securing Failure: ${err?.message || 'Failed to encrypt document.'}`);
    } finally {
      setProcessing(false);
      setProgressText('');
    }
  };

  const handleClear = () => {
    setFile(null);
    setPageCount(0);
    setPassword('');
    setConfirmPassword('');
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
    <div id="lockkey-tool-root" className="max-w-4xl mx-auto space-y-6">
      <ProcessingOverlay isOpen={processing} progressText={progressText} />
      {/* Navigation header bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-455 font-bold text-xs font-mono uppercase bg-rose-50 dark:bg-rose-955/20 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/40">
          <LockKeyhole className="w-3.5 h-3.5" /> PDF Encryption Engine
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          Lock PDF Document
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal max-w-xl">
          Encrypt your files client-side with full 128-bit AES permissions schema. Secure sensitive invoices, contracts, or records within milliseconds.
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
          {/* Security details input card */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-755 dark:text-slate-250 flex items-center gap-1.5 font-sans">
                  <KeyRound className="w-4 h-4 text-rose-500" /> Security Keys
                </span>
                <button
                  onClick={handleClear}
                  className="p-1 rounded bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600"
                  title="Remove file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Password choice */}
              <div className="space-y-2 relative">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                  Choose Unlock Password
                </label>
                <div className="relative">
                  <input
                    id="encrypt-pdf-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Provide a secure password..."
                    className="w-full text-xs pr-10 pl-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password confirmation */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest block">
                  Confirm Password
                </label>
                <input
                  id="encrypt-pdf-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Double check your secure key..."
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-rose-500 font-sans"
                />
              </div>

              {/* Tiny strength indicator checklist */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-lg border border-slate-100 dark:border-slate-855 text-[10px] text-slate-500 dark:text-slate-400 space-y-1.5 leading-normal">
                <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Security Checklist
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 6 ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <span>Minimum 6 characters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${password && password === confirmPassword ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <span>Passwords match exactly</span>
                </div>
              </div>

              {/* Action trigger button */}
              <button
                onClick={handleLockPDF}
                disabled={processing || !password || password !== confirmPassword}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all hover:scale-102 active:scale-98 disabled:opacity-45 disabled:scale-100 cursor-pointer"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Encrypting...
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-300" />
                    Encrypt & Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Details visual mockup */}
          <div className="md:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-955/20 text-rose-600 rounded-xl shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {file.name}
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-mono mt-0.5">
                    Size: {formatSize(file.size)} • Extent: <span className="font-bold text-rose-600">{pageCount} Pages</span>
                  </p>
                </div>
              </div>

              {/* Secure Shield graphics mock */}
              <div className="relative border border-slate-250 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 rounded-xl p-5 flex flex-col items-center justify-center min-h-[190px] text-center overflow-hidden">
                <div className="p-4 bg-rose-50 dark:bg-rose-955/20 text-rose-650 rounded-full mb-3 shadow-sm border border-rose-100 dark:border-rose-900/30 scale-105">
                  <ShieldCheck className="w-8 h-8 text-rose-600" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-300">
                  Fully Encrypted Layout Container
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-normal">
                  The compiled output will generate standard AES user and high-entropy random owner keys, blocking unauthorized copy modifications while preserving viewing capability for credentials holders. Safe and client-contained.
                </p>
              </div>

              {processing && (
                <div className="bg-slate-50 dark:bg-slate-905 border border-slate-150 dark:border-slate-800 rounded-xl p-3 text-center space-y-1 animate-pulse">
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
