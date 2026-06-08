import React, { useEffect, useState, useRef } from 'react';
import { TOOLS } from '../data/tools';
import { ToolId } from '../types';
import * as Icons from 'lucide-react';

interface WeaponWheelProps {
  onSelectTool: (id: ToolId) => void;
  active: boolean;
  onClose: () => void;
}

export default function WeaponWheel({ onSelectTool, active, onClose }: WeaponWheelProps) {
  const [shouldRender, setShouldRender] = useState(active);
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const hoveredIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (active) {
      setShouldRender(true);
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      const t = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(t);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      if (hoveredIndexRef.current !== null) {
        if (hoveredIndexRef.current === -1) {
          onSelectTool('dashboard' as any);
        } else {
          onSelectTool(TOOLS[hoveredIndexRef.current].id);
        }
        hoveredIndexRef.current = null;
      }
      setHoveredIndex(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Calculate angle from 0 to 2PI (0 is right, Math.PI/2 is top, etc.)
      // Math.atan2 returns -PI to PI
      let angle = Math.atan2(dy, dx);
      if (angle < 0) {
        angle += 2 * Math.PI;
      }
      
      // Add 90 degrees offset because we start at top (-90 degrees)
      angle += Math.PI / 2;
      if (angle > 2 * Math.PI) {
        angle -= 2 * Math.PI;
      }

      if (distance > 60 && distance < 300) { // Deadzone in middle, outer bound
        const segmentAngle = (2 * Math.PI) / TOOLS.length;
        const index = Math.floor(angle / segmentAngle);
        // Correct index based on drawing logic: we start at -90 degrees (top)
        const idx = index % TOOLS.length;
        setHoveredIndex(idx);
        hoveredIndexRef.current = idx;
      } else if (distance <= 60) {
        setHoveredIndex(-1);
        hoveredIndexRef.current = -1;
      } else {
        setHoveredIndex(null);
        hoveredIndexRef.current = null;
      }
    };

    const handleMouseUp = () => {
      if (hoveredIndexRef.current !== null) {
        if (hoveredIndexRef.current === -1) {
          onSelectTool('dashboard' as any);
        } else {
          onSelectTool(TOOLS[hoveredIndexRef.current].id);
        }
        hoveredIndexRef.current = null;
      }
      onClose();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [active, onSelectTool, onClose]);

  if (!shouldRender) return null;

  const radius = 180;
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none transition-opacity duration-200 ease-in-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
      <div ref={wheelRef} className="relative w-[500px] h-[500px]">
        {/* Draw Segments */}
        <div className="absolute inset-x-0 inset-y-0 p-8 z-0">
            <svg viewBox="-250 -250 500 500" className="w-full h-full transform -rotate-90">
              {TOOLS.map((tool, index) => {
                const total = TOOLS.length;
                const segmentAngle = (2 * Math.PI) / total;
                const startAngle = index * segmentAngle;
                const endAngle = (index + 1) * segmentAngle;
                
                // SVG arc coordinates
                // Adjusting the outer radius and inner radius (doughnut style)
                const outerR = 250;
                const innerR = 60;
                
                const getCoords = (r: number, a: number) => {
                  return {
                    x: r * Math.cos(a),
                    y: r * Math.sin(a)
                  };
                };
                
                const p1 = getCoords(outerR, startAngle);
                const p2 = getCoords(outerR, endAngle);
                const p3 = getCoords(innerR, endAngle);
                const p4 = getCoords(innerR, startAngle);
                
                const largeArcFlag = segmentAngle > Math.PI ? 1 : 0;
                
                const d = `
                  M ${p1.x} ${p1.y}
                  A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y}
                  L ${p3.x} ${p3.y}
                  A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${p4.x} ${p4.y}
                  Z
                `;
                
                return (
                  <path
                    key={tool.id}
                    d={d}
                    fill={hoveredIndex === index ? 'rgba(16, 185, 129, 0.4)' : 'rgba(30, 41, 59, 0.8)'}
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth="2"
                    className="origin-center"
                    style={{
                      transformOrigin: '0px 0px',
                      transform: mounted ? 'scale(1)' : 'scale(0.3)',
                      opacity: mounted ? 1 : 0,
                      transition: mounted
                        ? `transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${50 + index * 30}ms, opacity 200ms ease-out ${50 + index * 30}ms, fill 150ms ease`
                        : `transform 150ms ease-in, opacity 100ms ease-in, fill 150ms ease`
                    }}
                  />
                );
              })}
            </svg>
        </div>
        
        {/* Draw Icons */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
            {TOOLS.map((tool, index) => {
              const total = TOOLS.length;
              const segmentAngle = (2 * Math.PI) / total;
              // Center of the segment
              const angle = (index + 0.5) * segmentAngle - Math.PI / 2;
              
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              
              const IconComponent = (Icons as any)[tool.icon] || Icons.Code;
              const isHovered = hoveredIndex === index;

              return (
                <div 
                  key={`icon-${tool.id}`}
                  className={`absolute left-1/2 top-1/2 ${isHovered ? 'z-50' : 'z-10'}`}
                  style={{
                    transform: mounted 
                      ? `translate(-50%, -50%) translate(${x}px, ${y}px) scale(1)` 
                      : `translate(-50%, -50%) translate(${x * 0.3}px, ${y * 0.3}px) scale(0.3)`,
                    opacity: mounted ? 1 : 0,
                    transition: mounted
                      ? `transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) ${50 + index * 30}ms, opacity 200ms ease-out ${50 + index * 30}ms`
                      : `transform 150ms ease-in, opacity 100ms ease-in`,
                  }}
                >
                  <div className={`flex flex-col items-center justify-center transition-all duration-200 ${isHovered ? 'scale-150' : 'scale-100'}`}>
                    <div className={`p-3 rounded-full border-2 transition-all duration-200 ${isHovered ? 'bg-emerald-500 text-white shadow-[0_0_25px_rgba(16,185,129,0.8)] border-emerald-300' : 'bg-slate-800 text-slate-400 border-transparent shadow-none'}`}>
                        <IconComponent className="w-6 h-6" />
                    </div>
                    {isHovered && (
                        <div className="absolute top-[115%] bg-slate-900 text-emerald-400 text-[11px] font-black px-3 py-1.5 rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.8)] border border-emerald-500 whitespace-nowrap animate-in zoom-in-50 duration-150 tracking-wider uppercase" style={{ zIndex: 100 }}>
                          {tool.name}
                        </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Center dot */}
        <div 
          className={`absolute inset-0 m-auto w-32 h-32 rounded-full ${hoveredIndex === -1 ? 'bg-slate-800 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.5)]' : 'bg-slate-900 border-slate-800'} border-4 flex flex-col items-center justify-center pointer-events-none text-center p-3 shadow-2xl z-10`}
          style={{
            transform: mounted ? 'scale(1)' : 'scale(0)',
            opacity: mounted ? 1 : 0,
            transition: mounted 
              ? 'transform 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 200ms ease-out, background-color 200ms ease, border-color 200ms ease, box-shadow 200ms ease' 
              : 'transform 150ms ease-in, opacity 100ms ease-in'
          }}
        >
            {hoveredIndex !== null && hoveredIndex !== -1 ? (
              <div className="animate-in fade-in zoom-in duration-150 flex flex-col items-center">
                <span className="text-white font-black text-sm leading-tight mb-1 drop-shadow-md">{TOOLS[hoveredIndex].name}</span>
                <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-wider">Release</span>
              </div>
            ) : hoveredIndex === -1 ? (
              <div className="flex flex-col items-center">
                <Icons.Home className="w-8 h-8 text-emerald-400 mb-1" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">Dashboard</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Release</span>
                <span className="text-emerald-500 font-bold text-base drop-shadow-sm flex items-center gap-1">
                  <Icons.Home className="w-4 h-4 opacity-70" />
                  Close
                </span>
                <span className="text-slate-500 text-[9px] uppercase tracking-wider mt-1">Center</span>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
