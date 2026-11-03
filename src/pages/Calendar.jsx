import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, toInputDate, label } from '../components/ui.jsx';

const TYPES = ['semester_start', 'semester_end', 'midterm_exam', 'final_exam', 'summer_vacation', 'winter_vacation', 'holiday', 'event'];
const EMPTY = { title: '', type: 'event', startDate: '', endDate: '', description: '', department: '' };

// Everyone sees the events meant for them. The University Head manages university-wide events, an HOD their department's.
export default function Calendar() {
  const { user } = useSelector((s) => s.auth);
  const canEdit = ['university_head', 'hod'].includes(user.role);
  const isHead = user.role === 'university_head';
  const [msg, ok, fail] = useFlash();
  const [events, setEvents] = useState([]);
  const [depts, setDepts] = useState([]);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    try { setEvents((await api.get('/calendar')).data.data); } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, [isHead]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form };
      if (!body.description) delete body.description;
      if (!isHead || !body.department) delete body.department;
      if (form._id) {
        const { _id, department, ...editable } = body;
        await api.put(`/calendar/${_id}`, editable);
      } else {
        await api.post('/calendar', body);
      }
      ok('Calendar saved');
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try { await api.delete(`/calendar/${ev._id}`); load(); } catch (err) { fail(err); }
  };

  const editable = (ev) => isHead || (ev.department && ev.department._id === user.department?._id);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="row-between">
        <h1>Academic Calendar</h1>
        {canEdit && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}>+ Add event</button>}
      </div>
      <Alert msg={msg} />

      {form && (
        <form className="card" onSubmit={save}>
          <h3>{form._id ? 'Edit event' : 'New event'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
            <div><label>Start date</label><input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label>End date</label><input required type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            {isHead && !form._id && (
              <div>
                <label>Applies to</label>
                <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">Whole university</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <label>Description (optional)</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>From</th><th>To</th><th>Event</th><th>Type</th><th>For</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev._id} style={fmtDate(ev.endDate) < today ? { opacity: 0.55 } : undefined}>
                <td>{fmtDate(ev.startDate)}</td>
                <td>{fmtDate(ev.endDate)}</td>
                <td>{ev.title}{ev.description && <div className="muted small">{ev.description}</div>}</td>
                <td><Badge value={ev.type} /></td>
                <td>{ev.department ? ev.department.code : 'University'}{ev.semester ? ` · ${ev.semester.name}` : ''}</td>
                {canEdit && (
                  <td className="actions">
                    {editable(ev) && (
                      <>
                        <button className="btn btn-small" onClick={() => setForm({ _id: ev._id, title: ev.title, type: ev.type, description: ev.description || '', startDate: toInputDate(ev.startDate), endDate: toInputDate(ev.endDate), department: '' })}>Edit</button>
                        <button className="btn btn-small btn-danger" onClick={() => remove(ev)}>Delete</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!events.length && <tr><td colSpan={6} className="muted">No events yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
