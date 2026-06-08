import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ToolId, RecentFile } from '../types';

interface FileContextType {
  activeFile: File | null;
  setActiveFile: (file: File | null) => void;
  summarizerFile: File | null;
  setSummarizerFile: (file: File | null) => void;
  flashcardsFile: File | null;
  setFlashcardsFile: (file: File | null) => void;
  sessionFiles: Record<string, File>;
  handleFileLoaded: (file: File, toolId: ToolId, pageCount?: number) => void;
  handleSelectRecentFile: (recent: RecentFile) => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

export function FileProvider({ children }: { children: ReactNode }) {
  const [sessionFiles, setSessionFiles] = useState<Record<string, File>>({});
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [summarizerFile, setSummarizerFile] = useState<File | null>(null);
  const [flashcardsFile, setFlashcardsFile] = useState<File | null>(null);

  const handleSelectRecentFile = (recent: RecentFile) => {
    const file = sessionFiles[recent.id];
    if (file) {
      if (recent.toolId === 'summarizer') {
        setSummarizerFile(file);
      } else if (recent.toolId === 'flashcards') {
        setFlashcardsFile(file);
      } else {
        setActiveFile(file);
      }
    } else {
      setActiveFile(null);
      alert(`To continue editing "${recent.name}", please select or drop it again in the upload area.`);
    }
  };

  const handleFileLoaded = (file: File, toolId: ToolId, pageCount?: number) => {
    const id = `${file.name}-${file.size}-${toolId}`;
    setSessionFiles((prev) => ({
      ...prev,
      [id]: file,
    }));

    const recent: RecentFile = {
      id,
      name: file.name,
      size: file.size,
      toolId,
      timestamp: Date.now(),
      pageCount,
    };

    try {
      const stored = localStorage.getItem('pdf_workspace_recent_files');
      let list: RecentFile[] = [];
      if (stored) {
        list = JSON.parse(stored);
      }
      list = list.filter((item) => item.id !== id);
      list.unshift(recent);
      list = list.slice(0, 6);
      localStorage.setItem('pdf_workspace_recent_files', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <FileContext.Provider value={{ 
      activeFile, 
      setActiveFile, 
      summarizerFile, 
      setSummarizerFile, 
      flashcardsFile, 
      setFlashcardsFile, 
      sessionFiles, 
      handleFileLoaded, 
      handleSelectRecentFile 
    }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFileContext() {
  const context = useContext(FileContext);
  if (context === undefined) {
    throw new Error('useFileContext must be used within a FileProvider');
  }
  return context;
}
