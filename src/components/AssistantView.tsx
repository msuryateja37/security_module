import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SecurityIncident } from '../types/security';
import type { UserProfile } from '../security/roleAccess';
import { Sparkles, Send, ShieldCheck, Eraser, FileText, Clock, Search, ClipboardCheck, ArrowRight, BarChart3, Mic, MicOff } from 'lucide-react';

// Web Speech API (dictation) — not in the standard TS DOM lib, so declare the minimal shape.
// Supported in Chrome/Edge; the mic button is hidden where unavailable (e.g. Firefox).
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const getSpeechRecognitionCtor = (): (new () => SpeechRecognitionInstance) | null =>
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;

interface AssistantViewProps {
  currentUser: UserProfile;
  onPrefillIncident: (draft: Partial<SecurityIncident>) => void;
  /** Chat state lives in App so the conversation survives navigating away and back. */
  messages: ChatMessage[];
  onMessagesChange: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/** Compact incident summary returned by the assistant endpoint. */
interface IncidentSummary {
  id: string;
  refNo: string;
  status: SecurityIncident['status'];
  incidentType: string[];
  place: string;
  province: string;
  dateReported: string;
  natureOfLoss: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  incidents?: IncidentSummary[];
  formDraft?: Partial<SecurityIncident>;
  time: string;
}

const now = () => new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

/** Render the small markdown subset the assistant emits (bold + line breaks). */
const renderMessageText = (text: string) => {
  return text.split('\n').map((line, i) => (
    <React.Fragment key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j}>{part.slice(2, -2)}</strong>
        ) : (
          <React.Fragment key={j}>{part}</React.Fragment>
        )
      )}
      {i < text.split('\n').length - 1 && <br />}
    </React.Fragment>
  ));
};

const STATUS_BADGE: Record<SecurityIncident['status'], string> = {
  'Open': 'warning',
  'Under Investigation': 'primary',
  'SAPS Case': 'danger',
  'Closed': 'success'
};

