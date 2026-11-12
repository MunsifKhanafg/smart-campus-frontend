import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import Markdown from '../components/Markdown.jsx';
import Avatar from '../components/Avatar.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import './assistant.css';

// Example questions shown on an empty chat, per tool.
const STARTERS = {
  general: ['Explain the difference between a process and a thread', 'What are good ways to prepare for final exams in 2 weeks?', 'How do I write a strong introduction for a research report?'],
  explain: ['Normalization in databases', 'Supply and demand', 'Newton\'s laws of motion'],
  solve: ['Solve 2x² − 5x − 3 = 0 step by step', 'Find the derivative of x³·sin(x)', 'A loan of 100,000 at 12% simple interest for 3 years: find the total'],
  quiz: ['Pakistan Studies: Lahore Resolution and the 1940s', 'Data structures: stacks and queues', 'Islamiat: pillars of Islam'],
  plan: ['I have 4 subjects and exams start in 10 days. I can study 5 hours a day.'],
  code: ['Why does my loop print undefined? for (var i=0;i<3;i++){ setTimeout(()=>console.log(i)) }', 'Explain recursion with a simple example in Python'],
  lesson: ['Lesson plan: Introduction to SQL joins, 60 minutes, second-year students'],
  questions: ['10 short questions with answer key on operating system scheduling, 20 marks'],
  rubric: ['Rubric for a 10-mark presentation on a software design pattern'],
  people: ['List all teachers with their qualification, email and subjects', 'Show all students with roll numbers and semesters', 'How many students are in each semester?', 'Who is the HOD of each department?', 'Show students of semester 3'],
  records: ['CS-S1-03 (shows everything about the student)', 'attendance of CS-S1-03', 'fees of CS-S1-03', 'exam result of CS-S1-03', 'A teacher: type the name or email to see their courses', 'A course code, for example CS-101'],
  campus: ['Who teaches my subjects, and how can I contact them?', 'Show my weekly timetable', 'List the course contents of each of my subjects', 'How many credit hours do my subjects have in total?'],
};

