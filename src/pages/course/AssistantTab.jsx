import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert } from '../../components/ui.jsx';

const sourceLabel = (s) => (typeof s === 'string' ? s : s?.title || s?.topic || s?.topicTitle || s?.file || s?.fileName || s?.originalName || 'course material');

// AI Course Assistant. The answer is built from course materials the student is allowed to see (RAG on the server).
export default function AssistantTab({ courseId }) {
  const [msg, , fail] = useFlash();
  const [messages, setMessages] = useState([]);
  const [convoId, setConvoId] = useState(null);
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef(null);

  const loadHistory = () => api.get('/ai/conversations', { params: { course: courseId } }).then((r) => setHistory(r.data.data)).catch(() => {});
  useEffect(() => { loadHistory(); }, [courseId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const open = async (id) => {
    try {
      const { data } = await api.get(`/ai/conversations/${id}`);
      setConvoId(id);
      setMessages(data.data.messages);
    } catch (err) { fail(err); }
  };

  const ask = async (e) => {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3) return;
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setQuestion('');
    setBusy(true);
    try {
      const { data } = await api.post('/ai/ask', { course: courseId, question: q, ...(convoId ? { conversationId: convoId } : {}) });
      setConvoId(data.data.conversationId);
      setMessages((m) => [...m, { role: 'assistant', content: data.data.answer, sources: data.data.sources, grounded: data.data.grounded }]);
      loadHistory();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cols-2">
      <div className="card">
        <h3>Ask about this course</h3>
        <Alert msg={msg} />
        <div className="chat">
          {!messages.length && <p className="muted">Ask a question about the lecture notes and slides of this course. Topics that are not released yet are never used for students.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.content}
              {m.role === 'assistant' && (
                <div className="muted small" style={{ marginTop: '.4rem' }}>
                  {m.grounded === false ? 'No matching course material was found, so this answer is not based on your course files.' : m.sources?.length ? `Sources: ${[...new Set(m.sources.map(sourceLabel))].join(', ')}` : ''}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="bubble assistant muted">Thinking…</div>}
          <div ref={bottom} />
        </div>
        <form className="inline-form" onSubmit={ask}>
          <div><input value={question} maxLength={1000} placeholder="Type your question…" onChange={(e) => setQuestion(e.target.value)} /></div>
          <button className="btn btn-primary inline" disabled={busy}>Ask</button>
        </form>
        <p className="muted small">The assistant explains course content only. It cannot change marks, grades, admission or promotion.</p>
      </div>
      <div className="card">
        <div className="row-between"><h3>My conversations</h3><button className="btn btn-small" onClick={() => { setConvoId(null); setMessages([]); }}>New chat</button></div>
        {!history.length && <p className="muted">No conversations yet.</p>}
        {history.map((h) => <div key={h._id}><button className="link-btn" onClick={() => open(h._id)}>{h.title}</button></div>)}
      </div>
    </div>
  );
}
