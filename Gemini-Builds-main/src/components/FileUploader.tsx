import React, { useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
  onFileSelected: (files: File[]) => void;
  acceptType?: 'pdf' | 'image' | 'all';
}

export const FileUploader: React.FC<FileUploaderProps> = ({ 
  onFileSelected, 
  acceptType = 'pdf' 
}) => {
  
  // Strict object formatting required for react-dropzone v14+
  const acceptConfig = useMemo(() => {
    if (acceptType === 'pdf') {
      return { 'application/pdf': ['.pdf'] };
    }
    if (acceptType === 'image') {
      return { 
        'image/jpeg': ['.jpeg', '.jpg'], 
        'image/png': ['.png'] 
      };
    }
    return {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    };
  }, [acceptType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptConfig,
    multiple: true,
    onDrop: (acceptedFiles) => {
      // Defensive check to prevent app crashes if the prop is missing
      if (typeof onFileSelected === 'function') {
        onFileSelected(acceptedFiles);
      } else {
        console.error("Critical Error: Parent component did not provide a valid 'onFileSelected' function.");
      }
    }
  } as any);

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-2">
        <p className="text-sm font-medium">
          {isDragActive ? "Drop the files here..." : "Drag & drop files here, or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground">
          {acceptType === 'pdf' ? "PDF files only" : acceptType === 'image' ? "Images (JPG, PNG) only" : "PDFs and Images"}
        </p>
      </div>
    </div>
  );
};
