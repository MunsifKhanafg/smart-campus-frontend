import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge, fmtDateTime } from '../../components/ui.jsx';

const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correctIndex: 0, marks: 1 });
const EMPTY = { title: '', type: 'scheduled', durationMinutes: 10, startTime: '', endTime: '', maxAttempts: 1, questions: [blankQuestion()] };
const iso = (v) => (v ? new Date(v).toISOString() : undefined);

export default function Quizzes({ courseId, role }) {
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const [msg, ok, fail] = useFlash();
  const [list, setList] = useState([]);
  const [results, setResults] = useState([]); // student's own past attempts
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [report, setReport] = useState(null);
  const [session, setSession] = useState(null); // running attempt (student)

  const load = useCallback(() => {
    api.get('/quizzes', { params: { course: courseId } }).then((r) => setList(r.data.data)).catch(fail);
    if (isStudent) api.get('/quizzes/my-results', { params: { course: courseId } }).then((r) => setResults(r.data.data)).catch(() => {});
  }, [courseId, isStudent, fail]);
  useEffect(() => { load(); }, [load]);

  // The list holds "open" quizzes that may start or end while the page is open, so refresh it every 30 seconds.
  useEffect(() => {
    if (session) return undefined;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, session]);

  const setQ = (i, patch) => setForm({ ...form, questions: form.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) });
  const setOpt = (i, j, v) => setQ(i, { options: form.questions[i].options.map((o, k) => (k === j ? v : o)) });

  const create = async (e) => {
    e.preventDefault();
    const questions = [];
    for (const q of form.questions) {
      const options = q.options.map((o) => o.trim()).filter(Boolean);
      // keep the correct answer pointing at the same option after blank options are removed
      const correctText = q.options[q.correctIndex]?.trim();
      const correctIndex = options.indexOf(correctText);
      if (options.length < 2 || correctIndex < 0) return fail('Each question needs at least two options and a correct answer that is not blank');
      questions.push({ text: q.text, options, correctIndex, marks: Number(q.marks) });
    }
    const body = { course: courseId, title: form.title, type: form.type, durationMinutes: Number(form.durationMinutes), maxAttempts: Number(form.maxAttempts), questions };
    if (form.type === 'scheduled') { body.startTime = iso(form.startTime); body.endTime = iso(form.endTime); }
    try {
      await api.post('/quizzes', body);
      ok(form.type === 'surprise' ? 'Surprise quiz prepared. Students cannot see it until you start it' : 'Quiz scheduled');
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (err) { fail(err); }
  };

  const act = async (q, action, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    try {
      if (action === 'delete') await api.delete(`/quizzes/${q._id}`);
      else await api.post(`/quizzes/${q._id}/${action}`);
      ok('Done');
      load();
    } catch (err) { fail(err); }
  };

  const showResults = async (q) => {
    try { setReport((await api.get(`/quizzes/${q._id}/results`)).data.data); } catch (err) { fail(err); }
  };

  const start = async (q) => {
    try {
      const { data } = await api.post(`/quizzes/${q._id}/start`);
      setSession(data.data);
    } catch (err) { fail(err); }
  };

  if (session) {
    return <QuizRunner data={session} onDone={(m) => { setSession(null); ok(m); load(); }} onError={fail} />;
  }

  return (
    <>
      <Alert msg={msg} />
      {isTeacher && !showForm && <button className="btn btn-primary inline" onClick={() => setShowForm(true)}>+ New quiz</button>}
      {isTeacher && showForm && (
        <form className="card" onSubmit={create}>
          <h3>New quiz</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="scheduled">Scheduled</option>
                <option value="surprise">Surprise (hidden until you start it)</option>
              </select>
            </div>
            <div><label>Duration (minutes)</label><input type="number" min={1} required value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} /></div>
            {form.type === 'scheduled' && (
              <>
                <div><label>Opens</label><input type="datetime-local" required value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
                <div><label>Closes</label><input type="datetime-local" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
                <div><label>Attempts allowed</label><input type="number" min={1} max={5} value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></div>
              </>
            )}
          </div>
          {form.questions.map((q, i) => (
            <div className="sub-card mt" key={i}>
              <label>Question {i + 1}</label>
              <input required value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
              {q.options.map((o, j) => (
                <div className="inline-form" key={j}>
                  <label className="check" style={{ margin: 0 }}>
                    <input type="radio" name={`correct-${i}`} checked={q.correctIndex === j} onChange={() => setQ(i, { correctIndex: j })} />
                  </label>
                  <div><input placeholder={`Option ${j + 1}${q.correctIndex === j ? ' (correct)' : ''}`} value={o} onChange={(e) => setOpt(i, j, e.target.value)} /></div>
                </div>
              ))}
              <div className="inline-form">
                <div style={{ maxWidth: 120 }}><label>Marks</label><input type="number" min={0.5} step={0.5} value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} /></div>
                {form.questions.length > 1 && <button type="button" className="btn btn-small btn-danger" onClick={() => setForm({ ...form, questions: form.questions.filter((_, k) => k !== i) })}>Remove question</button>}
              </div>
            </div>
          ))}
          <div className="actions mt">
            <button type="button" className="btn" onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>+ Add question</button>
            <button className="btn btn-primary inline">Save quiz</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {!list.length && <div className="card muted">No quizzes to show.</div>}
      {list.map((q) => (
        <div className="sub-card" key={q._id}>
          <div className="row-between">
            <h4>{q.title} <span className="muted small">({q.type})</span></h4>
            <Badge value={isStudent ? q.phase : q.status} />
          </div>
          <div className="muted small">
            {q.durationMinutes} min · {q.maxMarks} marks
            {q.startTime ? ` · ${fmtDateTime(q.startTime)} to ${fmtDateTime(q.endTime)}` : ''}
            {isStudent ? ` · attempts ${q.attemptsUsed}/${q.maxAttempts}${q.bestScore !== null ? ` · best ${q.bestScore}` : ''}` : ` · ${q.questionCount} questions · ${q.attempts} attempts`}
          </div>
          <div className="actions mt">
            {isStudent && (q.phase === 'open' || q.inProgress) && <button className="btn btn-small btn-primary" onClick={() => start(q)}>{q.inProgress ? 'Resume' : 'Start quiz'}</button>}
            {isStudent && q.phase === 'upcoming' && <span className="muted small">Questions stay hidden until the start time.</span>}
            {isTeacher && q.type === 'surprise' && q.status === 'draft' && <button className="btn btn-small btn-primary" onClick={() => act(q, 'start-surprise', 'Start now? Students are notified immediately and the timer begins.')}>Start surprise quiz</button>}
            {isTeacher && q.status === 'live' && <button className="btn btn-small" onClick={() => act(q, 'close', 'Close the quiz now? Unfinished attempts are submitted with the answers saved so far.')}>Close now</button>}
            {!isStudent && <button className="btn btn-small" onClick={() => showResults(q)}>Results</button>}
            {isTeacher && q.attempts === 0 && <button className="btn btn-small btn-danger" onClick={() => act(q, 'delete', `Delete "${q.title}"?`)}>Delete</button>}
          </div>
        </div>
      ))}

      {isStudent && results.length > 0 && (
        <div className="card table-wrap">
          <h3>My quiz results</h3>
          <table>
            <thead><tr><th>Quiz</th><th>Attempt</th><th>Score</th><th>Submitted</th></tr></thead>
            <tbody>{results.map((r) => <tr key={r._id}><td>{r.quiz}</td><td>{r.attemptNumber}</td><td>{r.score} / {r.maxScore}</td><td>{fmtDateTime(r.submittedAt)}{r.status === 'auto_submitted' ? ' (time ran out)' : ''}</td></tr>)}</tbody>
          </table>
        </div>
      )}

      {report && (
        <div className="card">
          <div className="row-between"><h3>Results: {report.quiz.title}</h3><button className="btn btn-ghost" onClick={() => setReport(null)}>Close</button></div>
          {report.stats.attempted > 0 && <p className="muted">Attempted {report.stats.attempted} · average {report.stats.average} · highest {report.stats.highest} · lowest {report.stats.lowest} (out of {report.quiz.maxMarks})</p>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Attempts</th><th>Best score</th></tr></thead>
              <tbody>{report.rows.map((r) => <tr key={r.student}><td>{r.rollNumber}</td><td>{r.name}</td><td>{r.attempts}</td><td>{r.bestScore ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// The student's running attempt. The countdown follows the SERVER clock, answers are saved every 15 seconds,
// and the server enforces the deadline again when the quiz is submitted.
function QuizRunner({ data, onDone, onError }) {
  const { attempt, quiz, questions, serverTime } = data;
  const offset = useRef(new Date(serverTime).getTime() - Date.now());
  const expires = new Date(attempt.expiresAt).getTime();
  const [answers, setAnswers] = useState(() => Object.fromEntries((attempt.answers || []).map((a) => [a.question, a.selected])));
  const [left, setLeft] = useState(Math.max(0, expires - (Date.now() + offset.current)));
  const answersRef = useRef(answers);
  const sent = useRef(false);
  answersRef.current = answers;

  const payload = () => ({ answers: Object.entries(answersRef.current).map(([question, selected]) => ({ question, selected })) });

  const finish = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    try {
      const { data: res } = await api.post(`/quizzes/attempts/${attempt._id}/submit`, payload());
      onDone(`${res.message}. Score: ${res.data.score} / ${res.data.maxScore}`);
    } catch (err) {
      sent.current = false;
      onError(err);
    }
  }, [attempt._id, onDone, onError]);

  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = Math.max(0, expires - (Date.now() + offset.current));
      setLeft(remaining);
      if (remaining === 0) finish();
    }, 500);
    const save = setInterval(() => api.put(`/quizzes/attempts/${attempt._id}/answers`, payload()).catch(() => {}), 15000);
    return () => { clearInterval(tick); clearInterval(save); };
  }, [expires, attempt._id, finish]);

  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');

  return (
    <div className="card">
      <div className="row-between">
        <h3>{quiz.title}</h3>
        <strong style={{ color: left < 60000 ? 'var(--danger)' : 'inherit' }}>Time left {mm}:{ss}</strong>
      </div>
      {questions.map((q, i) => (
        <div className="sub-card" key={q._id}>
          <strong>{i + 1}. {q.text}</strong> <span className="muted small">({q.marks} marks)</span>
          {q.options.map((o, j) => (
            <label className="check" key={j}>
              <input type="radio" name={q._id} checked={answers[q._id] === j} onChange={() => setAnswers({ ...answers, [q._id]: j })} />{o}
            </label>
          ))}
        </div>
      ))}
      <button className="btn btn-primary" onClick={() => window.confirm('Submit your answers now?') && finish()}>Submit quiz</button>
    </div>
  );
}
