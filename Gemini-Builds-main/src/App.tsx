import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import WeaponWheel from './components/WeaponWheel';
import { FileProvider, useFileContext } from './hooks/useFileContext';
import { TOOLS } from './data/tools';

// Local Tools
import RemovePagesTool from './pages/local/RemovePagesTool';
import ImageToPDFTool from './pages/local/ImageToPDFTool';
import PDFToImageTool from './pages/local/PDFToImageTool';
import SignPDFTool from './pages/local/SignPDFTool';
import WatermarkTool from './pages/local/WatermarkTool';
import QRCodeTool from './pages/local/QRCodeTool';
import MergePDFTool from './pages/local/MergePDFTool';
import AddPageNumbersTool from './pages/local/AddPageNumbersTool';
import OCRPDFTool from './pages/local/OCRPDFTool';
import LockPDFTool from './pages/local/LockPDFTool';
import UnlockPDFTool from './pages/local/UnlockPDFTool';
import SmartScannerTool from './pages/local/SmartScannerTool';
import SmartPrivacyRedactorTool from './pages/local/SmartPrivacyRedactorTool';
import MetadataPurifierTool from './pages/local/MetadataPurifierTool';
import VisualPDFDiffTool from './pages/local/VisualPDFDiffTool';
import FormGeneratorTool from './pages/local/FormGeneratorTool';
import AudiobookStudioTool from './pages/local/AudiobookStudioTool';

import LocalTools from './pages/LocalTools';

// AI Tools
import SummarizerTool from './pages/ai/SummarizerTool';
import FlashcardTool from './pages/ai/FlashcardTool';

import ChatAITool from './pages/ai/ChatAITool';

import { AuthProvider } from './hooks/useAuth';
import { AiProtectedRoute } from './components/AiProtectedRoute';

function AppLayout() {
  const [weaponWheelActive, setWeaponWheelActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!location.pathname.startsWith('/local')) {
        return;
      }
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'z' && !e.repeat) {
        e.preventDefault();
        setWeaponWheelActive(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'z') {
        setWeaponWheelActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [location.pathname]);

  const handleSelectTool = (id: string) => {
    if (id === 'dashboard') {
      navigate('/dashboard');
      return;
    }
    if (id === 'local') {
      navigate('/local');
      return;
    }
    const tool = TOOLS.find(t => t.id === id);
    if (tool) {
      if (tool.category === 'ai') {
        navigate(`/ai/${id}`);
      } else {
        navigate(`/local/${id}`);
      }
    }
  };

  const pathParts = location.pathname.split('/').filter(Boolean);
  const activeTool = pathParts.length > 1 ? pathParts[1] : (pathParts[0] || 'dashboard');
  const isAIMode = pathParts[0] === 'ai';

  return (
    <>
      <WeaponWheel 
        active={weaponWheelActive} 
        onClose={() => setWeaponWheelActive(false)} 
        onSelectTool={handleSelectTool} 
      />
      <Shell activeTool={activeTool} onSelectTool={handleSelectTool}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/local" element={<LocalToolsRoute />} />
          
          <Route path="/local/remove-pages" element={<RemovePagesRoute />} />
          <Route path="/local/image-to-pdf" element={<ImageToPDFRoute />} />
          <Route path="/local/pdf-to-image" element={<PDFToImageRoute />} />
          <Route path="/local/sign" element={<SignPDFRoute />} />
          <Route path="/local/watermark" element={<WatermarkRoute />} />
          <Route path="/local/qr-code" element={<QRCodeRoute />} />
          <Route path="/local/merge-pdf" element={<MergePDFRoute />} />
          <Route path="/local/add-page-numbers" element={<AddPageNumbersRoute />} />
          <Route path="/local/ocr-pdf" element={<OCRPDFRoute />} />
          <Route path="/local/lock-pdf" element={<LockPDFRoute />} />
          <Route path="/local/unlock-pdf" element={<UnlockPDFRoute />} />
          <Route path="/local/scanner" element={<SmartScannerRoute />} />
          <Route path="/local/redact-pdf" element={<SmartPrivacyRedactorRoute />} />
          <Route path="/local/purify-metadata" element={<MetadataPurifierRoute />} />
          <Route path="/local/compare-pdf" element={<VisualPDFDiffRoute />} />
          <Route path="/local/form-generator" element={<FormGeneratorRoute />} />
          <Route path="/local/audiobook-studio" element={<AudiobookStudioRoute />} />
          
          <Route path="/ai/summarizer" element={
            <AiProtectedRoute>
              <SummarizerTool />
            </AiProtectedRoute>
          } />
          <Route path="/ai/flashcards" element={
            <AiProtectedRoute>
              <FlashcardTool />
            </AiProtectedRoute>
          } />
          <Route path="/ai/chat-ai" element={
            <AiProtectedRoute>
              <ChatAITool />
            </AiProtectedRoute>
          } />
          
        </Routes>
      </Shell>
    </>
  );
}

