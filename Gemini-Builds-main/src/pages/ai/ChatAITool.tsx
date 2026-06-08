import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles, MessageSquare, AlertCircle, Loader2, PlayCircle, Send, Plus, X, File, Image as ImageIcon, Trash2 } from 'lucide-react';
import { extractTextFromPDF, calculateAICost } from '../../utils/pdfExtractor';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
}

interface WebMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  previewUrl?: string; // For images
  fileName?: string;   // For docs
}

export default function ChatAITool() {
  const { deductCredits, addCredits, profile } = useAuth();
  
  const [messages, setMessages] = useState<WebMessage[]>([
    { role: 'assistant', content: "Hello! Upload a PDF, image, or text document and ask me questions about it." }
  ]);
  
  const [inputMessage, setInputMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ file: File; base64?: string; text?: string; type: 'image' | 'pdf' | 'text' } | null>(null);
  
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdPlaying, setIsAdPlaying] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleWatchAd = async () => {
    setIsAdPlaying(true);
    setError(null);
    setTimeout(async () => {
      await addCredits(5);
      setIsAdPlaying(false);
    }, 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileType = file.type;
      
      try {
        if (fileType === 'application/pdf') {
          const text = await extractTextFromPDF(file);
          setAttachedFile({ file, text, type: 'pdf' });
        } else if (fileType.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
              setAttachedFile({ file, base64: event.target.result, type: 'image' });
            }
          };
          reader.readAsDataURL(file);
        } else if (fileType === 'text/plain' || fileType === 'text/csv' || file.name.endsWith('.txt')) {
          const text = await file.text();
          setAttachedFile({ file, text, type: 'text' });
        } else {
          setError("This file is not supported!");
        }
      } catch (err) {
        setError("This file is not supported!");
      }
    }
    // reset input
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() && !attachedFile) return;

    // Calculate total words in current context
    const messageWords = inputMessage.trim() ? inputMessage.trim().split(/\s+/).length : 0;
    const fileWords = attachedFile?.text ? attachedFile.text.split(/\s+/).length : 0;
    const totalWords = messageWords + fileWords;
    
    // Deduct 1 credit for every 2000 words (minimum 1)
    const cost = Math.max(1, Math.ceil(totalWords / 2000));

    // Check balance first
    const currentBalance = profile?.credits || 0;

    if (currentBalance < cost) {
      setError(`Insufficient credits. You need ${cost} but have ${currentBalance}.`);
      return;
    }

    const newUserMsg: WebMessage = { role: 'user', content: inputMessage };
    if (attachedFile) {
        if (attachedFile.type === 'image') {
            newUserMsg.previewUrl = attachedFile.base64;
            newUserMsg.fileName = attachedFile.file.name;
        } else {
            newUserMsg.fileName = attachedFile.file.name;
        }
    }

    const updatedWebMessages = [...messages, newUserMsg];
    setMessages(updatedWebMessages);
    setInputMessage('');
    
    // Prepare API format
    const apiMessages: ChatMessage[] = [];
    
    for (const msg of updatedWebMessages) {
        if (msg.role === 'user' && (msg.previewUrl || msg.fileName)) {
            // Need to reconstruct from context attached file
            // Note: Since this is stateless and we only keep the attachedFile locally for the *current* send
            // we will formulate the context text for text-based files, and for images send the image payload.
            // If they are older messages in history, we just send the user text to avoid max token issues,
            // but for the *new* one we send the full file context.
        }
    }
    
    // Building historical messages efficiently
    const finalApiMessages: ChatMessage[] = updatedWebMessages.map(m => ({ role: m.role, content: m.content }) as ChatMessage);
    
    // For the last message, attach the file context if one was uploaded with this message
    if (attachedFile) {
        const lastMsg = finalApiMessages[finalApiMessages.length - 1];
        if (attachedFile.type === 'image' && attachedFile.base64) {
            lastMsg.content = [
                { type: "text", text: inputMessage || "Please analyze this image." },
                { type: "image_url", image_url: { url: attachedFile.base64 } }
            ];
        } else if ((attachedFile.type === 'pdf' || attachedFile.type === 'text') && attachedFile.text) {
            lastMsg.content = `Document content attached (${attachedFile.file.name}):\n\n${attachedFile.text.substring(0, 30000)}\n\nUser Question: ${inputMessage || 'Analyze the document.'}`;
        }
    }
    
    setAttachedFile(null); // Clear attachment box
    setIsTyping(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: finalApiMessages })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to communicate with AI.');
      }

      const data = await response.json();
      
      const success = await deductCredits(cost);
      if (!success) {
        throw new Error("Failed to sync credit deduction with the database.");
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (err: any) {
      if (err.message === "This file is not supported!") {
          setError("This file is not supported!");
      } else {
          setError(err.message || 'An error occurred.');
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
        { role: 'assistant', content: "Hello! Upload a PDF, image, or text document and ask me questions about it." }
    ]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full antialiased overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
      
      {/* Header bar */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between px-6 bg-slate-50 dark:bg-slate-900/50 shrink-0">
        <div className="flex flex-row items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 tracking-tight">Chat with AI</h3>
        </div>
        <button
          onClick={handleClearHistory}
          title="Clear Chat History"
          className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-100 dark:bg-slate-950 flex flex-col gap-6">
        {error && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 flex flex-col items-start gap-3 border border-red-200 dark:border-red-800/50 max-w-2xl mx-auto w-full">
              <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              {error.includes("Insufficient credits") && (
                <button 
                  onClick={handleWatchAd}
                  disabled={isAdPlaying}
                  className="mt-2 text-xs flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-800/50 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  {isAdPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  {isAdPlaying ? "Watching Ad..." : "Watch Ad to earn +5 Credits"}
                </button>
              )}
            </div>
        )}

        {/* Message Bubbles */}
        <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-10">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-end gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800">
                                <Sparkles className="w-4 h-4 text-indigo-500" />
                            </div>
                        )}
                        <div className={`flex flex-col gap-2 rounded-2xl px-5 py-3.5 shadow-sm ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none'
                        }`}>
                            {msg.fileName && !msg.previewUrl && (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${msg.role === 'user' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    <File className="w-4 h-4" />
                                    <span className="truncate max-w-[200px]">{msg.fileName}</span>
                                </div>
                            )}
                            {msg.previewUrl && (
                                <div className="rounded-lg overflow-hidden border border-white/20 mb-1 max-w-[250px]">
                                    <img src={msg.previewUrl} alt="Uploaded attachment" className="w-full h-auto object-cover" />
                                </div>
                            )}
                            {msg.content && (
                                <div className={`text-sm leading-relaxed ${msg.role === 'assistant' ? 'markdown-body text-slate-800 dark:text-slate-200' : ''}`}>
                                    {msg.role === 'assistant' ? <MarkdownRenderer content={msg.content} /> : msg.content}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            
            {isTyping && (
                <div className="flex justify-start">
                    <div className="flex items-end gap-2 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Inputs fixed at bottom */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto relative flex flex-col gap-2">
            
            {attachedFile && (
                <div className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                        {attachedFile.type === 'image' ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-indigo-200 dark:border-indigo-800/50 shrink-0">
                                <img src={attachedFile.base64} alt="attachment" className="w-full h-full object-cover" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400">
                                <File className="w-5 h-5" />
                            </div>
                        )}
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-xs">{attachedFile.file.name}</span>
                    </div>
                    <button 
                        onClick={() => setAttachedFile(null)}
                        className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            <form onSubmit={handleSendMessage} className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all overflow-hidden pr-2">
                <input 
                    type="file" 
                    id="chat-file-upload" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileSelect} 
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 text-slate-500 hover:text-indigo-500 transition-colors cursor-pointer"
                    title="Attach document or image"
                >
                    <Plus className="w-5 h-5" />
                </button>
                
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask AI anything..."
                    className="flex-1 bg-transparent border-none py-4 outline-none text-slate-800 dark:text-slate-100 text-sm"
                    disabled={isTyping}
                />
                
                <button
                    type="submit"
                    disabled={isTyping || (!inputMessage.trim() && !attachedFile)}
                    className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md ml-1 active:scale-95"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
            <div className="text-center">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Accepts PDF, Txt, Csv, and Images.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
