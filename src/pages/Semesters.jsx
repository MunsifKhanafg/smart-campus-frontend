import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const EMPTY = { name: '', number: 1, academicYear: '', startDate: '', endDate: '' };
const STATUSES = ['upcoming', 'active', 'completed', 'archived'];

export default function Semesters() {
  const { user } = useSelector((s) => s.auth);
  const academicYear = useSelector((s) => s.settings.currentAcademicYear);
  const isHod = user.role === 'hod';
  const isHead = user.role === 'university_head';
  const confirm = useConfirm();

  const [list, setList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filter, setFilter] = useState({ department: '', status: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState(null); // null | 'new' | semester
  const [form, setForm] = useState(EMPTY);

  const flash = (type, text) => setMsg({ type, text });

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter.department) params.department = filter.department;
      if (filter.status) params.status = filter.status;
      const { data } = await api.get('/semesters', { params });
      setList(data.data);
    } catch (e) {
      flash('error', errorMessage(e));
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isHead) api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {});
  }, [isHead]);

  const openForm = (s) => {
    setEditing(s || 'new');
    setForm(
      s
        ? { name: s.name, number: s.number, academicYear: s.academicYear, startDate: day(s.startDate), endDate: day(s.endDate) }
        : { ...EMPTY, academicYear }
    );
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, number: Number(form.number) };
      if (editing === 'new') await api.post('/semesters', body);
      else await api.put(`/semesters/${editing._id}`, body);
      flash('success', 'Semester saved');
      setEditing(null);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  const changeStatus = async (s, status) => {
    try {
      await api.patch(`/semesters/${s._id}/status`, { status });
      load();
    } catch (err) {
      flash('error', errorMessage(err));
    }
  };

  // Asks the server what is inside the semester, shows it in the modal, and deletes only after the HOD confirms.
  const remove = async (s) => {
    try {
      const { data } = await api.get(`/semesters/${s._id}/delete-preview`);
      const p = data.data;

      if (p.blockedByPayments > 0) {
        await confirm({
          tone: 'info',
          title: 'This semester cannot be deleted',
          message: `${p.blockedByPayments} fee payment(s) were already made for "${s.name}". Payments are financial records and must be kept.\n\nMark the semester as archived instead.`,
          confirmText: 'OK',
          cancelText: null,
        });
        return;
      }

      const yes = await confirm({
        tone: 'danger',
        title: `Delete "${s.name}"?`,
        message: p.hasRecords
          ? 'Everything listed below will be permanently deleted and cannot be brought back.'
            + (p.students > 0 ? ` The ${p.students} student(s) in this semester are NOT deleted; they only become "not placed".` : '')
          : 'This semester is empty and will be deleted permanently.',
        details: p.items.map((i) => `${i.count} ${i.label}`),
        requireText: p.hasRecords ? 'DELETE' : undefined,
        confirmText: 'Delete semester',
      });
      if (!yes) return;

      await api.delete(`/semesters/${s._id}`, { params: { force: true } });
      flash('success', `"${s.name}" was deleted`);
      load();
    } catch (err) {
      flash('error', errorMessage(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      <div className="row-between">
        <h1>Semesters</h1>
        {isHod && <button className="btn btn-primary" onClick={() => openForm(null)}>+ New semester</button>}
      </div>
      <p className="muted">
        {isHead
          ? 'Read-only view of every department. Semesters are managed by each HOD.'
          : 'Several semesters can run at the same time, each with its own courses and timetable.'}
      </p>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card filters">
        {isHead && (
          <div>
            <label>Department</label>
            <select value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label>Status</label>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {editing && isHod && (
        <form className="card" onSubmit={save}>
          <h3>{editing === 'new' ? 'New semester' : `Edit ${editing.name}`}</h3>
          <div className="form-grid">
            <div><label>Name</label><input required value={form.name} placeholder="BSCS Semester 3 - Fall" onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Semester number</label><input type="number" min={1} max={12} required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
            <div><label>Academic year</label><input required pattern="\d{4}-\d{4}" placeholder="2025-2026" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></div>
            <div><label>Start date</label><input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label>End date</label><input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>{isHead && <th>Department</th>}<th>No.</th><th>Year</th><th>Dates</th><th>Status</th>{isHod && <th />}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s._id}>
                <td>{s.name}</td>
                {isHead && <td>{s.department?.code}</td>}
                <td>{s.number}</td>
                <td>{s.academicYear}</td>
                <td>{day(s.startDate)} → {day(s.endDate)}</td>
                <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                {isHod && (
                  <td className="actions">
                    {s.status !== 'archived' && <button className="btn btn-small" onClick={() => openForm(s)}>Edit</button>}
                    {s.status !== 'archived' && (
                      <select style={{ width: 'auto' }} value={s.status} onChange={(e) => changeStatus(s, e.target.value)}>
                        {STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    )}
                    <button className="btn btn-small btn-danger" onClick={() => remove(s)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="muted">No semesters found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
