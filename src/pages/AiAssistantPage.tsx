import React, { useState, useEffect, useRef } from 'react';
import './AiAssistantPage.css';
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Trash2,
  Volume2,
  VolumeX,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Check,
  X,
  Plus
} from 'lucide-react';
import { aiService, type ChatMessage, type AssistantAction } from '../services/aiService';
import type { Patient, Appointment } from '../types';

interface AiAssistantPageProps {
  onNavigate: (viewId: string) => void;
  onSuccessToast?: (msg: string) => void;
  onPatientCreated?: (patient: Patient) => void;
  onAppointmentCreated?: (appointment: Appointment) => void;
}

const generateThreadId = (): string =>
  `rcm-thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const AiAssistantPage: React.FC<AiAssistantPageProps> = ({
  onNavigate,
  onSuccessToast,
  onPatientCreated,
  onAppointmentCreated,
}) => {
  const [threadId, setThreadId] = useState<string>(() => {
    const saved = sessionStorage.getItem('rcm_ai_thread_id');
    if (saved) return saved;
    const newId = generateThreadId();
    sessionStorage.setItem('rcm_ai_thread_id', newId);
    return newId;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('rcm_ai_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentToolStep, setCurrentToolStep] = useState<string>('Understanding request...');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const isNearBottomRef = useRef<boolean>(true);

  const handleChatScroll = () => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight <= 90;
  };

  // Scroll only the conversation container without scrolling the browser page
  const scrollToBottom = (force = false) => {
    if (!chatAreaRef.current) return;
    if (force || isNearBottomRef.current) {
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
    sessionStorage.setItem('rcm_ai_messages', JSON.stringify(messages));
  }, [messages, isLoading, currentToolStep]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [inputMessage]);

  // Speech Recognition (STT) setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('[STT] Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported by your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  // Text-To-Speech (TTS)
  const speakResponse = (messageId: string, text: string) => {
    if (!('speechSynthesis' in window)) {
      return;
    }

    if (speakingMessageId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean markdown symbols for clearer speech
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(.*?)\]/g, '$1')
      .replace(/`+/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingMessageId(null);
    };

    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend !== undefined ? textToSend : inputMessage;
    const trimmed = rawText.trim();
    if (!trimmed || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setTimeout(() => scrollToBottom(true), 30);
    setIsLoading(true);
    setCurrentToolStep('Understanding request...');

    // Dynamic step animation sequence
    const stepTimer1 = setTimeout(() => {
      setCurrentToolStep('Querying PostgreSQL Database...');
    }, 450);
    const stepTimer2 = setTimeout(() => {
      setCurrentToolStep('Analyzing Healthcare RCM Data...');
    }, 950);

    try {
      const response = await aiService.sendChatMessage(trimmed, threadId);

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (response.thread_id && response.thread_id !== threadId) {
        setThreadId(response.thread_id);
        sessionStorage.setItem('rcm_ai_thread_id', response.thread_id);
      }

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stats: response.stats,
        tableData: response.tableData,
        action: response.action,
        requiresConfirmation: response.requiresConfirmation,
        sqlExecuted: response.sqlExecuted,
        steps: response.steps,
        isError: !response.success,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // If action is patient_created or appointment_created
      if (response.action?.type === 'patient_created' && response.action.payload) {
        onPatientCreated?.(response.action.payload);
      } else if (response.action?.type === 'appointment_created' && response.action.payload) {
        onAppointmentCreated?.(response.action.payload);
      }

      // If action is automatic navigation
      if (response.action?.type === 'navigate' && response.action.target) {
        const targetView = response.action.target;
        setTimeout(() => {
          onNavigate(targetView);
          if (onSuccessToast) {
            onSuccessToast(`Opened ${targetView} module`);
          }
        }, 1200);
      }
    } catch (err: any) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: 'Sorry, I couldn\'t retrieve that information from the RCM database.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async (msgId: string, action: AssistantAction) => {
    setIsLoading(true);
    setCurrentToolStep('Executing Action in PostgreSQL Database...');

    try {
      const response = await aiService.executeAction(action, threadId);

      // Mark the original message's confirmation as resolved
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, confirmed: true } : m))
      );

      const confirmMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: response.action,
        steps: response.steps,
        isError: !response.success,
      };

      setMessages((prev) => [...prev, confirmMsg]);

      // Dispatch callbacks for patient or appointment created
      if (response.action?.type === 'patient_created' && response.action.payload) {
        onPatientCreated?.(response.action.payload);
      } else if (response.action?.type === 'appointment_created' && response.action.payload) {
        onAppointmentCreated?.(response.action.payload);
      }

      if (response.success && onSuccessToast) {
        onSuccessToast('Action successfully completed and saved!');
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: 'Failed to execute confirmed action. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, requiresConfirmation: false, confirmed: false } : m))
    );

    const cancelMsg: ChatMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: 'Action cancelled. No database changes were made.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, cancelMsg]);
  };

  const handleNewChat = () => {
    if (speakingMessageId && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    const newId = generateThreadId();
    setThreadId(newId);
    sessionStorage.setItem('rcm_ai_thread_id', newId);
    setMessages([]);
    sessionStorage.removeItem('rcm_ai_messages');
    if (onSuccessToast) {
      onSuccessToast('Started a new conversation session');
    }
  };

  const handleClearChat = () => {
    if (speakingMessageId && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
    const newId = generateThreadId();
    setThreadId(newId);
    sessionStorage.setItem('rcm_ai_thread_id', newId);
    setMessages([]);
    sessionStorage.removeItem('rcm_ai_messages');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render bold markdown (**text**)
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="ai-assistant-container">
      {/* 1. Header */}
      <header className="ai-assistant-header">
        <div className="ai-header-left">
          <div className="ai-brand-badge">
            <Bot size={26} strokeWidth={2.2} />
          </div>
          <div className="ai-header-title-box">
            <h1>RCM AI Assistant</h1>
            <p>Manage and analyze your Revenue Cycle Management data.</p>
          </div>
        </div>

        <div className="ai-header-right">
          <button
            type="button"
            className="ai-new-chat-btn"
            onClick={handleNewChat}
            title="Start a fresh conversation"
          >
            <Plus size={15} />
            <span>New Chat</span>
          </button>

          {messages.length > 0 && (
            <button
              type="button"
              className="ai-clear-btn"
              onClick={handleClearChat}
              title="Clear conversation history"
            >
              <Trash2 size={15} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. Chat Conversation Area */}
      <main className="ai-chat-area" ref={chatAreaRef} onScroll={handleChatScroll}>
        {messages.length === 0 ? (
          <div className="ai-welcome-hero">
            <div className="ai-hero-icon-bubble">
              <Sparkles size={32} />
            </div>
            <h2>Healthcare Revenue Cycle AI Assistant</h2>
            <p>
              Ask questions about patients, appointments, billing encounters, claims, denials,
              remittances, or request module navigation.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`ai-message-row ${msg.role} ${msg.isError ? 'error' : ''}`}
            >
              <div className="ai-message-bubble">
                <div className="ai-message-meta">
                  <div className={`ai-avatar ${msg.role}`}>
                    {msg.role === 'user' ? <User size={15} /> : <Bot size={15} />}
                  </div>
                  <span>{msg.role === 'user' ? 'You' : 'RCM Assistant'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>

                  {msg.role === 'assistant' && (
                    <button
                      type="button"
                      className={`ai-voice-action-btn ${speakingMessageId === msg.id ? 'speaking' : ''}`}
                      onClick={() => speakResponse(msg.id, msg.content)}
                      title={speakingMessageId === msg.id ? 'Stop speaking' : 'Speak response'}
                    >
                      {speakingMessageId === msg.id ? (
                        <>
                          <VolumeX size={13} />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} />
                          <span>Speak</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="ai-message-content">
                  {renderFormattedText(msg.content)}

                  {/* Statistics Deck */}
                  {msg.stats && msg.stats.length > 0 && (
                    <div className="ai-stats-deck">
                      {msg.stats.map((s, idx) => (
                        <div key={idx} className="ai-stat-card">
                          <div className="stat-label">{s.label}</div>
                          <div className="stat-val">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formatted Data Table */}
                  {msg.tableData && msg.tableData.rows.length > 0 && (
                    <div className="ai-table-wrapper">
                      <table className="ai-data-table">
                        <thead>
                          <tr>
                            {msg.tableData.headers.map((h, hIdx) => (
                              <th key={hIdx}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.tableData.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              {msg.tableData!.headers.map((h, cIdx) => {
                                const val = row[h];
                                const isStatus = h.toLowerCase().includes('status');
                                const statusClass = isStatus
                                  ? String(val).toLowerCase().replace(/\s+/g, '-')
                                  : '';

                                return (
                                  <td key={cIdx}>
                                    {isStatus ? (
                                      <span className={`badge-status ${statusClass}`}>{val}</span>
                                    ) : (
                                      val
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Navigation Action Button Card */}
                  {msg.action?.type === 'navigate' && msg.action.target && (
                    <div className="ai-nav-card">
                      <div>
                        <strong>Ready to navigate:</strong> Open {msg.action.target.replace('-', ' ')} module
                      </div>
                      <button
                        type="button"
                        className="ai-nav-btn"
                        onClick={() => onNavigate(msg.action!.target!)}
                      >
                        <span>Open Now</span>
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  )}

                  {/* Confirmation Card For Controlled Write Actions */}
                  {msg.requiresConfirmation && msg.action && !msg.confirmed && (
                    <div className="ai-confirmation-box">
                      <div className="ai-confirm-header">
                        <AlertCircle size={15} color="#d97706" />
                        <span>Action Confirmation Required</span>
                      </div>
                      <div className="ai-confirm-body">
                        Please review the details above. Click Confirm to execute this change in the database.
                      </div>
                      <div className="ai-confirm-actions">
                        <button
                          type="button"
                          className="ai-btn-confirm"
                          onClick={() => handleConfirmAction(msg.id, msg.action!)}
                        >
                          <Check size={16} />
                          <span>Confirm</span>
                        </button>
                        <button
                          type="button"
                          className="ai-btn-cancel"
                          onClick={() => handleCancelAction(msg.id)}
                        >
                          <X size={16} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {msg.confirmed && (
                    <div style={{ marginTop: '10px' }}>
                      <span className="ai-confirm-done">
                        <CheckCircle2 size={16} />
                        <span>Action Confirmed & Executed</span>
                      </span>
                    </div>
                  )}

                  {/* Safe SQL indicator */}
                  {msg.sqlExecuted && (
                    <div className="ai-sql-tag" title={msg.sqlExecuted}>
                      SQL: {msg.sqlExecuted.replace(/\s+/g, ' ').slice(0, 100)}...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* 3. Loading / Thinking State */}
        {isLoading && (
          <div className="ai-thinking-row">
            <div className="ai-spinner-circle"></div>
            <div className="ai-thinking-text">{currentToolStep}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* 4. Input Area */}
      <footer className="ai-chat-input-bar">
        <div className="ai-input-form-wrapper">
          <textarea
            ref={textareaRef}
            className="ai-input-textarea"
            placeholder={isListening ? 'Listening to speech...' : 'Type or speak your RCM request... (e.g. "Show pending claims")'}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />

          {/* Microphone button */}
          <button
            type="button"
            className={`ai-mic-btn ${isListening ? 'listening' : ''}`}
            onClick={toggleListening}
            title={isListening ? 'Stop listening' : 'Speak using microphone'}
          >
            {isListening ? <MicOff size={19} /> : <Mic size={19} />}
          </button>

          {/* Send button */}
          <button
            type="button"
            className="ai-send-btn"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            title="Send message"
          >
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
};
