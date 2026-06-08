export type ToolId =
  | 'dashboard'
  | 'local'
  | 'image-to-pdf'
  | 'pdf-to-image'
  | 'remove-pages'
  | 'sign'
  | 'watermark'
  | 'qr-code'
  | 'book-reader'
  | 'merge-pdf'
  | 'add-page-numbers'
  | 'ocr-pdf'
  | 'lock-pdf'
  | 'unlock-pdf'
  | 'scanner'
  | 'redact-pdf'
  | 'purify-metadata'
  | 'compare-pdf'
  | 'form-generator'
  | 'audiobook-studio'
  | 'summarizer'
  | 'flashcards'
  | 'chat-ai';

export interface Tool {
  id: ToolId;
  name: string;
  description: string;
  icon: string; // Lucide icon name or type
  category: 'edit' | 'convert' | 'view' | 'ai';
  isReady: boolean;
}

export interface PDFFileInfo {
  name: string;
  size: number;
  objectUrl: string;
  pageCount: number;
}

export interface RecentFile {
  id: string;
  name: string;
  size: number;
  toolId: ToolId;
  timestamp: number;
  pageCount?: number;
}