export const AssistantView: React.FC<AssistantViewProps> = ({ currentUser, onPrefillIncident, messages, onMessagesChange }) => {
  // Chat state is held in App (memory only, never written to storage — POPIA / need-to-know),
  // so the conversation survives navigating to the incident form and back. It is cleared when
  // the drafted incident is submitted, on manual clear, or on logout.
  const setMessages = onMessagesChange;
  const [draft, setDraft] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Voice dictation (Web Speech API): audio is transcribed by the browser into the
  // text box only — nothing is recorded or sent anywhere until the user presses Enter.
  const speechSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const baseDraftRef = useRef('');      // text already in the box when dictation started
  const finalTranscriptRef = useRef(''); // confirmed (final) speech segments so far

  const stopDictation = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  };

  const startDictation = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor || isListening) return;

    const recognition = new Ctor();
    recognition.lang = 'en-ZA';
    recognition.interimResults = true;
    recognition.continuous = true;

    baseDraftRef.current = draft.trim() ? draft.trim() + ' ' : '';
    finalTranscriptRef.current = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript.trim() + ' ';
        } else {
          interim += transcript;
        }
      }
      setDraft((baseDraftRef.current + finalTranscriptRef.current + interim).trimStart());
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicError('Microphone access is blocked. Allow the microphone permission in your browser and try again.');
      } else if (event.error === 'no-speech') {
        setMicError('No speech was detected — tap the microphone and try again.');
      } else if (event.error !== 'aborted') {
        setMicError('Voice input failed. Please try again or type your message.');
      }
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setMicError(null);
    setIsListening(true);
    recognition.start();
  };

  // Stop the microphone when the user leaves the screen
  useEffect(() => () => recognitionRef.current?.abort(), []);

  // Suggestion chips follow the AI capabilities of each role (client responsibility matrix)
  const suggestions = useMemo(() => {
    switch (currentUser.role) {
      case 'security_coordinator':
        return [
          { icon: BarChart3, label: "Summarise my province's case load" },
          { icon: Search, label: 'Show me the new cases' },
          { icon: FileText, label: 'I want to report an incident' },
          { icon: ShieldCheck, label: 'How do I escalate a case?' }
        ];
      case 'chief_security_investigator':
        return [
          { icon: Search, label: 'What cases are assigned to me?' },
          { icon: BarChart3, label: 'Summarise my current workload' },
          { icon: Clock, label: 'What are the SLA deadlines?' }
        ];
      case 'security_director':
        return [
          { icon: BarChart3, label: 'Give me an overview of all provinces' },
          { icon: Search, label: 'Show me the overdue cases' },
          { icon: ShieldCheck, label: 'How do I appoint a temporary coordinator?' }
        ];
      default: // employee
        return [
          { icon: FileText, label: 'I want to report an incident' },
          { icon: Search, label: 'Show me my incidents' },
          { icon: Clock, label: 'What are the SLA deadlines?' },
          { icon: ShieldCheck, label: 'What is my role and access level?' }
        ];
    }
  }, [currentUser.role]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    if (isListening) stopDictation();
    setMicError(null);

    const userMsg: ChatMessage = { id: `msg-${Date.now()}-u`, sender: 'user', text: trimmed, time: now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setDraft('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-username': currentUser.username,
          'x-user-role': currentUser.role
        },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.text
          }))
        })
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json?.message || `Request failed (${response.status})`);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-a`,
          sender: 'assistant',
          text: json.data.reply,
          incidents: json.data.incidents,
          formDraft: json.data.formDraft,
          time: now()
        }
      ]);
    } catch (err) {
      console.error('Assistant request failed:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}-a`,
          sender: 'assistant',
          text: 'Sorry — the assistant is unavailable right now. Please try again in a moment, or use the regular screens for your task.',
          time: now()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="assistant-view">
      <div className="header-row">
        <div>
          <h1 className="page-title">AI Assistant</h1>
          <p className="page-subtitle">
            Ask about incident reporting, SLA deadlines, or your own records — scoped to your role and province
          </p>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setMessages([])} title="Clear this conversation">
            <Eraser size={15} style={{ marginRight: '0.35rem', verticalAlign: '-2px' }} />
            Clear Chat
          </button>
        )}
      </div>

      <div className="glass-card assistant-shell">
        {/* Session-only notice */}
        <div className="assistant-privacy-strip">
          <ShieldCheck size={13} />
          <span>
            Conversations are <strong>not stored</strong> — this chat stays available while you work and clears when
            you submit the drafted incident or log out. Answers respect your access level ({currentUser.roleLabel},{' '}
            {currentUser.province}).
          </span>
        </div>

        {/* Message stream */}
        <div className="assistant-stream" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="assistant-empty">
              <div className="assistant-empty-orb">
                <Sparkles size={26} />
              </div>
              <h3>How can I help, {currentUser.displayName.split(' ')[0]}?</h3>
              <p>
                I can look up records you are authorised to view, answer questions about the incident process, and help
                you fill in the incident form — just describe what happened.
              </p>
              <div className="assistant-chip-row">
                {suggestions.map(s => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} className="assistant-chip" onClick={() => sendMessage(s.label)}>
                      <Icon size={14} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`assistant-row ${msg.sender}`}>
              {msg.sender === 'assistant' && (
                <div className="assistant-avatar">
                  <Sparkles size={15} />
                </div>
              )}
              <div className={`assistant-bubble ${msg.sender}`}>
                <div className="assistant-bubble-text">{renderMessageText(msg.text)}</div>

                {msg.incidents && msg.incidents.length > 0 && (
                  <div className="assistant-incident-list">
                    {msg.incidents.map(inc => (
                      <div key={inc.id} className="assistant-incident-card">
                        <div className="assistant-incident-top">
                          <span className="assistant-incident-ref">{inc.refNo}</span>
                          <span className={`badge ${STATUS_BADGE[inc.status] || 'muted'}`}>{inc.status}</span>
                        </div>
                        <div className="assistant-incident-meta">
                          {(inc.incidentType || []).join(', ')} — {inc.place}, {inc.province}
                        </div>
                        <div className="assistant-incident-meta muted">
                          Reported {inc.dateReported} · {inc.natureOfLoss}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.formDraft && (
                  <div className="assistant-incident-list">
                    <div className="assistant-incident-card">
                      <div className="assistant-incident-top">
                        <span className="assistant-incident-ref">
                          <ClipboardCheck size={13} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
                          Incident form draft ready
                        </span>
                        <span className="badge primary">Draft</span>
                      </div>
                      <div className="assistant-incident-meta">
                        {(msg.formDraft.incidentType || []).join(', ')}
                        {msg.formDraft.place ? ` — ${msg.formDraft.place}` : ''}
                        {msg.formDraft.province ? `, ${msg.formDraft.province}` : ''}
                      </div>
                      <div className="assistant-incident-meta muted">
                        Review every field before submitting — you remain the author of this report.
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ marginTop: '0.5rem' }}
                        onClick={() => onPrefillIncident(msg.formDraft!)}
                      >
                        Review &amp; complete in incident form
                        <ArrowRight size={14} style={{ marginLeft: '0.35rem', verticalAlign: '-2px' }} />
                      </button>
                    </div>
                  </div>
                )}

                <span className="assistant-time">{msg.time}</span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="assistant-row assistant">
              <div className="assistant-avatar">
                <Sparkles size={15} />
              </div>
              <div className="assistant-bubble assistant typing">
                <span className="assistant-dot" />
                <span className="assistant-dot" />
                <span className="assistant-dot" />
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        {micError && (
          <div className="assistant-mic-error">
            <MicOff size={13} />
            <span>{micError}</span>
          </div>
        )}
        <div className="assistant-composer">
          <input
            type="text"
            className="assistant-input"
            placeholder={
              isListening
                ? 'Listening — speak now, then press Enter to send…'
                : 'Ask a question or describe an incident, e.g. "A laptop was stolen from our office last night"'
            }
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') sendMessage(draft);
            }}
          />
          {speechSupported && (
            <button
              className={`assistant-mic-btn ${isListening ? 'listening' : ''}`}
              onClick={isListening ? stopDictation : startDictation}
              disabled={isTyping}
              title={isListening ? 'Stop dictation' : 'Dictate your message'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            className="assistant-send-btn"
            onClick={() => sendMessage(draft)}
            disabled={!draft.trim() || isTyping}
            title="Send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
