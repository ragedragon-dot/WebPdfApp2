import { useState, useEffect, useCallback, useMemo } from 'react';

export interface WebMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | any[];
  fileName?: string;
  previewUrl?: string; // image preview
}

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: WebMessage[];
}

export function useChatHistory() {
  const [totalSessions, setTotalSessions] = useState<ChatSession[]>([]);
  const [visibleSessionsCount, setVisibleSessionsCount] = useState<number>(10);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ai_chat_sessions');
      if (stored) {
        setTotalSessions(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load sessions from localStorage", err);
    }
  }, []);

  // Step 1: Core persistence function + 200-Session Eviction
  const saveChatSession = useCallback((messages: WebMessage[], sessionId?: string) => {
    if (!messages || messages.length === 0) return null;

    // We only save if there are messages from 'user' or more than just the initial greeting
    // Let's create a title from the first user message
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg) return sessionId || null; // don't save empty/initial chats until user speaks

    let title = "New Chat";
    if (typeof firstUserMsg.content === 'string') {
      title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "..." : "");
    } else if (Array.isArray(firstUserMsg.content)) {
      const textPart = firstUserMsg.content.find(p => p.type === 'text');
      if (textPart && textPart.text) {
        title = textPart.text.slice(0, 30) + (textPart.text.length > 30 ? "..." : "");
      } else {
        title = "Image Analysis";
      }
    }

    const id = sessionId || Date.now().toString();

    setTotalSessions(prev => {
      let history = [...prev];
      const existingIndex = history.findIndex(s => s.id === id);
      
      const updatedSession: ChatSession = {
        id,
        title: existingIndex > -1 ? history[existingIndex].title : title, // preserve title if it exists, or handle rename later
        updatedAt: Date.now(),
        messages
      };

      if (existingIndex > -1) {
        history[existingIndex] = updatedSession;
      } else {
        history.unshift(updatedSession);
      }

      // Sort by updatedAt descending (newest first)
      history.sort((a, b) => b.updatedAt - a.updatedAt);

      // Eviction Guard: exactly as requested
      if (history.length > 200) {
        history = history.slice(0, history.length - 10);
      }

      localStorage.setItem('ai_chat_sessions', JSON.stringify(history));
      return history;
    });

    if (!sessionId) {
      setCurrentSessionId(id);
    }
    return id;
  }, []);

  // Step 2: Lazy-Load Pagination (Chunks of 10)
  const displayedSessions = useMemo(() => {
    return totalSessions.slice(0, visibleSessionsCount);
  }, [totalSessions, visibleSessionsCount]);

  // Step 3: Triggering Infinite Scroll 
  const loadMoreSessions = useCallback(() => {
    setVisibleSessionsCount(prev => Math.min(prev + 10, totalSessions.length));
  }, [totalSessions.length]);

  const loadSession = useCallback((id: string) => {
    const session = totalSessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      return session.messages;
    }
    return null;
  }, [totalSessions]);

  const createNewSession = useCallback(() => {
    setCurrentSessionId(null);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setTotalSessions(prev => {
      const updated = prev.filter(s => s.id !== id);
      localStorage.setItem('ai_chat_sessions', JSON.stringify(updated));
      return updated;
    });
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
  }, [currentSessionId]);

  const clearAllHistory = useCallback(() => {
    setTotalSessions([]);
    setCurrentSessionId(null);
    localStorage.removeItem('ai_chat_sessions');
  }, []);

  return {
    totalSessions,
    displayedSessions,
    saveChatSession,
    loadMoreSessions,
    hasMore: visibleSessionsCount < totalSessions.length,
    loadSession,
    createNewSession,
    deleteSession,
    clearAllHistory,
    currentSessionId
  };
}
