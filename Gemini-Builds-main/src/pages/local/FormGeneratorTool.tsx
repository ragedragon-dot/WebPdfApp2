import React, { useState, useEffect, useRef } from 'react';
import { FormInput, ArrowLeft, Loader2, Save, X, GripHorizontal, Trash2, CheckSquare, List, CircleDot, Type, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import { FileUploader } from '../../components/FileUploader';

interface FormField {
    id: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    type: 'text' | 'checkbox' | 'radio' | 'dropdown';
    placeholder?: string;
    required?: boolean;
}

export default function FormGeneratorTool({ onBackToDashboard, initialFile, onFileLoaded }: any) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  
  const [scale, setScale] = useState(1.5);
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;
    
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    
    const canvas = canvasRef.current;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
  };

  useEffect(() => {
    renderPage();
  }, [pdfDoc, currentPage, scale]);

  const handleAddField = (type: 'text' | 'checkbox' | 'radio' | 'dropdown') => {
      let width = 150;
      let height = 30;
      if (type === 'checkbox' || type === 'radio') {
          width = 24;
          height = 24;
      }
      
      const canvasWidth = canvasRef.current ? canvasRef.current.width / scale : 300;
      const canvasHeight = canvasRef.current ? canvasRef.current.height / scale : 400;

      const newField: FormField = {
          id: Math.random().toString(36).substr(2, 9),
          page: currentPage,
          x: (canvasWidth - width) / 2,
          y: (canvasHeight - height) / 2,
          width,
          height,
          name: `${type}_${fields.length + 1}`,
          type,
          required: false,
          placeholder: ''
      };
      
      setFields([...fields, newField]);
      setSelectedFieldId(newField.id);
  };
  
  const updateField = (id: string, updates: Partial<FormField>) => {
      setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };
  
  const removeField = (id: string, e?: React.MouseEvent | React.TouchEvent) => {
      if (e) { e.stopPropagation(); }
      setFields(fields.filter(f => f.id !== id));
      if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
        const arrayBuffer = await file.arrayBuffer();
        const libDoc = await PDFDocument.load(arrayBuffer);
        
        const form = libDoc.getForm();
        
        for (const field of fields) {
            const pdfPage = libDoc.getPage(field.page - 1);
            const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
            
            const jsPage = await pdfDoc.getPage(field.page);
            const viewport = jsPage.getViewport({ scale });
            
            const scaleX = pdfWidth / viewport.width;
            const scaleY = pdfHeight / viewport.height;
            
            const pX = field.x * scaleX;
            const pY = pdfHeight - ((field.y + field.height) * scaleY);
            const pW = field.width * scaleX;
            const pH = field.height * scaleY;
            
            try {
                if (field.type === 'text') {
                    const textField = form.createTextField(field.name || Math.random().toString());
                    textField.addToPage(pdfPage, {
                        x: pX, y: pY, width: pW, height: pH, borderWidth: 1, borderColor: rgb(0,0,0), backgroundColor: rgb(0.95, 0.95, 0.95)
                    });
                } else if (field.type === 'checkbox') {
                    const checkField = form.createCheckBox(field.name || Math.random().toString());
                    checkField.addToPage(pdfPage, {
                        x: pX, y: pY, width: pW, height: pH, borderWidth: 1, borderColor: rgb(0,0,0), backgroundColor: rgb(0.95, 0.95, 0.95)
                    });
                } else if (field.type === 'radio') {
                    const radioGroup = form.createRadioGroup(field.name || Math.random().toString());
                    radioGroup.addOptionToPage('Option 1', pdfPage, {
                        x: pX, y: pY, width: pW, height: pH, borderWidth: 1, borderColor: rgb(0,0,0), backgroundColor: rgb(0.95, 0.95, 0.95)
                    });
                } else if (field.type === 'dropdown') {
                    const dropdown = form.createDropdown(field.name || Math.random().toString());
                    dropdown.addToPage(pdfPage, {
                        x: pX, y: pY, width: pW, height: pH, borderWidth: 1, borderColor: rgb(0,0,0), backgroundColor: rgb(0.95, 0.95, 0.95)
                    });
                }
            } catch (err) {
               console.warn("Field name collision or error", err);
            }
        }
        
        const bytes = await libDoc.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `form_${file.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        console.error(e);
        alert('Failed to generate form');
    }
    setSaving(false);
  };

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6">
        <button onClick={onBackToDashboard} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center justify-center gap-3">
            <FormInput className="w-8 h-8 text-emerald-500" />
            Interactive Form Generator
          </h1>
          <p className="text-slate-500">
            Design mobile-first fillable PDF forms with an intuitive visual editor.
          </p>
        </div>
        <FileUploader onFileSelected={(files) => setFile(files[0])} acceptType="pdf" />
      </div>
    );
  }

  const currentPageFields = fields.filter(f => f.page === currentPage);
  const selectedField = fields.find(f => f.id === selectedFieldId);

  return (
    <div className="flex flex-col h-screen lg:h-[calc(100dvh-4rem)] bg-slate-100 dark:bg-slate-950 overflow-hidden w-full relative">
      
      {/* Persistent thin header */}
      <div className="flex-none flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 z-20 shadow-sm">
        <button onClick={onBackToDashboard} className="p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400">
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex-1 flex items-center justify-center gap-4">
          <button 
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(c => c - 1)}
            className="p-1.5 text-slate-600 disabled:opacity-30 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 rounded-full"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              Page {currentPage} of {numPages}
          </span>
          <button 
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage(c => c + 1)}
            className="p-1.5 text-slate-600 disabled:opacity-30 dark:text-slate-300 active:bg-slate-100 dark:active:bg-slate-800 rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving || fields.length === 0}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 active:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-xs shadow-sm"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>Save</span>
        </button>
      </div>
      
      {/* PDF Viewport Area */}
      <div 
        className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 relative touch-pan-x touch-pan-y"
        onClick={() => setSelectedFieldId(null)}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-10 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        )}
        
        <div className="min-h-full flex items-start justify-center p-4">
            <div 
            ref={containerRef}
            className="relative shadow-xl bg-white border border-slate-200 dark:border-slate-800"
            >
            <canvas ref={canvasRef} className="block w-full max-w-full touch-none" style={{ touchAction: 'none' }} />
            
            {currentPageFields.map(f => {
                const isSelected = selectedFieldId === f.id;
                
                return (
                <div 
                    key={f.id}
                    className={`absolute flex shadow-md ring-1 ring-inset items-center touch-none rounded-sm transition-all duration-75 ${
                        isSelected 
                            ? 'ring-emerald-500 ring-2 z-20 bg-emerald-50/90' 
                            : 'ring-blue-500/50 hover:ring-blue-500 z-10 bg-blue-50/80 cursor-pointer'
                    }`}
                    style={{
                        left: `${f.x}px`,
                        top: `${f.y}px`,
                        width: `${f.width}px`,
                        height: `${f.height}px`
                    }}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(f.id);
                        const target = e.currentTarget as HTMLDivElement;
                        target.setPointerCapture(e.pointerId);
                        
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const initialX = f.x;
                        const initialY = f.y;
                        
                        const onPointerMove = (moveEvent: PointerEvent) => {
                            const container = containerRef.current;
                            if (!container) return;
                            const dx = moveEvent.clientX - startX;
                            const dy = moveEvent.clientY - startY;
                            updateField(f.id, { x: initialX + dx, y: initialY + dy });
                        };
                        
                        const onPointerUp = (upEvent: PointerEvent) => {
                            target.releasePointerCapture(upEvent.pointerId);
                            target.removeEventListener('pointermove', onPointerMove);
                            target.removeEventListener('pointerup', onPointerUp);
                        };
                        
                        target.addEventListener('pointermove', onPointerMove);
                        target.addEventListener('pointerup', onPointerUp);
                    }}
                >
                    <div className="flex-1 w-full h-full flex items-center px-1 overflow-hidden pointer-events-none">
                       {f.type === 'text' && <span className="text-[10px] font-mono text-emerald-800 truncate opacity-70 w-full">{f.name || 'Text Field'}</span>}
                       {f.type === 'checkbox' && <CheckSquare className="w-full h-full p-0.5 text-emerald-700 opacity-80" />}
                       {f.type === 'radio' && <CircleDot className="w-full h-full p-0.5 text-emerald-700 opacity-80" />}
                       {f.type === 'dropdown' && <span className="text-[10px] font-mono text-emerald-800 truncate opacity-70 w-full">D-Down</span>}
                    </div>

                    {/* Resize handle */}
                    {isSelected && (
                        <div 
                            className="absolute -right-2 -bottom-2 w-5 h-5 bg-emerald-500 rounded-full shadow-md flex items-center justify-center cursor-nwse-resize z-30 touch-none active:scale-110"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                const target = e.currentTarget as HTMLDivElement;
                                target.setPointerCapture(e.pointerId);
                                
                                const startX = e.clientX;
                                const startY = e.clientY;
                                const startW = f.width;
                                const startH = f.height;
                                
                                const onPointerMove = (moveE: PointerEvent) => {
                                    const newW = Math.max(24, startW + (moveE.clientX - startX));
                                    const newH = Math.max(24, startH + (moveE.clientY - startY));
                                    updateField(f.id, { width: newW, height: newH });
                                };
                                
                                const onPointerUp = (upEvent: PointerEvent) => {
                                    target.releasePointerCapture(upEvent.pointerId);
                                    target.removeEventListener('pointermove', onPointerMove);
                                    target.removeEventListener('pointerup', onPointerUp);
                                };
                                
                                target.addEventListener('pointermove', onPointerMove);
                                target.addEventListener('pointerup', onPointerUp);
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8"/></svg>
                        </div>
                    )}
                    
                    {/* Delete handle */}
                    {isSelected && (
                        <div 
                            className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg z-30 touch-none active:scale-95"
                            onPointerDown={(e) => {
                                e.stopPropagation();
                                removeField(f.id);
                            }}
                        >
                            <Trash2 className="w-3 h-3" />
                        </div>
                    )}
                </div>
            )})}
            </div>
        </div>
      </div>
      
      {/* Bottom Interface */}
      <div className="flex-none bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_24px_rgba(0,0,0,0.05)] z-30 pb-[max(env(safe-area-inset-bottom),1rem)] select-none">
         {/* Form Element Tray - default view */}
         {!selectedField && (
             <div className="flex px-4 py-4 gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar overscroll-x-contain">
                 <div className="flex items-center pr-4">
                     <button onClick={() => handleAddField('text')} className="flex flex-col items-center gap-2 group snap-start shrink-0 min-w-[72px]">
                         <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-active:scale-95 transition-transform border border-indigo-100 dark:border-indigo-800/50 group-active:bg-indigo-100">
                             <Type className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center w-full">Text Input</span>
                     </button>
                     <button onClick={() => handleAddField('checkbox')} className="flex flex-col items-center gap-2 group snap-start shrink-0 ml-4 min-w-[72px]">
                         <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center group-active:scale-95 transition-transform border border-teal-100 dark:border-teal-800/50 group-active:bg-teal-100">
                             <CheckSquare className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center w-full">Checkbox</span>
                     </button>
                     <button onClick={() => handleAddField('radio')} className="flex flex-col items-center gap-2 group snap-start shrink-0 ml-4 min-w-[72px]">
                         <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center group-active:scale-95 transition-transform border border-orange-100 dark:border-orange-800/50 group-active:bg-orange-100">
                             <CircleDot className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center w-full">Radio</span>
                     </button>
                     <button onClick={() => handleAddField('dropdown')} className="flex flex-col items-center gap-2 group snap-start shrink-0 ml-4 min-w-[72px]">
                         <div className="w-14 h-14 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center group-active:scale-95 transition-transform border border-fuchsia-100 dark:border-fuchsia-800/50 group-active:bg-fuchsia-100">
                             <List className="w-6 h-6" />
                         </div>
                         <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center w-full">Dropdown</span>
                     </button>
                 </div>
             </div>
         )}
         
         {/* Properties Sheet - Slides in when an element is selected */}
         <div className={`
             absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 z-40 transition-transform duration-300 transform 
             ${selectedField ? 'translate-y-0' : 'translate-y-full pointer-events-none'}
             border-t border-slate-200 dark:border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]
         `}>
             <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-3 cursor-grab active:cursor-grabbing" onClick={() => setSelectedFieldId(null)} />
             {selectedField && (
                 <div className="px-5 pb-6">
                     <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase rounded-md tracking-wider">
                                {selectedField.type} Props
                            </span>
                         </div>
                         <button onClick={() => setSelectedFieldId(null)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full focus:outline-none">
                            <X className="w-4 h-4 text-slate-500" />
                         </button>
                     </div>
                     <div className="space-y-4">
                         <div>
                             <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Field Name (Unique DB ID)</label>
                             <input 
                                 type="text" 
                                 value={selectedField.name} 
                                 onChange={(e) => updateField(selectedField.id, { name: e.target.value })}
                                 className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                             />
                         </div>
                         
                         {selectedField.type === 'text' && (
                             <div>
                                 <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Placeholder</label>
                                 <input 
                                     type="text" 
                                     value={selectedField.placeholder || ''} 
                                     onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                                     className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50"
                                 />
                             </div>
                         )}

                         <div className="flex items-center justify-between pt-2">
                             <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Required Field</span>
                             <label className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                     type="checkbox" 
                                     className="sr-only peer" 
                                     checked={selectedField.required || false}
                                     onChange={(e) => updateField(selectedField.id, { required: e.target.checked })}
                                 />
                                 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                             </label>
                         </div>
                     </div>
                 </div>
             )}
         </div>
      </div>
    </div>
  );
}

