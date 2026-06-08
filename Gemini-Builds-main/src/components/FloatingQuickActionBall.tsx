import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  BookOpen, 
  Scissors, 
  Image, 
  FileImage, 
  PenTool, 
  Award, 
  QrCode, 
  Combine, 
  Hash, 
  FileSearch, 
  LockKeyhole, 
  Unlock, 
  Maximize, 
  ShieldBan, 
  PaintBucket, 
  GitPullRequest, 
  FormInput, 
  Headphones 
} from 'lucide-react';
import { TOOLS } from '../data/tools';

// Map icon name string to Lucide component
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  BookOpen,
  Scissors,
  Image,
  FileImage,
  PenTool,
  Stamp: Award,
  QrCode,
  Combine,
  Hash,
  FileSearch,
  LockKeyhole,
  Unlock,
  Maximize,
  ShieldBan,
  PaintBucket,
  GitPullRequest,
  FormInput,
  Headphones
};

interface FloatingActionBallProps {
  onSelectTool: (id: string) => void;
  activeTool: string;
}

export default function FloatingQuickActionBall({ onSelectTool, activeTool }: FloatingActionBallProps) {
  // Coordinates representing the center of the ball
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDocked, setIsDocked] = useState(false);
  const [dockedEdge, setDockedEdge] = useState<'left' | 'right' | null>(null);
  const [isListOpen, setIsListOpen] = useState(false);
  
  // Track viewport dimensions
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Refs for tracking drag gestures & timer states
  const isPointerDownRef = useRef(false);
  const isDraggingRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const longPressTimeoutRef = useRef<number | null>(null);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, ballX: 0, ballY: 0 });
  const ballRef = useRef<HTMLDivElement>(null);

  const radius = 28; // Ball radius is 28px (diameter 56px)

  // Track viewport dimensions
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({ width, height });

      // Default bottom-right position on initial load
      setPosition((prev) => {
        if (prev.x === 0 && prev.y === 0) {
          return { x: width - 80, y: height - 160 };
        }
        // Clamped reposition on resize
        const clampX = Math.max(radius + 16, Math.min(width - radius - 16, prev.x));
        const clampY = Math.max(64 + radius + 16, Math.min(height - radius - 16, prev.y));
        return { x: clampX, y: clampY };
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Clamps position inside safe screen bounds
  const clampPosition = (x: number, y: number) => {
    const minX = radius + 16;
    const maxX = viewport.width - radius - 16;
    const minY = 64 + radius + 16; // Restrict behind top nav bar layout
    const maxY = viewport.height - radius - 16;
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y))
    };
  };

  // Helper to extract coordinates supporting both touch & mouse events
  const getClientCoords = (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if ('touches' in e && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    const mouseEv = e as MouseEvent;
    return { x: mouseEv.clientX, y: mouseEv.clientY };
  };

  // Helper to dock/snap to nearest edge
  const dockToNearestEdge = (yCoord?: number) => {
    setIsDocked(true);
    const currentY = yCoord !== undefined ? yCoord : position.y;
    const goLeft = position.x < viewport.width / 2;
    if (goLeft) {
      setDockedEdge('left');
      setPosition({ x: 0, y: currentY });
    } else {
      setDockedEdge('right');
      setPosition({ x: viewport.width, y: currentY });
    }
    if (navigator.vibrate) {
      try { navigator.vibrate([40, 40]); } catch {}
    }
  };

  // Double tap snapping handler
  const handleDoubleClick = () => {
    dockToNearestEdge();
  };

  // Dock release click popout
  const handleUndock = () => {
    setIsDocked(false);
    const snapBackX = dockedEdge === 'left' ? radius + 24 : viewport.width - radius - 24;
    setPosition({ x: snapBackX, y: position.y });
    setDockedEdge(null);
    if (navigator.vibrate) {
      try { navigator.vibrate(30); } catch {}
    }
  };

  // Gesture Touch Start Trigger
  const handleStart = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (isDocked) {
      handleUndock();
      return;
    }

    if (isListOpen) {
      setIsListOpen(false);
      return;
    }

    const now = Date.now();
    // Double click detector within 300ms
    if (now - lastClickTimeRef.current < 300) {
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      handleDoubleClick();
      lastClickTimeRef.current = 0;
      return;
    }
    lastClickTimeRef.current = now;

    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    const coords = getClientCoords(e);
    dragStartRef.current = {
      pointerX: coords.x,
      pointerY: coords.y,
      ballX: position.x,
      ballY: position.y
    };

    // Long Press triggers 0.75s (750ms) activation
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
    }
    longPressTimeoutRef.current = window.setTimeout(() => {
      setIsListOpen(true);
      if (navigator.vibrate) {
        try { navigator.vibrate(50); } catch {}
      }
    }, 750); 
  };

  // Move tracking logic
  const handleMove = (e: React.TouchEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    if (isDocked) return;

    const coords = getClientCoords(e);

    // If list is open, we do not drag the ball, we let the user scroll or tap items
    if (isListOpen) {
      return;
    }

    // Default drag displacement buffer
    const dx = coords.x - dragStartRef.current.pointerX;
    const dy = coords.y - dragStartRef.current.pointerY;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      if (longPressTimeoutRef.current) {
        window.clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      if (e.cancelable) e.preventDefault();
      const nextX = dragStartRef.current.ballX + dx;
      const nextY = dragStartRef.current.ballY + dy;
      const clamped = clampPosition(nextX, nextY);
      setPosition(clamped);
    }
  };

  // Global Mouse and Touch Release bindings
  const handleEnd = () => {
    isPointerDownRef.current = false;

    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    isDraggingRef.current = false;
  };

  useEffect(() => {
    const globalMove = (e: TouchEvent | MouseEvent) => {
      if (!isPointerDownRef.current) return;
      if (isListOpen) return;
      
      const coords = getClientCoords(e);
      if (isDraggingRef.current) {
        const dx = coords.x - dragStartRef.current.pointerX;
        const dy = coords.y - dragStartRef.current.pointerY;
        const nextX = dragStartRef.current.ballX + dx;
        const nextY = dragStartRef.current.ballY + dy;
        const clamped = clampPosition(nextX, nextY);
        setPosition(clamped);
      }
    };

    const globalEnd = () => {
      if (isPointerDownRef.current) {
        handleEnd();
      }
    };

    window.addEventListener('mousemove', globalMove);
    window.addEventListener('mouseup', globalEnd);
    window.addEventListener('touchmove', globalMove, { passive: false });
    window.addEventListener('touchend', globalEnd);

    return () => {
      window.removeEventListener('mousemove', globalMove);
      window.removeEventListener('mouseup', globalEnd);
      window.removeEventListener('touchmove', globalMove);
      window.removeEventListener('touchend', globalEnd);
    };
  }, [position, isListOpen, viewport]);

  // Compute smart positioning for the menu box
  const listWidth = 280;
  const isBottomHalf = position.y > viewport.height / 2;

  // Horizontal Alignment: avoid list bleeding off left or right screen boundaries with margin padding
  let listLeft = position.x - listWidth / 2;
  const paddingBuffer = 16;
  if (viewport.width > 0) {
    if (listLeft < paddingBuffer) {
      listLeft = paddingBuffer;
    } else if (listLeft + listWidth > viewport.width - paddingBuffer) {
      listLeft = viewport.width - listWidth - paddingBuffer;
    }
  }

  const listStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${listLeft}px`,
    width: `${listWidth}px`,
    zIndex: 9990,
  };

  if (isBottomHalf) {
    // Render above the ball
    listStyle.bottom = `${viewport.height - position.y + 36}px`;
  } else {
    // Render below the ball
    listStyle.top = `${position.y + 36}px`;
  }

  return (
    <>
      {/* Click outside backdrop handler */}
      {isListOpen && (
        <div 
          id="list-menu-backdrop"
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[1px] z-[9980] animate-in fade-in duration-250 cursor-default"
          onClick={() => setIsListOpen(false)}
          onTouchStart={(e) => {
            e.stopPropagation();
            setIsListOpen(false);
          }}
        />
      )}

      {/* Styled Popover list of Quick Tools */}
      {isListOpen && (
        <div
          id="list-menu-container"
          style={listStyle}
          className="bg-slate-900/95 dark:bg-slate-950/98 border border-white/10 rounded-2xl shadow-3xl flex flex-col overflow-hidden max-h-[45vh] animate-in fade-in slide-in-from-bottom-2 duration-200 select-none cursor-default"
          onClick={(e) => e.stopPropagation()} // Prevent closing when interacting inside
        >
          {/* Popover Header */}
          <div className="px-4 py-3 bg-slate-950/40 border-b border-white/5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Local Tools Workspace
              </span>
              <span className="text-xs text-emerald-400 font-bold mt-1">
                Quick Action Menu
              </span>
            </div>
            <button 
              onClick={() => setIsListOpen(false)} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* List items wrapper */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 scrollbar scrollbar-thin scrollbar-thumb-slate-700">
            {TOOLS.map((tool) => {
              const ToolIcon = iconMap[tool.icon] || Sparkles;
              const isActive = activeTool === tool.id;
              
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onSelectTool(tool.id);
                    setIsListOpen(false);
                    // Hide/dock the floating quick action ball near the nearest border
                    dockToNearestEdge();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 group ${
                    isActive 
                      ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold shadow-sm shadow-emerald-500/5' 
                      : 'text-slate-200 border border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  {/* Icon Frame */}
                  <div className={`p-1.5 rounded-lg flex-shrink-0 transition-all ${
                    isActive 
                      ? 'bg-emerald-500/20 text-emerald-300' 
                      : 'bg-slate-800/80 text-slate-300 group-hover:bg-slate-700/80 group-hover:text-white'
                  }`}>
                    <ToolIcon className="w-4 h-4" />
                  </div>

                  {/* Name and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate leading-tight group-hover:translate-x-0.5 transition-transform duration-150">
                      {tool.name}
                    </div>
                    {tool.category && (
                      <div className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400 mt-0.5 opacity-80">
                        {tool.category}
                      </div>
                    )}
                  </div>

                  {/* Accent Active Pin Indicator */}
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Floating Circle Controller & drag handle */}
      <div
        id="floating-quick-action-ball"
        ref={ballRef}
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        onMouseMove={handleMove}
        onTouchMove={handleMove}
        onMouseUp={handleEnd}
        onTouchEnd={handleEnd}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          touchAction: 'none',
        }}
        className={`w-14 h-14 rounded-full select-none shadow-2xl z-[9999] flex items-center justify-center cursor-pointer transition-all duration-200 ${
          isDocked 
            ? 'bg-slate-800/70 hover:bg-slate-800 border border-white/20 opacity-60 hover:opacity-100 hover:scale-[1.1]' 
            : isListOpen 
              ? 'bg-slate-950 scale-110 text-emerald-400 border border-emerald-500 shadow-md shadow-emerald-500/20' 
              : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:scale-[1.05]'
        }`}
      >
        {isDocked ? (
          dockedEdge === 'left' ? (
            <div className="pl-6 select-none flex items-center justify-center">
              <ChevronRight className="w-5 h-5 text-white animate-pulse" />
            </div>
          ) : (
            <div className="pr-6 select-none flex items-center justify-center">
              <ChevronLeft className="w-5 h-5 text-white animate-pulse" />
            </div>
          )
        ) : isListOpen ? (
          <X className="w-5 h-5 select-none animate-in spin-in-90 duration-200" />
        ) : (
          <Compass className="w-5 h-5 select-none animate-pulse" />
        )}

        {/* Outer ambient wave pulses */}
        {!isDocked && !isListOpen && (
          <span className="absolute -inset-1 rounded-full border border-teal-500/25 animate-ping pointer-events-none" style={{ animationDuration: '4s' }} />
        )}
      </div>
    </>
  );
}
