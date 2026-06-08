import React, { useState, useEffect, useRef } from 'react';
import MarkdownRenderer from '../../components/MarkdownRenderer';
import { useAuth } from '../../hooks/useAuth';
import { Sparkles, MessageSquare, AlertCircle, Loader2, PlayCircle, Send, Plus, X, File, Image as ImageIcon, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { extractTextFromPDF, calculateAICost } from '../../utils/pdfExtractor';
import { motion, AnimatePresence } from 'motion/react';

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
  
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => setCopiedMsgIdx(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = messages.map(m => `${m.role === 'user' ? 'You' : 'AI'}:\n${typeof m.content === 'string' ? m.content : 'Attachment'}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

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
    
    // Deduct 1 credit for every 3000 words (minimum 1)
    const cost = Math.max(1, Math.ceil(totalWords / 3000));

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
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between px-6 bg-white dark:bg-slate-900 shrink-0 z-10 shadow-sm relative">
        <div className="flex flex-row items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 tracking-tight ml-1">Chat with AI</h3>
        </div>
        <div className="flex flex-row items-center gap-1">
          <button
            onClick={handleCopyAll}
            title="Copy entire chat"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            {copiedAll ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-950 flex flex-col gap-6 relative">
        {/* Subtle background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[100px]" />
        </div>
        
        <div className="relative z-10 w-full flex flex-col">
          {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 flex flex-col items-start gap-3 border border-red-200 dark:border-red-800/50 max-w-2xl mx-auto w-full mb-6">
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
              <AnimatePresence initial={false}>
                {messages.map((msg, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        key={`msg-${idx}`} 
                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex items-end gap-3 max-w-[88%] relative group ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm z-10">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                            )}
                            <div className={`flex flex-col gap-2 rounded-3xl px-6 py-4 shadow-sm relative z-0 ${
                                msg.role === 'user' 
                                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-none border border-indigo-500 shadow-indigo-500/20 shadow-lg leading-relaxed' 
                                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-none shadow-sm'
                            }`}>
                                {msg.fileName && !msg.previewUrl && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${msg.role === 'user' ? 'bg-black/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                        <File className="w-4 h-4" />
                                        <span className="truncate max-w-[200px]">{msg.fileName}</span>
                                    </div>
                                )}
                                {msg.previewUrl && (
                                    <div className="rounded-xl overflow-hidden mb-2 max-w-[280px] shadow-md border focus-within:ring-2 border-white/20">
                                        <img src={msg.previewUrl} alt="Uploaded attachment" className="w-full h-auto object-cover" />
                                    </div>
                                )}
                                {msg.content && (
                                    <div className={`text-[15px] ${msg.role === 'assistant' ? 'markdown-body text-slate-800 dark:text-slate-200' : ''}`}>
                                        {msg.role === 'assistant' && typeof msg.content === 'string' ? <MarkdownRenderer content={msg.content} /> : msg.content}
                                    </div>
                                )}

                                {/* Copy button for Assistant */}
                                {msg.role === 'assistant' && typeof msg.content === 'string' && (
                                    <>
                                      {/* Desktop hover copy */}
                                      <button
                                          onClick={() => handleCopyMessage(msg.content as string, idx)}
                                          className="absolute -right-11 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-400 hover:text-indigo-500 hidden md:block"
                                          title="Copy message"
                                      >
                                          {copiedMsgIdx === idx ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                      </button>
                                      {/* Mobile inline copy */}
                                      <button
                                          onClick={() => handleCopyMessage(msg.content as string, idx)}
                                          className="pt-3 mt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-1.5 text-[11px] font-medium text-slate-400 hover:text-indigo-500 transition-colors md:hidden w-full"
                                      >
                                          {copiedMsgIdx === idx ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> <span className="text-emerald-500 text-xs">Copied</span></> : <><Copy className="w-3.5 h-3.5" /> <span className="text-xs">Copy</span></>}
                                      </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
              </AnimatePresence>
              
              {isTyping && (
                  <motion.div 
                      cancel={{ opacity: 0, y: 15 }} // framer-motion compat
                      initial={{ opacity: 0, y: 15, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="flex justify-start w-full"
                  >
                      <div className="flex items-end gap-3 max-w-[85%] relative">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm z-10">
                              <Sparkles className="w-5 h-5 text-white animate-pulse" />
                          </div>
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl rounded-bl-none px-6 py-5 shadow-sm flex items-center gap-1.5 z-0">
                              <div className="w-2 h-2 rounded-full bg-indigo-500/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 rounded-full bg-indigo-500/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 rounded-full bg-indigo-500/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                      </div>
                  </motion.div>
              )}
              <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Inputs fixed at bottom */}
      <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-10 shrink-0">
        <div className="max-w-3xl mx-auto relative flex flex-col gap-3">
            
            <AnimatePresence>
              {attachedFile && (
                  <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl shadow-sm"
                  >
                      <div className="flex items-center gap-3">
                          {attachedFile.type === 'image' ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden border border-indigo-200 dark:border-indigo-800/50 shrink-0 shadow-sm">
                                  <img src={attachedFile.base64} alt="attachment" className="w-full h-full object-cover" />
                              </div>
                          ) : (
                              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex flex-shrink-0 items-center justify-center border border-indigo-200 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 shadow-sm">
                                  <File className="w-6 h-6" />
                              </div>
                          )}
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[200px] md:max-w-xs">{attachedFile.file.name}</span>
                      </div>
                      <button 
                          onClick={() => setAttachedFile(null)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </motion.div>
              )}
            </AnimatePresence>
            
            <form onSubmit={handleSendMessage} className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm focus-within:ring-[3px] focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all overflow-hidden pr-2 w-full">
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
                    className="p-4 pr-3 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer group"
                    title="Attach document or image"
                >
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
                
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Message AI Assistant..."
                    className="flex-1 bg-transparent border-none py-5 px-2 outline-none text-slate-800 dark:text-slate-100 text-sm md:text-base font-medium placeholder-slate-400 dark:placeholder-slate-500"
                    disabled={isTyping}
                />
                
                <button
                    type="submit"
                    disabled={isTyping || (!inputMessage.trim() && !attachedFile)}
                    className="p-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-full hover:from-indigo-700 hover:to-indigo-600 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-md active:scale-95 mx-1"
                >
                    <Send className="w-5 h-5 ml-0.5" />
                </button>
            </form>
            <div className="flex justify-center items-center gap-4 mt-1">
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Supports PDF, TXT, CSV, and Images</p>
                <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">1 Credit / 3000 words</p>
            </div>
        </div>
      </div>
    </div>
  );
}
