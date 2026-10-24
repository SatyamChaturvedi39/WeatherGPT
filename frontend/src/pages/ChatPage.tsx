import React, { useState, useRef, useEffect } from 'react';
import { Send, Shield, User, Bot, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { ChatMessage } from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/layout/PageHeader';

interface ChatPageProps {
  location: { name: string; lat: number; lon: number };
  activity: string;
}

export const ChatPage: React.FC<ChatPageProps> = ({ location, activity }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      sender: 'assistant',
      text: `Hello! I am WeatherGPT, grounded strictly in verified meteorological data for ${location.name}. Ask me about rain probabilities, outdoor conditions for ${activity}, or temperature trajectories.`,
      sources: ['Open-Meteo High-Resolution NWP Ingestion Stream'],
      confidence: 1.0,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = [
    `Will it rain today in ${location.name}?`,
    `Is it safe for outdoor ${activity} this afternoon?`,
    `What will the temperature be tonight?`,
    `How strong will the winds get?`,
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage({
        session_id: 'browser-session-1',
        message: text,
        lat: location.lat,
        lon: location.lon,
        activity,
      });

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        sources: res.sources,
        confidence: res.confidence,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue retrieving verified forecast data. Please try again.',
        confidence: 0.0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Weather Intelligence Chat"
        subtitle="Conversational assistant strictly answering from retrieved forecast and telemetry data."
        actions={
          <Badge variant="info" icon={<Shield className="w-3 h-3 stroke-[2]" />}>
            Guardrails Active
          </Badge>
        }
      />

      <div className="flex flex-col h-[calc(100vh-14rem)] bg-app-surface border border-border-subtle rounded-card shadow-card overflow-hidden">
        {/* Messages feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-7 h-7 rounded-btn bg-app-subtle border border-border-default flex items-center justify-center shrink-0 text-accent">
                  <Bot className="w-4 h-4 stroke-[1.75]" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-card text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-accent text-accent-fg'
                    : 'bg-app-subtle border border-border-subtle text-text-primary'
                }`}
              >
                <p>{msg.text}</p>

                {/* Source chips & confidence */}
                {msg.sender === 'assistant' && (
                  <div className="mt-2.5 pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 text-2xs text-text-muted">
                    <div className="flex flex-wrap gap-1 items-center">
                      <span>Source:</span>
                      {msg.sources?.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 rounded bg-app-surface border border-border-subtle text-text-secondary font-mono"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    {msg.confidence !== undefined && (
                      <span className="font-mono tabular-nums text-text-muted">
                        Confidence: <strong>{Math.round(msg.confidence * 100)}%</strong>
                      </span>
                    )}
                  </div>
                )}

                <span
                  className={`block text-[10px] text-right mt-1.5 tabular-nums ${
                    msg.sender === 'user' ? 'text-accent-fg/80' : 'text-text-muted'
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="w-7 h-7 rounded-btn bg-app-subtle border border-border-default flex items-center justify-center shrink-0 text-text-secondary">
                  <User className="w-4 h-4 stroke-[1.75]" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2.5 text-xs text-text-muted">
              <div className="w-7 h-7 rounded-btn bg-app-subtle border border-border-default flex items-center justify-center shrink-0 text-accent">
                <Bot className="w-4 h-4 stroke-[1.75]" />
              </div>
              <div className="bg-app-subtle border border-border-subtle px-3 py-2 rounded-card flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Checking forecast telemetry...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="px-4 py-2 border-t border-border-subtle bg-app-subtle/40 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-2xs text-text-muted shrink-0 mr-1">Suggested:</span>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              className="shrink-0 px-2.5 py-1 rounded-btn bg-app-surface border border-border-subtle hover:border-border-default text-text-secondary hover:text-text-primary text-2xs transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-border-subtle bg-app-surface flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the forecast..."
            className="flex-1 bg-app-subtle border border-border-default rounded-btn px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus-visible:outline-none transition-colors"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || loading}
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
};
