import React, { useState, useEffect, useRef } from 'react';
import { Headphones, ArrowLeft, Loader2, Play, Pause, Square, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileUploader } from '../../components/FileUploader';

export default function AudiobookStudioTool({ onBackToDashboard, initialFile, onFileLoaded }: any) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState(false);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageText, setPageText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentVoiceURI, setCurrentVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  
  const synth = window.speechSynthesis;

  useEffect(() => {
    const handleVoicesChanged = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (v.length > 0 && !currentVoiceURI) {
          const defaultVoice = v.find(voice => voice.default) || v[0];
          setCurrentVoiceURI(defaultVoice.voiceURI);
      }
    };
    
    synth.onvoiceschanged = handleVoicesChanged;
    handleVoicesChanged(); // initial 
    
    return () => {
        synth.cancel();
    };
  }, []);

  const initDoc = async (f: File) => {
    if (!f) return;
    setLoading(true);
    try {
      const arrayBuffer = await f.arrayBuffer();
      if (arrayBuffer.byteLength === 0) throw new Error("Empty file buffer");
      const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPdfDoc(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setCurrentPage(1);
      onFileLoaded?.(f, loadedPdf.numPages);
      loadPageText(loadedPdf, 1);
    } catch (e) {
      console.error("PDF Load Error:", e);
      alert('Error loading PDF');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (file && !pdfDoc) {
      initDoc(file);
    }
  }, [file]);

  const loadPageText = async (doc: any, pageNum: number) => {
      setLoading(true);
      try {
          const page = await doc.getPage(pageNum);
          const textContent = await page.getTextContent();
          const strings = textContent.items.map((item: any) => item.str);
          
          let fullText = strings.join(' ');
          fullText = fullText.replace(/\s+/g, ' ').trim();
          
          setPageText(fullText);
          
          // Auto play if we were playing
          if (isPlaying && fullText) {
             speakText(fullText);
          }
      } catch(e) {
          console.error(e);
      }
      setLoading(false);
  };

  // Change page
  useEffect(() => {
      if (pdfDoc) {
          synth.cancel(); // Stop current speech when page changes
          loadPageText(pdfDoc, currentPage);
      }
  }, [currentPage, pdfDoc]);

  const speakText = (textToSpeak: string) => {
      synth.cancel();
      if (!textToSpeak) return;
      
      const utterThis = new SpeechSynthesisUtterance(textToSpeak);
      const voice = voices.find(v => v.voiceURI === currentVoiceURI);
      if (voice) {
          utterThis.voice = voice;
      }
      utterThis.rate = rate;
      
      utterThis.onend = () => {
          setIsPlaying(false);
          // Auto advance to next page if not on last page
          if (currentPage < numPages) {
              setCurrentPage(c => c + 1);
              setIsPlaying(true); // keeps playing
          }
      };
      
      synth.speak(utterThis);
      setIsPlaying(true);
  };

  const handlePlayPause = () => {
      if (isPlaying) {
          synth.pause();
          setIsPlaying(false);
      } else {
          if (synth.paused) {
              synth.resume();
          } else {
              speakText(pageText);
          }
          setIsPlaying(true);
      }
  };

  const handleStop = () => {
      synth.cancel();
      setIsPlaying(false);
  };

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto">
        <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <Headphones className="w-8 h-8 text-emerald-500" />
            Audiobook Studio
          </h1>
          <p className="text-slate-500">
            Listen to your documents read aloud with real-time text-to-speech.
          </p>
        </div>
        <FileUploader onFileSelected={(files) => setFile(files[0])} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
         <div className="flex flex-col items-center justify-center mb-10 space-y-4">
             <div className="w-48 h-64 bg-slate-100 dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center relative overflow-hidden">
                 <Headphones className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                 {isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                       </span>
                    </div>
                 )}
             </div>
             
             <div className="text-center">
                 <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate max-w-sm" title={file.name}>
                     {file.name}
                 </h2>
                 <p className="text-sm text-slate-500">Page {currentPage} of {numPages}</p>
             </div>
         </div>
         
         <div className="flex justify-center items-center gap-6 mb-10">
              <button 
                  onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                  disabled={currentPage <= 1}
                  className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full disabled:opacity-50 transition-colors"
               >
                  <SkipBack className="w-6 h-6" />
              </button>
              
              <button 
                  onClick={handlePlayPause}
                  disabled={!pageText && !isPlaying}
                  className="w-16 h-16 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg disabled:opacity-50 transition-transform active:scale-95"
               >
                  {isPlaying ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8 ml-1" fill="currentColor" />}
              </button>
              
               <button 
                  onClick={handleStop}
                  disabled={!isPlaying && !synth.paused}
                  className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full disabled:opacity-50 transition-colors"
               >
                  <Square className="w-6 h-6" fill="currentColor" />
              </button>
              
              <button 
                  onClick={() => setCurrentPage(c => Math.min(numPages, c + 1))}
                  disabled={currentPage >= numPages}
                  className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-full disabled:opacity-50 transition-colors"
               >
                  <SkipForward className="w-6 h-6" />
              </button>
         </div>
         
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Voice</label>
                <select 
                   value={currentVoiceURI}
                   onChange={(e) => {
                       setCurrentVoiceURI(e.target.value);
                       if (isPlaying) {
                           handleStop();
                           setTimeout(() => handlePlayPause(), 100);
                       }
                   }}
                   className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm rounded-lg px-3 py-2 cursor-pointer"
                >
                   {voices.map(v => (
                       <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                   ))}
                </select>
             </div>
             
             <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between">
                    <span>Speed</span>
                    <span className="text-emerald-600">{rate.toFixed(1)}x</span>
                </label>
                <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={rate} 
                    onChange={(e) => {
                        setRate(parseFloat(e.target.value));
                        if(isPlaying) {
                           handleStop(); // synth rate can't be changed on the fly reliably
                           setTimeout(() => handlePlayPause(), 50);
                        }
                    }}
                    className="w-full accent-emerald-500 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer mt-3"
                />
             </div>
         </div>
         
         <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-8">
             <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex justify-between items-center">
                 Page Readout
                 {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
             </h3>
             <div className="h-48 overflow-y-auto bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap font-serif">
                   {pageText || (loading ? "Extracting text..." : "No readable text found on this page.")}
                </p>
             </div>
         </div>

      </div>
    </div>
  );
}
