import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import ContentsCard from '../../components/ContentsCard.jsx';
import SchedulePlanner from '../../components/SchedulePlanner.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, FileLink, fmtDate, toInputDate } from '../../components/ui.jsx';

const EMPTY = { title: '', description: '', scheduledDate: '', availableUntil: '' };

// "21/9/2026" (no leading zeros) and "Monday": every class is shown with its date AND its day.
const dmy = (d) => { const x = new Date(d); return `${x.getUTCDate()}/${x.getUTCMonth() + 1}/${x.getUTCFullYear()}`; };
const weekday = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
const KIND = { quiz: 'QUIZ DAY', presentation: 'PRESENTATION DAY' };

// Daily teaching topics. The SERVER decides what a student may see: upcoming topics arrive with only a title and a date.
export default function Topics({ courseId, canEdit, outline }) {
  const [msg, ok, fail] = useFlash();
  const confirm = useConfirm();
  const [topics, setTopics] = useState([]);
  const [assess, setAssess] = useState([]); // quizzes and presentations of this class: [{ date, kind, title }]
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [picked, setPicked] = useState({}); // topicId -> FileList
  const [rev, setRev] = useState(0); // bumped whenever the topics change, so the planner summary reloads

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        api.get('/topics', { params: { course: courseId } }),
        api.get(`/teaching-calendar/course/${courseId}`).catch(() => null), // the quiz and presentation days; the topics still show without it
      ]);
      setTopics(t.data.data);
      setAssess(c?.data?.data?.assessmentDays || []);
      setRev((n) => n + 1);
    } catch (e) { fail(e); }
  }, [courseId, fail]);
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    const body = {
      title: form.title,
      description: form.description,
      scheduledDate: form.scheduledDate,
      availableUntil: form.availableUntil || null,
    };
    try {
      if (editId) await api.put(`/topics/${editId}`, body);
      else await api.post('/topics', { ...body, course: courseId });
      ok(editId ? 'Topic updated' : 'Topic created');
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (err) { fail(err); }
  };

  const edit = (t) => {
    setEditId(t._id);
    setForm({ title: t.title, description: t.description || '', scheduledDate: toInputDate(t.scheduledDate), availableUntil: toInputDate(t.availableUntil) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (t) => {
    if (!(await confirm({ tone: 'danger', title: `Delete "${t.title}"?`, message: 'The topic and all its uploaded files are deleted permanently.', confirmText: 'Delete topic' }))) return;
    try { await api.delete(`/topics/${t._id}`); ok('Topic deleted'); load(); } catch (err) { fail(err); }
  };

  const upload = async (t) => {
    const list = picked[t._id];
    if (!list?.length) return fail('Choose at least one file first');
    const fd = new FormData();
    [...list].forEach((f) => fd.append('files', f));
    try {
      await api.post(`/topics/${t._id}/materials`, fd);
      ok('Files uploaded');
      setPicked({ ...picked, [t._id]: null });
      load();
    } catch (err) { fail(err); }
  };

  const removeFile = async (t, m) => {
    if (!(await confirm({ tone: 'danger', title: 'Remove this file?', message: m.originalName, confirmText: 'Remove file' }))) return;
    try { await api.delete(`/topics/${t._id}/materials/${m.storedName}`); load(); } catch (err) { fail(err); }
  };

  // One block per DATE, in date order. A date holds its topics (numbered 1), 2) ...) and/or a quiz or presentation.
  const byDate = new Map();
  const block = (key) => { if (!byDate.has(key)) byDate.set(key, { key, topics: [], assessments: [] }); return byDate.get(key); };
  topics.forEach((t) => block(toInputDate(t.scheduledDate)).topics.push(t));
  assess.forEach((a) => block(a.date).assessments.push(a));
  const blocks = [...byDate.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  let classNo = 0;

  return (
    <>
      <Alert msg={msg} />
      <ContentsCard outline={outline} courseId={courseId} canEdit={canEdit} topicCount={topics.length} onCreated={load} ok={ok} fail={fail} />
      {canEdit && <SchedulePlanner courseId={courseId} refreshKey={rev} onChanged={load} ok={ok} fail={fail} />}
      {canEdit && (
        <form className="card" onSubmit={save}>
          <h3>{editId ? 'Edit topic' : 'New topic'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Teaching date</label><input type="date" required value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></div>
            <div><label>Available until (optional)</label><input type="date" value={form.availableUntil} onChange={(e) => setForm({ ...form, availableUntil: e.target.value })} /></div>
          </div>
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">{editId ? 'Save changes' : 'Add topic'}</button>
            {editId && <button type="button" className="btn btn-ghost mt" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
          </div>
          <p className="muted small">Students see the title and date of upcoming topics, but the description and files stay hidden until the teaching date. A quiz or presentation day cannot be used for a topic.</p>
        </form>
      )}

      {!blocks.length && <div className="card muted">No topics yet.</div>}
      {blocks.map((b) => {
        const hasTopics = b.topics.length > 0;
        if (hasTopics) classNo += 1;
        const first = b.topics[0] || b.assessments[0];
        const dateValue = b.topics[0]?.scheduledDate || `${b.key}T00:00:00.000Z`;
        return (
          <div key={b.key}>
            {b.assessments.map((a, i) => (
              <div key={`a${i}`} className="card" style={{ borderLeft: '4px solid #d97706' }}>
                <strong>{dmy(dateValue)} · {weekday(dateValue)} · {KIND[a.kind]}: {a.title}</strong>
                <div className="muted small">
                  {hasTopics
                    ? 'This is not a class-topic day, but a topic is still dated here (it was dated by hand). Move it to another teaching day.'
                    : 'Today is not a class-topic day. The topics of this day were moved to the next teaching days.'}
                </div>
              </div>
            ))}
            {hasTopics && (
              <div className="card">
                <h4 style={{ marginBottom: 6 }}>
                  {dmy(dateValue)} ({b.topics.length === 1 ? '1 topic' : `${b.topics.length} topics`}) · {weekday(dateValue)} · Class {classNo}
                </h4>
                {b.topics.map((t, i) => (
                  <div key={t._id} style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border, #e5e7eb)' : 'none' }}>
                    <div className="row-between">
                      <div><strong>{i + 1}) Topic {t.sequence || ''}: {t.title}</strong></div>
                      <Badge value={t.state} />
                    </div>
                    {t.availableUntil && <div className="muted small">Available until {fmtDate(t.availableUntil)}</div>}
                    {t.state === 'upcoming' && !canEdit && <div className="muted small">Materials unlock on the teaching date.</div>}
                    {t.description && <div className="small">{t.description}</div>}
                    {t.materials?.length > 0 && (
                      <div>
                        {t.materials.map((m) => (
                          <span key={m.storedName}>
                            <FileLink path={`/topics/${t._id}/materials/${m.storedName}`} name={m.originalName} onError={fail} />
                            {canEdit && <button className="btn btn-small btn-danger" onClick={() => removeFile(t, m)}>x</button>}
                          </span>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="inline-form" style={{ marginTop: 4 }}>
                        <div><input type="file" multiple title="Slides, PDF, DOCX, TXT or images" onChange={(e) => setPicked({ ...picked, [t._id]: e.target.files })} /></div>
                        <button className="btn btn-small" onClick={() => upload(t)}>Upload slides / files</button>
                        <button className="btn btn-small" onClick={() => edit(t)}>Edit / reschedule</button>
                        <button className="btn btn-small btn-danger" onClick={() => remove(t)}>Delete</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!first && null}
          </div>
        );
      })}
      {canEdit && <p className="muted small">Text files (PDF, DOCX, PPTX, TXT) are also indexed for the AI Course Assistant. Indexing follows each topic's release date.</p>}
    </>
  );
}
