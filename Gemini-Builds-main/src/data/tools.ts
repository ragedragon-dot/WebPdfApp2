import { Tool } from '../types';

export const TOOLS: Tool[] = [
  {
    id: 'chat-ai',
    name: 'Chat with AI',
    description: 'Upload images, PDFs, or other documents and chat with AI up to 1000 words.',
    icon: 'MessageSquare',
    category: 'ai',
    isReady: true
  },
  {
    id: 'summarizer',
    name: 'PDF Summarizer',
    description: 'Use the AI Engine to extract key concepts, summaries, and action items instantly.',
    icon: 'Sparkles',
    category: 'ai',
    isReady: true
  },
  {
    id: 'flashcards',
    name: 'Flashcard Studio',
    description: 'Compile premium study notes and interactive training cards directly from any document.',
    icon: 'BookOpen',
    category: 'ai',
    isReady: true
  },
  {
    id: 'remove-pages',
    name: 'Remove Pages',
    description: 'Delete unwanted pages from your document. Visual grid selection with instant download.',
    icon: 'Scissors',
    category: 'edit',
    isReady: true
  },
  {
    id: 'image-to-pdf',
    name: 'Image to PDF',
    description: 'Convert PNG, JPG, or WEBP images into an elegant, high-quality PDF layout.',
    icon: 'Image',
    category: 'convert',
    isReady: true
  },
  {
    id: 'pdf-to-image',
    name: 'PDF to Image',
    description: 'Render PDF pages into fully-scalable PNG/JPG images, packed in a single ZIP.',
    icon: 'FileImage',
    category: 'convert',
    isReady: true
  },
  {
    id: 'sign',
    name: 'Sign PDF',
    description: 'Draw or type your signature and place it securely with inverse coordinate mapping.',
    icon: 'PenTool',
    category: 'edit',
    isReady: true
  },
  {
    id: 'watermark',
    name: 'Watermark',
    description: 'Stamp your documents with customizable, translucent text or image watermarks.',
    icon: 'Stamp',
    category: 'edit',
    isReady: true
  },
  {
    id: 'qr-code',
    name: 'QR Code PDF',
    description: 'Embed scan-ready, high-resolution QR codes directly on any page of your file.',
    icon: 'QrCode',
    category: 'edit',
    isReady: true
  },
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description: 'Combine multiple PDF documents into a single file in your desired order.',
    icon: 'Combine',
    category: 'edit',
    isReady: true
  },
  {
    id: 'add-page-numbers',
    name: 'Add Page Numbers',
    description: 'Stamp customized page numbers (Page X of Y) at chosen offsets and orientations.',
    icon: 'Hash',
    category: 'edit',
    isReady: true
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF (Extract Text)',
    description: 'Extract raw text layer natively or use state-of-the-art Deep web OCR for scans.',
    icon: 'FileSearch',
    category: 'convert',
    isReady: true
  },
  {
    id: 'lock-pdf',
    name: 'Lock PDF (Protect)',
    description: 'Encrypt documents with secure password protection for complete access control.',
    icon: 'LockKeyhole',
    category: 'edit',
    isReady: true
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF (Decrypt)',
    description: 'Remove password restrictions instantly for pre-authenticated secure documents.',
    icon: 'Unlock',
    category: 'edit',
    isReady: true
  },
  {
    id: 'scanner',
    name: 'Smart Scanner & Crop',
    description: 'Auto-detect boundaries, warp perspectives, and apply high-contrast scan filters.',
    icon: 'Maximize',
    category: 'edit',
    isReady: true
  },
  {
    id: 'redact-pdf',
    name: 'Smart Privacy Redactor',
    description: 'Automatically locate and permanently black out sensitive information such as PII and emails.',
    icon: 'ShieldBan',
    category: 'edit',
    isReady: true
  },
  {
    id: 'purify-metadata',
    name: 'Metadata Editor & Purifier',
    description: 'Edit metadata parameters or strip out all hidden tracking data, history, and author metadata for a completely clean file.',
    icon: 'PaintBucket',
    category: 'edit',
    isReady: true
  },
  {
    id: 'compare-pdf',
    name: 'Visual PDF "Diff"',
    description: 'Compare two PDFs side-by-side with automatic pixel-level visual highlights of any changes.',
    icon: 'GitPullRequest',
    category: 'view',
    isReady: true
  },
  {
    id: 'form-generator',
    name: 'Interactive Form Generator',
    description: 'Turn static flat PDFs into interactive forms using a drag-and-drop widget overlay.',
    icon: 'FormInput',
    category: 'edit',
    isReady: true
  },
  {
    id: 'audiobook-studio',
    name: 'Audiobook Studio',
    description: 'Convert and listen to your PDFs with real-time text-to-speech tracking and a native book reader UI.',
    icon: 'Headphones',
    category: 'view',
    isReady: true
  }
];
