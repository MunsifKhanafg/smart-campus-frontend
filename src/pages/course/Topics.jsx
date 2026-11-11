import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import ContentsCard from '../../components/ContentsCard.jsx';
import SchedulePlanner from '../../components/SchedulePlanner.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, FileLink, fmtDate, toInputDate } from '../../components/ui.jsx';

const EMPTY = { title: '', description: '', scheduledDate: '', availableUntil: '' };

// Daily teaching topics. The SERVER decides what a student may see: upcoming topics arrive with only a title and a date.
export default function Topics({ courseId, canEdit, outline }) {
  const [msg, ok, fail] = useFlash();
  const confirm = useConfirm();
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [picked, setPicked] = useState({}); // topicId -> FileList
  const [rev, setRev] = useState(0); // bumped whenever the topics change, so the planner summary reloads

  const load = useCallback(
    () => api.get('/topics', { params: { course: courseId } }).then((r) => { setTopics(r.data.data); setRev((n) => n + 1); }).catch(fail),
    [courseId, fail]
  );
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
          <p className="muted small">Students see the title and date of upcoming topics, but the description and files stay hidden until the teaching date.</p>
        </form>
      )}

      {!topics.length && <div className="card muted">No topics yet.</div>}
      {topics.map((t, i) => (
        <div className="sub-card" key={t._id}>
          <div className="row-between">
            <h4>Topic {t.sequence || i + 1}: {t.title}</h4>
            <Badge value={t.state} />
          </div>
          <div className="muted small">Teaching date: {fmtDate(t.scheduledDate)}{t.availableUntil ? ` · available until ${fmtDate(t.availableUntil)}` : ''}</div>
          {t.state === 'upcoming' && !canEdit && <p className="muted small">Materials unlock on the teaching date.</p>}
          {t.description && <p>{t.description}</p>}
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
            <div className="inline-form mt">
              <div><input type="file" multiple onChange={(e) => setPicked({ ...picked, [t._id]: e.target.files })} /></div>
              <button className="btn btn-small" onClick={() => upload(t)}>Upload files</button>
              <button className="btn btn-small" onClick={() => edit(t)}>Edit / reschedule</button>
              <button className="btn btn-small btn-danger" onClick={() => remove(t)}>Delete</button>
            </div>
          )}
        </div>
      ))}
      {canEdit && <p className="muted small">Text files (PDF, DOCX, PPTX, TXT) are also indexed for the AI Course Assistant. Indexing follows each topic's release date.</p>}
    </>
  );
}
