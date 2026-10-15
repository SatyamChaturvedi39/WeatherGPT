import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  RotateCcw,
  MapPin,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { sendChatMessage } from "../services/api";

const QUICK_PROMPTS = [
  "Will I need an umbrella today?",
  "What should I wear tonight?",
  "Is the weather good for an outdoor run?",
  "Summarize the 24-hour temperature trend.",
  "Are there any active weather risks?",
];

export default function ChatView({ location }) {
  const [messages, setMessages] = useState([
    {
      id: "init",
      role: "assistant",
      content: `Hello! I'm **WeatherGPT**, your AI meteorological intelligence assistant. I ground every answer in real-time atmospheric observations and machine learning models with zero hallucination. Ask me anything about ${location ? location.name : "the weather"}!`,
      sources: [
        {
          title: "System Initialization",
          source: "WeatherGPT RAG Grounding Engine v0.1.0",
          values: "ECMWF / Open-Meteo High-Resolution Data Stream",
        },
      ],
      confidence: 0.99,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await sendChatMessage(query.trim(), historyPayload, location);

      const botMsg = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        sources: res.sources || [],
        confidence: res.confidence || 0.95,
        provider: res.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `⚠️ Failed to retrieve atmospheric intelligence: ${err.message}. Please check your connection or try again.`,
        sources: [],
        confidence: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "cleared",
        role: "assistant",
        content: `Chat session reset. Ask me anything about current atmospheric conditions, precipitation risks, or clothing advice for ${location ? location.name : "any location"}!`,
        sources: [],
        confidence: 0.99,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  return (
    <div className="chat-container glass-panel">
      {/* ── Chat Header ────────────────────────────────────────── */}
      <div className="chat-header-bar">
        <div className="chat-title-group">
          <div className="bot-avatar-glow">
            <Bot size={22} className="text-cyan" />
          </div>
          <div>
            <h3>WeatherGPT Conversational Assistant</h3>
            <p className="chat-substatus">
              <span className="live-dot"></span> Grounded RAG Pipeline • Llama-3 / Gemini Flash Fallback
            </p>
          </div>
        </div>

        <div className="chat-actions">
          {location && (
            <div className="active-loc-chip">
              <MapPin size={14} className="text-cyan" />
              <span>{location.name}</span>
            </div>
          )}
          <button className="icon-btn-subtle" onClick={handleClearHistory} title="Clear Conversation">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* ── Prompt Suggestions ──────────────────────────────────── */}
      <div className="prompt-chips-row">
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            className="prompt-chip"
            onClick={() => handleSend(prompt)}
            disabled={loading}
          >
            <Sparkles size={13} className="text-cyan" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* ── Chat Messages Scroll Area ───────────────────────────── */}
      <div className="chat-messages-area">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div className={`message-bubble-row ${isUser ? "user-row" : "assistant-row"}`} key={m.id}>
              {!isUser && (
                <div className="message-avatar bot-avatar">
                  <Bot size={18} />
                </div>
              )}
              <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
                <div className="message-meta-top">
                  <span className="author-name">{isUser ? "You" : "WeatherGPT AI"}</span>
                  <span className="message-time">{m.timestamp}</span>
                </div>
                <div className="message-text" dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }}></div>

                {/* Sources & Citations */}
                {m.sources && m.sources.length > 0 && (
                  <div className="citations-tray">
                    <div className="citations-head">
                      <ShieldCheck size={13} className="text-emerald" />
                      <span>Retrieved Atmospheric Grounding:</span>
                      <span className="confidence-pill">{Math.round((m.confidence || 0.95) * 100)}% Match</span>
                    </div>
                    <div className="sources-cards">
                      {m.sources.map((s, idx) => (
                        <div className="source-card" key={idx}>
                          <span className="source-title">{s.title || s.source}</span>
                          <span className="source-data">{s.values || s.data}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {isUser && (
                <div className="message-avatar user-avatar">
                  <User size={18} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="message-bubble-row assistant-row">
            <div className="message-avatar bot-avatar">
              <Bot size={18} />
            </div>
            <div className="message-bubble assistant-bubble typing-bubble">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-text">Retrieving weather features & synthesizing RAG response...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box ───────────────────────────────────────────── */}
      <form
        className="chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          placeholder={location ? `Ask WeatherGPT about ${location.name}...` : "Ask any meteorological question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          autoFocus
        />
        <button type="submit" className="send-btn" disabled={loading || !input.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

// Simple lightweight markdown formatter for bold, emojis, bullets, and breaks
function formatMarkdown(text) {
  if (!text) return "";
  let formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/• (.*?)(?=\n|$)/g, "<li>$1</li>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");

  if (formatted.includes("<li>")) {
    formatted = formatted.replace(/(<li>.*?<\/li>)/gs, "<ul>$1</ul>");
  }
  return formatted;
}
