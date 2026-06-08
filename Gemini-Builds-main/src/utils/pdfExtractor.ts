import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to run in Vite correctly
const pdfjsVersion = pdfjsLib.version || '6.0.227';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    const pdf = await pdfjsLib.getDocument({ 
      data: arrayBuffer,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/standard_fonts/`,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/cmaps/`,
      cMapPacked: true
    }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF", error);
    throw error;
  }
}

export function calculateAICost(textString: string): { wordCount: number, cost: number } {
  const text = textString.trim();
  if (!text) return { wordCount: 0, cost: 0 };
  
  const wordCount = text.split(/\s+/).length;
  const cost = Math.ceil(wordCount / 2000);
  
  return { wordCount, cost };
}
