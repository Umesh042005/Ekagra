import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const SUGGESTIONS = {
  student: ['When is my next session?', 'What is my current streak?', 'What did I complete this week?'],
  coach: ['What are my upcoming sessions?', 'Which students can I see?', 'How many sessions did I complete?'],
};

/**
 * Floating Ekagra assistant for students and mentors.
 * Talks only to our backend (POST /chat) — the AI key never reaches the browser.
 * Chat history lives in memory only and is cleared on close/refresh.
 */
export default function ChatWidget() {
  const { isAuthenticated, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content }
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState(null); // 'ai' | 'demo'
  const bottomRef = useRef(null);

  const allowed = isAuthenticated && (role === 'student' || role === 'coach');

  useEffect(() => {
    if (!open || mode) return;
    api.get('/chat/status').then((res) => setMode(res.data?.mode)).catch(() => {});
  }, [open, mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Reset when the user logs out or switches account
  useEffect(() => {
    setMessages([]);
    setMode(null);
    setOpen(false);
  }, [role, isAuthenticated]);

  if (!allowed) return null;

  const send = async (text) => {
    const question = text.trim();
    if (!question || sending) return;
    setError('');
    setInput('');
    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setSending(true);
    try {
      const { data } = await api.post('/chat', { message: question, history });
      setMode(data.mode);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'The assistant could not reply. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Ekagra assistant"
          className="fixed bottom-24 right-4 z-50 w-13 h-13 p-3.5 rounded-full bg-[#BA6838] hover:bg-[#A8582A] text-white shadow-lg flex items-center justify-center"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {open && (
        <section
          aria-label="Ekagra assistant"
          className="fixed z-50 bottom-24 right-4 left-4 sm:left-auto sm:w-96 max-h-[70vh] flex flex-col bg-white rounded-3xl border border-[#EFE4D8] shadow-2xl overflow-hidden"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-[#F4E9DF] bg-[#FCFAF7]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FAF0E7] text-[#BA6838] flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-[#261B14] leading-tight">Ekagra Assistant</p>
                <p className="text-[10.5px] text-[#857368] leading-tight">
                  {mode === 'demo' ? 'Demo mode — no AI key set' : 'Ask about your sessions'}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant" className="text-[#857368] hover:text-[#261B14]">
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#FCFAF7]">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-[#635147]">
                  Hi! I can answer questions about {role === 'coach' ? 'your schedule and your students' : 'your sessions and progress'}.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(SUGGESTIONS[role] || []).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-[#F6ECE2] hover:bg-[#EFE4D8] text-[#635147]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#BA6838] text-white rounded-br-md'
                      : 'bg-white border border-[#EFE4D8] text-[#261B14] rounded-bl-md'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#857368]">
                <Loader2 size={12} className="animate-spin" /> Thinking…
              </div>
            )}
            {error && <p className="text-[11px] text-red-700" role="alert">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 p-3 border-t border-[#F4E9DF] bg-white"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Ask about your sessions…"
              aria-label="Message"
              className="flex-1 px-3.5 py-2.5 bg-[#FAF6F2] border border-[#EFE4D8] rounded-xl text-xs text-[#261B14] focus:outline-none focus:border-[#BA6838]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="w-10 h-10 rounded-xl bg-[#BA6838] hover:bg-[#A8582A] text-white flex items-center justify-center disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
