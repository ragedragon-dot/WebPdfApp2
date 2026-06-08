import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, DownloadCloud, FileText } from 'lucide-react';

interface ProcessingOverlayProps {
  isOpen: boolean;
  progressText: string;
  hasError?: boolean;
}

export default function ProcessingOverlay({
  isOpen,
  progressText,
  hasError = false,
}: ProcessingOverlayProps) {
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'working' | 'completed'>('working');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize internal visibility state with props with a small delay for exit animations
  useEffect(() => {
    if (isOpen) {
      setActive(true);
      setStatus('working');
      setProgress(0);

      // Start simulating progress smoothly
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev < 30) {
            return prev + Math.floor(Math.random() * 8) + 4; // fast start
          } else if (prev < 75) {
            return prev + Math.floor(Math.random() * 4) + 1; // steady progress
          } else if (prev < 95) {
            return prev + (Math.random() > 0.4 ? 1 : 0); // slow near the end
          }
          return prev;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      
      if (active && !hasError) {
        // Complete the progress to 100 and show success transition
        setStatus('completed');
        setProgress(100);
        
        // Let user see 100% and download success animation before closing
        const closeTimeout = setTimeout(() => {
          setActive(false);
        }, 1800);
        
        return () => clearTimeout(closeTimeout);
      } else {
        // Clear immediately if there's an error or if not previously active
        setActive(false);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, active, hasError]);

  return (
    <AnimatePresence>
      {active && (
        <div id="processing-overlay-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blur background backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/65 backdrop-blur-md"
          />

          {/* Active modal card container */}
          <motion.div
            initial={{ scale: 0.9, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center justify-center text-center overflow-hidden"
          >
            {/* Ambient background accent glow */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            
            {status === 'working' ? (
              <div className="w-full space-y-5">
                {/* File & Gear Visual processing animation */}
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                    className="absolute inset-0 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-700"
                  />
                  <div className="absolute inset-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 leading-none">
                    Assembling Document
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-slate-400 max-w-[240px] mx-auto truncate font-mono">
                    {progressText || 'Compiling changes...'}
                  </p>
                </div>

                {/* Processing bar and metrics */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold px-1">
                    <span>PROGRESS STATUS</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200/40 dark:border-slate-800/40">
                    <motion.div
                      layoutId="progress-indicator-bar"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.1, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-5 py-2">
                {/* Deluxe download complete visualizer */}
                <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                  {/* Exploding radial circles */}
                  <motion.div
                    initial={{ scale: 0.6, opacity: 1 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-900/30"
                  />
                  <motion.div
                    initial={{ scale: 0.4, opacity: 1 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-full border-2 border-emerald-400"
                  />

                  {/* Bouncing file / check block */}
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
                    className="relative w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <CheckCircle2 className="w-9 h-9" />
                  </motion.div>

                  {/* Floating particles or drop badges */}
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 22, opacity: [0, 1, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 text-white"
                  >
                    <div className="bg-emerald-600 p-1 rounded-full shadow-md border border-emerald-400">
                      <DownloadCloud className="w-3.5 h-3.5" />
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                    Compilation Complete!
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold tracking-wide">
                    File triggered for secure download
                  </p>
                </div>

                {/* Static full status tracker */}
                <div className="w-full">
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-250 dark:border-slate-800">
                    <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans font-semibold mt-2.5 block">
                    All operations successfully finalized
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
