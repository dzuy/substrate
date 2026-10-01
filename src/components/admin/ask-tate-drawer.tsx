import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageCircle, RotateCcw, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Source = { id: string; name: string; brand: string };
type FollowUp = { label: string; question: string };
type Message = { role: 'user' | 'assistant'; content: string; sources?: Source[]; followUps?: FollowUp[]; displayContent?: string };
const suggestions = ['Compare two products and their formulas', 'Which products contain niacinamide?', 'What ingredient data is missing?'];

export default function AskTateDrawer({ open, onClose, onProduct }: { open: boolean; onClose: () => void; onProduct: (id: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'end' }); }, [messages, busy, open]);

  async function send(text = question, displayContent?: string) {
    if (lock.current || !text.trim()) return;
    lock.current = true; setBusy(true); setError('');
    const next: Message[] = [...messages, { role: 'user', content: text.trim(), displayContent }];
    const history = next.slice(-23).map(({ role, content }) => ({ role, content }));
    while (JSON.stringify(history).length > 45000 && history.length > 1) history.splice(0, 2);
    setMessages(next); setQuestion('');
    const request = new AbortController(); controller.current = request;
    const timeout = setTimeout(() => request.abort(), 175000);
    try {
      const session = await supabase.auth.getSession();
      if (session.error || !session.data.session) throw new Error('Sign in again to ask Tate.');
      // Keep complete recent turns within the server's conversation limit.
      const endpoint = process.env.EXPO_PUBLIC_TATE_API_URL ?? (['localhost', '127.0.0.1'].includes(window.location.hostname) ? `http://${window.location.hostname}:4318/api/ask-tate` : '/api/ask-tate');
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session.access_token}` }, body: JSON.stringify({ messages: history }), signal: request.signal });
      const result = await response.json().catch(() => null);
      if (!response.ok || typeof result?.answer !== 'string') throw new Error(result?.error ?? 'Tate is unavailable. Check that the chat server is running, then try again.');
      setMessages([...next, { role: 'assistant', content: result.answer, sources: Array.isArray(result.sources) ? result.sources : [], followUps: Array.isArray(result.followUps) ? result.followUps : [] }]);
    } catch (e) {
      if (!request.signal.aborted || controller.current === request) {
        setMessages(next.slice(0, -1)); setQuestion(text);
        setError(request.signal.aborted ? 'Tate took too long to respond. Try a more specific question.' : e instanceof Error ? e.message : 'Could not connect to Tate. Try again.');
      }
    } finally { clearTimeout(timeout); lock.current = false; setBusy(false); }
  }

  return <div className={`cms-tate-backdrop${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open} onMouseDown={(event) => { if (open && event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className="cms-tate-drawer" role="dialog" aria-modal="true" aria-labelledby="cms-tate-title" onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? []).filter((element) => element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="cms-tate-header"><div className="cms-tate-icon"><MessageCircle size={20} /></div><div><h2 id="cms-tate-title">Ask Tate</h2><p>Your product database assistant</p></div><button className="cms-button" disabled={busy || !messages.length} aria-label="Start a new chat" title="New chat" onClick={() => { setMessages([]); setQuestion(''); setError(''); input.current?.focus(); }}><RotateCcw size={16} /></button><button className="cms-button" aria-label="Close Ask Tate" onClick={onClose}><X size={18} /></button></header>
      <div className="cms-tate-messages" role="log" aria-label="Conversation with Tate" aria-live="polite" aria-relevant="additions" aria-busy={busy}>
        {!messages.length ? <div className="cms-tate-welcome"><span className="cms-tate-icon"><MessageCircle size={25} /></span><h3>Get to know your catalog.</h3><p>Compare products, explore ingredients, and ask about the evidence in your database.</p><div className="cms-tate-suggestions">{suggestions.map((suggestion, index) => <button key={suggestion} disabled={busy} onClick={() => { if (index === 0) { setQuestion('Compare '); input.current?.focus(); } else void send(suggestion); }}>{suggestion}<ArrowUp size={14} /></button>)}</div></div> : null}
        {messages.map((message, index) => <article key={index} className={`cms-tate-message ${message.role}`}><span>{message.role === 'user' ? 'You' : 'Tate'}</span><p>{message.displayContent ?? message.content}</p>{message.sources?.length ? <details className="cms-tate-sources"><summary>Catalog records consulted <span>({message.sources.length})</span></summary><div className="cms-tate-source-links">{message.sources.map((source) => <button key={source.id} onClick={() => { onClose(); onProduct(source.id); }}>{source.brand ? `${source.brand} · ` : ''}{source.name}</button>)}</div></details> : null}{index === messages.length - 1 && message.followUps?.length ? <div className="cms-tate-follow-ups">{message.followUps.map((followUp) => <button key={followUp.question} className="cms-button" disabled={busy} onClick={() => void send(followUp.question, followUp.label)}>{followUp.label}</button>)}</div> : null}</article>)}
        {busy ? <div className="cms-tate-thinking" role="status"><span className="cms-live-dot" />Tate is checking the catalog…</div> : null}<div ref={end} />
      </div>
      <form className="cms-tate-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        {error ? <p className="cms-tate-error" role="alert">{error}</p> : null}
        <div><textarea ref={input} aria-label="Ask about products or ingredients" placeholder="Ask about products or ingredients…" value={question} maxLength={4000} rows={3} disabled={busy} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} /><button type="submit" className="cms-button primary" disabled={busy || !question.trim()} aria-label="Send question"><ArrowUp size={18} /></button></div>
      </form>
    </div>
  </div>;
}
