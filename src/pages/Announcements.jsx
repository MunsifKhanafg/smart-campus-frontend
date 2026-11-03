import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime } from '../components/ui.jsx';

const EMPTY = { title: '', message: '', scope: 'all', departments: [], audience: '', publishDate: '', meetingDate: '', meetingTime: '', meetingLocation: '', isPublic: false };

// Everyone reads announcements addressed to them. The University Head can write to everyone or chosen departments;
// an HOD can only write to their own department (the server enforces this too).
export default function Announcements() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const canWrite = isHead || user.role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [mine, setMine] = useState([]);
  const [managed, setManaged] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    try {
      setMine((await api.get('/announcements')).data.data);
      if (canWrite) setManaged((await api.get('/announcements/manage')).data.data);
    } catch (e) { fail(e); }
  }, [canWrite, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, [isHead]);

  const toggleDept = (id) => setForm((f) => ({ ...f, departments: f.departments.includes(id) ? f.departments.filter((x) => x !== id) : [...f.departments, id] }));

  const send = async (e) => {
    e.preventDefault();
    try {
      const body = { title: form.title, message: form.message, scope: isHead ? form.scope : 'departments' };
      if (body.scope === 'departments') body.departments = isHead ? form.departments : [user.department._id];
      if (form.audience) body.roles = [form.audience];
      if (form.publishDate) body.publishDate = new Date(form.publishDate).toISOString();
      if (form.meetingDate) body.meeting = { date: form.meetingDate, time: form.meetingTime || undefined, location: form.meetingLocation || undefined };
      if (isHead && form.isPublic) body.isPublic = true;
      const { data } = await api.post('/announcements', body);
      ok(data.message);
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api.delete(`/announcements/${a._id}`); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="row-between">
        <h1>Announcements</h1>
        {canWrite && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}>+ New announcement</button>}
      </div>
      <Alert msg={msg} />

      {form && (
        <form className="card" onSubmit={send}>
          <h3>New announcement or meeting notice</h3>
          <label>Title</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label>Message</label>
          <textarea required rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <div className="form-grid">
            {isHead ? (
              <div>
                <label>Send to</label>
                <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                  <option value="all">All departments</option>
                  <option value="departments">Selected departments</option>
                </select>
              </div>
            ) : (
              <div><label>Send to</label><input disabled value={`My department (${user.department?.code})`} /></div>
            )}
            <div>
              <label>Audience</label>
              <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                <option value="">Everyone</option>
                <option value="student">Students only</option>
                <option value="teacher">Teachers only</option>
                <option value="hod">HODs only</option>
              </select>
            </div>
            <div><label>Publish at (empty = now)</label><input type="datetime-local" value={form.publishDate} onChange={(e) => setForm({ ...form, publishDate: e.target.value })} /></div>
          </div>
          {isHead && form.scope === 'departments' && (
            <div className="mt">
              {depts.map((d) => (
                <label key={d._id} className="check"><input type="checkbox" checked={form.departments.includes(d._id)} onChange={() => toggleDept(d._id)} />{d.name}</label>
              ))}
            </div>
          )}
          <div className="form-grid">
            <div><label>Meeting date (optional)</label><input type="date" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></div>
            <div><label>Meeting time</label><input value={form.meetingTime} placeholder="10:00 AM" onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} /></div>
            <div><label>Location</label><input value={form.meetingLocation} onChange={(e) => setForm({ ...form, meetingLocation: e.target.value })} /></div>
          </div>
          {isHead && <label className="check mt"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />Also show on the public contact page</label>}
          <div className="actions">
            <button className="btn btn-primary">Send</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <h3>For me</h3>
      {mine.map((a) => (
        <div className="sub-card" key={a._id}>
          <h4>{a.title}</h4>
          <div className="muted small">{fmtDateTime(a.publishDate)}{a.createdBy ? ` · ${a.createdBy}` : ''}</div>
          <p>{a.message}</p>
          {a.meeting?.date && <div className="small"><Badge value="scheduled" text="Meeting" /> {fmtDate(a.meeting.date)} {a.meeting.time || ''} {a.meeting.location ? `· ${a.meeting.location}` : ''}</div>}
        </div>
      ))}
      {!mine.length && <div className="card muted">No announcements for you yet.</div>}

      {canWrite && (
        <>
          <h3 className="mt">Sent by {isHead ? 'the university' : 'me'}</h3>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Title</th><th>To</th><th>Publish</th><th /></tr></thead>
              <tbody>
                {managed.map((a) => (
                  <tr key={a._id}>
                    <td>{a.title}</td>
                    <td>{a.scope === 'all' ? 'Everyone' : a.scope === 'departments' ? a.departments?.map((d) => d.code).join(', ') : 'Selected people'}{a.isPublic ? ' · public' : ''}</td>
                    <td>{fmtDateTime(a.publishDate)}</td>
                    <td><button className="btn btn-small btn-danger" onClick={() => remove(a)}>Delete</button></td>
                  </tr>
                ))}
                {!managed.length && <tr><td colSpan={4} className="muted">Nothing sent yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
