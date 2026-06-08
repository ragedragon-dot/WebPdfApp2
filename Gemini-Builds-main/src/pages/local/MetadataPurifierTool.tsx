import React, { useState, useEffect } from 'react';
import { PaintBucket, ShieldCheck, AlertCircle, FileText, ArrowLeft, Loader2, Sparkles, XCircle, Edit3, Save } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { FileUploader } from '../../components/FileUploader';

interface MetadataPurifierToolProps {
  onBackToDashboard: () => void;
  initialFile?: File | null;
  onFileLoaded?: (file: File, pageCount: number) => void;
}

export default function MetadataPurifierTool({
  onBackToDashboard,
  initialFile,
  onFileLoaded
}: MetadataPurifierToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [purifying, setPurifying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [metadata, setMetadata] = useState<{
    title: string;
    author: string;
    subject: string;
    creator: string;
    producer: string;
    creationDate: string;
    modificationDate: string;
  } | null>(null);

  const [editFormData, setEditFormData] = useState({
    title: '',
    author: '',
    subject: '',
    creator: '',
    producer: ''
  });

  useEffect(() => {
    if (initialFile) {
      handleFileSelected(initialFile);
    }
    
    // Cleanup strict ObjectURLs
    return () => {
    };
  }, [initialFile]);

  const handleFileSelected = async (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.endsWith('.pdf')) {
      alert('Please select a valid PDF file.');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: true });
      
      const pageCount = pdfDoc.getPageCount();
      onFileLoaded?.(selectedFile, pageCount);

      const title = pdfDoc.getTitle() || '';
      const author = pdfDoc.getAuthor() || '';
      const subject = pdfDoc.getSubject() || '';
      const creator = pdfDoc.getCreator() || '';
      const producer = pdfDoc.getProducer() || '';

      // Extract metadata
      setMetadata({
        title: title || 'Empty',
        author: author || 'Empty',
        subject: subject || 'Empty',
        creator: creator || 'Empty',
        producer: producer || 'Empty',
        creationDate: pdfDoc.getCreationDate() ? pdfDoc.getCreationDate()?.toLocaleString() || 'Empty' : 'Empty',
        modificationDate: pdfDoc.getModificationDate() ? pdfDoc.getModificationDate()?.toLocaleString() || 'Empty' : 'Empty',
      });

      setEditFormData({ title, author, subject, creator, producer });
    } catch (err) {
      console.error(err);
      alert('Failed to read PDF metadata. It might be encrypted.');
    } finally {
      setLoading(false);
    }
  };

  const savePdfWithMetadata = async (newMetadata: { title: string, author: string, subject: string, creator: string, producer: string }, downloadNamePrefix: string) => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      pdfDoc.setTitle(newMetadata.title);
      pdfDoc.setAuthor(newMetadata.author);
      pdfDoc.setSubject(newMetadata.subject);
      pdfDoc.setCreator(newMetadata.creator);
      pdfDoc.setProducer(newMetadata.producer);
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `[${downloadNamePrefix}]_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMetadata({
        title: newMetadata.title || 'Empty',
        author: newMetadata.author || 'Empty',
        subject: newMetadata.subject || 'Empty',
        creator: newMetadata.creator || 'Empty',
        producer: newMetadata.producer || 'Empty',
        creationDate: metadata?.creationDate || 'Empty',
        modificationDate: (new Date()).toLocaleString(),
      });
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handlePurify = async () => {
    setPurifying(true);
    const purifiedData = {
      title: 'Document',
      author: 'Anonymous',
      subject: '',
      creator: 'CleanPDF Studio',
      producer: 'CleanPDF Studio'
    };
    const success = await savePdfWithMetadata(purifiedData, 'Cleaned');
    if (success) {
      setEditFormData(purifiedData);
      setIsEditing(false);
    } else {
      alert('Failed to purify document.');
    }
    setPurifying(false);
  };

  const handleSaveEdits = async () => {
    setPurifying(true); // Reusing loading state for saving
    const success = await savePdfWithMetadata(editFormData, 'Edited');
    if (success) {
      setIsEditing(false);
    } else {
      alert('Failed to save edited metadata.');
    }
    setPurifying(false);
  };

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button
          onClick={onBackToDashboard}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </button>
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <PaintBucket className="w-8 h-8 text-emerald-500" />
            Metadata Editor & Purifier
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Edit or completely strip hidden tracking identifiers and history from your PDF files.
          </p>
        </div>
        <FileUploader 
            onFileSelected={(files) => handleFileSelected(files[0])} 
            acceptType="pdf"
          />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToDashboard}
          className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Dashboard
        </button>
        <button
          onClick={() => {
            setFile(null);
            setMetadata(null);
            setIsEditing(false);
          }}
          className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:opacity-80"
        >
          Upload Different File
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
              <PaintBucket className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate max-w-sm">
                {file.name}
              </h2>
              <p className="text-sm text-slate-500 border-emerald-500 flex items-center gap-1.5 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
                Metadata Details
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={purifying || loading}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  disabled={purifying || loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {purifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Edits
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  disabled={purifying || loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={handlePurify}
                  disabled={purifying || loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {purifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Purify All
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-500" />
            <p>Extracting embedded properties...</p>
          </div>
        ) : isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['title', 'author', 'subject', 'creator', 'producer'] as const).map((field) => (
              <div key={field} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {field.replace(/([A-Z])/g, ' $1').trim()}
                </label>
                <input
                  type="text"
                  value={editFormData[field]}
                  onChange={(e) => setEditFormData({ ...editFormData, [field]: e.target.value })}
                  placeholder={`Enter ${field}...`}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metadata && Object.entries(metadata).map(([key, value]) => {
              const isEmpty = value === 'Empty' || value === '';
              const isPurified = value === 'Anonymous' || value === 'Document' || value === 'CleanPDF Studio' || value === 'Purified';
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
              
              return (
                <div key={key} className="flex flex-col p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    {label}
                  </span>
                  <div className="flex items-center gap-2">
                    {isPurified ? (
                      <Sparkles className="w-4 h-4 text-emerald-500 opacity-80" />
                    ) : isEmpty ? (
                      <XCircle className="w-4 h-4 text-slate-400 opacity-60" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 opacity-80" />
                    )}
                    <span className={`text-sm font-medium truncate ${isPurified ? 'text-emerald-600 dark:text-emerald-400' : isEmpty ? 'text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {value || 'Empty'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