export default function Assistant() {
  const { user } = useSelector((s) => s.auth);
  const confirm = useConfirm();
  const canSeeCourses = user.role !== 'finance_officer'; // the finance office cannot list courses, it only searches records
  const [modes, setModes] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [mode, setMode] = useState('records');
  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState([]);
  const [course, setCourse] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [copied, setCopied] = useState(null);
  const endRef = useRef(null);
  const boxRef = useRef(null);

  const loadChats = useCallback(() => api.get('/ai/conversations').then((r) => setChats(r.data.data)).catch(() => {}), []);

  useEffect(() => {
    api.get('/ai/modes').then((r) => {
      const list = r.data.data.modes;
      setModes(list);
      setConfigured(r.data.data.configured);
      // Start in "Search records" (it works without an AI key). Fall back to the first option this role really has.
      setMode((m) => (list.some((x) => x.id === m) ? m : list.find((x) => x.id === 'records')?.id || list[0]?.id || m));
    }).catch((e) => setError(errorMessage(e)));
    loadChats();
    if (!canSeeCourses) return;
    api.get('/courses', { params: { status: 'active' } })
      .then((r) => setCourses(r.data.data.map((c) => ({ id: c._id, label: `${c.code} · ${c.title}${c.section ? ` (${c.section})` : ''}` }))))
      .catch(() => {});
  }, [canSeeCourses, loadChats]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  // The history panel is a sheet on a phone: the page behind it does not scroll and Esc closes it.
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  const current = modes.find((m) => m.id === mode);
  const shownChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? chats.filter((c) => (c.title || 'Chat').toLowerCase().includes(q)) : chats;
  }, [chats, search]);

  const newChat = () => { setActiveId(null); setMessages([]); setError(''); setInput(''); setDrawer(false); };

  const openChat = async (id) => {
    try {
      const { data } = await api.get(`/ai/conversations/${id}`);
      setActiveId(id);
      setMessages(data.data.messages);
      setMode(modes.some((x) => x.id === data.data.mode) ? data.data.mode : (modes.find((x) => x.id === 'records')?.id || mode));
      if (data.data.course) setCourse(data.data.course);
      setError('');
      setDrawer(false);
    } catch (e) { setError(errorMessage(e)); }
  };

  const removeChat = async (c, e) => {
    e.stopPropagation();
    const yes = await confirm({ tone: 'danger', title: 'Delete this conversation?', message: `“${c.title || 'Chat'}” will be removed for good.`, confirmText: 'Delete', cancelText: 'Keep it' });
    if (!yes) return;
    try { await api.delete(`/ai/conversations/${c._id}`); if (c._id === activeId) newChat(); loadChats(); } catch (err) { setError(errorMessage(err)); }
  };

  const renameChat = async (c, e) => {
    e.stopPropagation();
    const title = await confirm.prompt({ title: 'Rename conversation', label: 'New name', value: c.title || '', placeholder: 'Conversation name', confirmText: 'Save' });
    if (!title) return;
    try { await api.patch(`/ai/conversations/${c._id}`, { title }); loadChats(); } catch (err) { setError(errorMessage(err)); }
  };

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    if (mode === 'course' && !course && !activeId) return setError('Choose a course first');
    setError('');
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const { data } = await api.post('/ai/chat', { message, mode, conversationId: activeId || undefined, course: mode === 'course' ? course || undefined : undefined });
      const r = data.data;
      setActiveId(r.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: r.answer, sources: r.sources, grounded: r.grounded, cards: r.cards }]);
      loadChats();
    } catch (e) {
      setMessages((m) => m.slice(0, -1));
      setInput(message);
      setError(errorMessage(e));
    } finally { setBusy(false); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };
  const grow = (e) => {
    setInput(e.target.value);
    const t = e.target;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 180)}px`;
  };

  const copy = async (text, i) => {
    try { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch { setError('Copy is not available in this browser'); }
  };

  const iconOf = (c) => modes.find((m) => m.id === (c.mode || (c.course ? 'course' : 'general')))?.icon || '💬';
  const starters = STARTERS[mode] || [];

  return (
    <div className="as">
      {drawer && <div className="as-scrim" onClick={() => setDrawer(false)} />}
      <aside className={`as-side ${drawer ? 'open' : ''}`} aria-label="Chat history">
        <div className="as-side-head">
          <b>Chat history</b>
          <button type="button" className="as-x" aria-label="Close history" onClick={() => setDrawer(false)}>✕</button>
        </div>
        <button className="btn btn-primary as-new" onClick={newChat}>＋ New chat</button>
        {chats.length > 5 && <input className="as-search" type="search" placeholder="Search chats…" value={search} onChange={(e) => setSearch(e.target.value)} />}
        <div className="as-list">
          {shownChats.map((c) => (
            <div key={c._id} className={`as-item ${c._id === activeId ? 'on' : ''}`} onClick={() => openChat(c._id)}>
              <span className="ico">{iconOf(c)}</span>
              <span className="t">{c.title || 'Chat'}</span>
              <button type="button" title="Rename" aria-label="Rename" onClick={(e) => renameChat(c, e)}>✎</button>
              <button type="button" title="Delete" aria-label="Delete" onClick={(e) => removeChat(c, e)}>✕</button>
            </div>
          ))}
          {!chats.length && <p className="muted small" style={{ padding: '.5rem' }}>Your conversations will appear here.</p>}
          {!!chats.length && !shownChats.length && <p className="muted small" style={{ padding: '.5rem' }}>No chat matches “{search}”.</p>}
        </div>
      </aside>

      <section className="as-main">
        <header className="as-head">
          <button type="button" className="btn btn-ghost as-hist" onClick={() => setDrawer(true)} aria-label="Open chat history">☰<span> History</span></button>
          <div className="grow">
            <h2>AI Assistant</h2>
            <span className="muted small as-sub">Type a roll number or a student's name. Add "attendance", "fees" or "result" to see only that.</span>
          </div>
          <button type="button" className="btn btn-ghost as-newtop" onClick={newChat}>New chat</button>
        </header>

        {/* One option only (the records search), so there is no menu of tools to choose from. */}
        {modes.length > 1 && (
          <div className="as-modes" role="tablist" aria-label="Assistant options">
            {modes.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`as-chip ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)} title={m.hint}>
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'course' && (
          <div className="as-course">
            <label>Course</label>
            <select value={course} onChange={(e) => setCourse(e.target.value)} disabled={!!activeId}>
              <option value="">Choose a course...</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <small className="muted">Answers come only from the notes your teacher uploaded for this course.</small>
          </div>
        )}
        {!configured && !['records', 'course', 'campus', 'people'].includes(mode) && <div className="alert alert-info">The AI model is not switched on, so this option answers by searching the records instead. Searching records never needs an AI key.</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="as-scroll" ref={boxRef}>
          {!messages.length && (
            <div className="as-empty">
              <div className="big">{current?.icon || '💬'}</div>
              <h3>{current?.label || 'Ask anything'}</h3>
              <p className="muted">{current?.hint}</p>
              <div className="as-starters">
                {starters.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`as-msg ${m.role}`}>
              <div className="as-av">{m.role === 'user' ? <Avatar user={user} size={32} square /> : '🤖'}</div>
              <div className="as-bubble">
                {m.role === 'assistant' ? <Markdown text={m.content} /> : <p className="as-user-text">{m.content}</p>}
                {m.role === 'assistant' && m.cards?.length > 0 && (
                  <div className="as-cards">
                    {m.cards.map((c) => (
                      <button key={`${c.kind}-${c.id}`} type="button" className="as-card" onClick={() => send(c.kind === 'student' ? `${c.subtitle.split(' · ')[0]}` : c.name)} title="Show everything about this person">
                        <span className="as-card-ico">{c.kind === 'student' ? '🎓' : '👩‍🏫'}</span>
                        <span><b>{c.name}</b><small>{c.subtitle}</small></span>
                      </button>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' && m.sources?.length > 0 && (
                  <div className="as-sources">Sources: {m.sources.map((s) => `${s.topic || 'Material'} (${s.fileName})`).join(', ')}</div>
                )}
                {m.role === 'assistant' && (
                  <button type="button" className="as-copy" onClick={() => copy(m.content, i)}>{copied === i ? 'Copied ✓' : 'Copy'}</button>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="as-msg assistant"><div className="as-av">🤖</div><div className="as-bubble"><span className="as-dots"><i /><i /><i /></span></div></div>
          )}
          <div ref={endRef} />
        </div>

        <form className="as-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <textarea rows={1} value={input} onChange={grow} onKeyDown={onKey} placeholder={current?.placeholder || 'Message the assistant...'} maxLength={4000} />
          <button className="btn btn-primary as-send" disabled={busy || !input.trim()} aria-label="Send">{busy ? '…' : <><span className="as-send-txt">Send</span><span className="as-send-ico">➤</span></>}</button>
        </form>
        <p className="as-note">AI can make mistakes, so check important facts. It never changes marks, grades, attendance, fees or admission.</p>
      </section>
    </div>
  );
}