// Wrappers for Tools to access context and navigation

function DashboardRoute() {
  const navigate = useNavigate();
  const { handleSelectRecentFile } = useFileContext();
  
  const handleSelectTool = (id: string) => {
    if (id === 'local') {
      navigate('/local');
      return;
    }
    const tool = TOOLS.find(t => t.id === id);
    if (tool) {
      if (tool.category === 'ai') {
        navigate(`/ai/${id}`);
      } else {
        navigate(`/local/${id}`);
      }
    }
  };

  const handleRecent = (recent: any) => {
    handleSelectRecentFile(recent);
    handleSelectTool(recent.toolId);
  }

  return <Dashboard onSelectTool={handleSelectTool as any} onSelectRecentFile={handleRecent} />
}

function LocalToolsRoute() {
  const navigate = useNavigate();
  const { handleSelectRecentFile } = useFileContext();
  
  const handleSelectTool = (id: string) => {
    const tool = TOOLS.find(t => t.id === id);
    if (tool) {
      if (tool.category === 'ai') {
        navigate(`/ai/${id}`);
      } else {
        navigate(`/local/${id}`);
      }
    }
  };

  const handleRecent = (recent: any) => {
    handleSelectRecentFile(recent);
    handleSelectTool(recent.toolId);
  }

  return <LocalTools onSelectTool={handleSelectTool as any} onSelectRecentFile={handleRecent} />
}

function RemovePagesRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <RemovePagesTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'remove-pages', pc)} />;
}

function ImageToPDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <ImageToPDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'image-to-pdf', pc)} />;
}

function PDFToImageRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <PDFToImageTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'pdf-to-image', pc)} />;
}

function SignPDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <SignPDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'sign', pc)} />;
}

function WatermarkRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <WatermarkTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'watermark', pc)} />;
}

function QRCodeRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <QRCodeTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'qr-code', pc)} />;
}

function MergePDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <MergePDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'merge-pdf', pc)} />;
}

function AddPageNumbersRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <AddPageNumbersTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'add-page-numbers', pc)} />;
}

function OCRPDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <OCRPDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'ocr-pdf', pc)} />;
}

function LockPDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <LockPDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'lock-pdf', pc)} />;
}

function UnlockPDFRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <UnlockPDFTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'unlock-pdf', pc)} />;
}

function SmartScannerRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <SmartScannerTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'scanner', pc)} />;
}

function SmartPrivacyRedactorRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <SmartPrivacyRedactorTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'redact-pdf', pc)} />;
}

function MetadataPurifierRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <MetadataPurifierTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'purify-metadata', pc)} />;
}

function VisualPDFDiffRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <VisualPDFDiffTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'compare-pdf', pc)} />;
}

function FormGeneratorRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <FormGeneratorTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'form-generator', pc)} />;
}

function AudiobookStudioRoute() {
  const navigate = useNavigate();
  const { activeFile, setActiveFile, handleFileLoaded } = useFileContext();
  return <AudiobookStudioTool onBackToDashboard={() => { setActiveFile(null); navigate('/dashboard'); }} initialFile={activeFile} onFileLoaded={(f: any, pc?: number) => handleFileLoaded(f, 'audiobook-studio', pc)} />;
}


export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FileProvider>
          <AppLayout />
        </FileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
