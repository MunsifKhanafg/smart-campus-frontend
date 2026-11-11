import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge } from '../components/ui.jsx';
import Avatar from '../components/Avatar.jsx';

const EMPTY = { name: '', email: '', password: '', rollNumber: '', semester: '', section: 'A', dateOfBirth: '', department: '' };

// HOD: manage own department's students. Head: browse and create in any department.
export default function Students() {
  const { user } = useSelector((s) => s.auth);
  const isHod = user.role === 'hod';
  const confirm = useConfirm();
  const [msg, ok, fail] = useFlash();
  const [rows, setRows] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [depts, setDepts] = useState([]);
  const [filter, setFilter] = useState({ department: '', semester: '', search: '' });
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState([]);
  const [target, setTarget] = useState('');
  const [editing, setEditing] = useState(null); // HOD: correcting a typing mistake in a student's details

  const startEdit = (p) => {
    setEditing({
      id: p._id, label: `${p.user?.name} (${p.rollNumber})`,
      name: p.user?.name || '', email: p.user?.email || '', phone: p.user?.phone || '',
      rollNumber: p.rollNumber || '', section: p.section || '',
      original: { name: p.user?.name || '', email: p.user?.email || '', phone: p.user?.phone || '', rollNumber: p.rollNumber || '', section: p.section || '' },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const body = {};
    ['name', 'email', 'phone', 'rollNumber', 'section'].forEach((k) => { if (editing[k] !== editing.original[k] && editing[k] !== '') body[k] = editing[k]; });
    if (!Object.keys(body).length) return fail('Nothing was changed');
    try {
      await api.put(`/students/${editing.id}`, body);
      ok(`Saved.${body.email ? ' The student must sign in with the new email.' : ''}`);
      setEditing(null);
      load();
    } catch (err) { fail(err); }
  };

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
      setRows((await api.get('/students', { params })).data.data);
      setSelected([]);
    } catch (e) { fail(e); }
  }, [filter, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch(() => {});
    if (!isHod) api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, [isHod]);

  const create = async (e) => {
    e.preventDefault();
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v));
      if (isHod) delete body.department;
      await api.post('/students', body);
      ok('Student created. They must change the password at first login.');
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const assign = async () => {
    try {
      const { data } = await api.post('/students/assign-semester', { semester: target, students: selected });
      ok(`${data.data.students} students placed; ${data.data.enrolled} course enrollments created`);
      load();
    } catch (err) { fail(err); }
  };

  const setStatus = async (p, status) => {
    const suspending = status !== 'active';
    const yes = await confirm({
      tone: suspending ? 'danger' : 'primary',
      title: `${suspending ? 'Suspend' : 'Activate'} ${p.user.name}?`,
      message: suspending
        ? 'The student will not be able to log in. All records are kept.'
        : 'The student will be able to log in again.',
      confirmText: suspending ? 'Suspend' : 'Activate',
    });
    if (!yes) return;
    try { await api.patch(`/students/${p._id}/status`, { status }); load(); } catch (err) { fail(err); }
  };

  const remove = async (p) => {
    const yes = await confirm({
      tone: 'danger',
      title: `Delete student ${p.user?.name} (${p.rollNumber})?`,
      message: 'The student account and profile will be deleted permanently.\n\nThis is only allowed if the student has no attendance, marks, payments or other records yet. Otherwise use Suspend.',
      confirmText: 'Delete student',
    });
    if (!yes) return;
    try {
      await api.delete(`/students/${p._id}`);
      ok('Student deleted');
      load();
    } catch (err) {
      fail(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const openSems = semesters.filter((s) => !['completed', 'archived'].includes(s.status));
  const formSems = openSems.filter((s) => isHod || !form?.department || s.department?._id === form.department);

  return (
    <>
      <div className="row-between">
        <h1>Students</h1>
        <button className="btn btn-primary" onClick={() => setForm(EMPTY)}>+ New student</button>
      </div>
      <Alert msg={msg} />

      {form && (
        <form className="card" onSubmit={create}>
          <h3>New student</h3>
          <div className="form-grid">
            <div><label>Full name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Temporary password</label><input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><label>Roll number</label><input required value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} /></div>
            <div><label>Date of birth (used for public result check)</label><input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
            <div><label>Section</label><input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
            {!isHod && (
              <div>
                <label>Department</label>
                <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value, semester: '' })}>
                  <option value="">Select...</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Semester (optional)</label>
              <select value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">Not placed yet</option>
                {formSems.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
              </select>
            </div>
          </div>
          <div className="actions"><button className="btn btn-primary">Create</button><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}

      {editing && (
        <form className="card" onSubmit={saveEdit}>
          <h3>Correct details: {editing.label}</h3>
          <p className="muted small">Fix a typing mistake here instead of deleting the student. The email is the login name, so it must be unique. The roll number must be unique too.</p>
          <div className="form-grid">
            <div><label>Full name</label><input required minLength={2} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><label>Email (login)</label><input required type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
            <div><label>Mobile number</label><input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
            <div><label>Roll number</label><input required minLength={2} value={editing.rollNumber} onChange={(e) => setEditing({ ...editing, rollNumber: e.target.value })} /></div>
            <div><label>Section</label><input maxLength={10} value={editing.section} onChange={(e) => setEditing({ ...editing, section: e.target.value })} /></div>
          </div>
          <div className="actions">
            <button className="btn btn-primary">Save corrections</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card filters">
        <input placeholder="Search name, email, roll..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        {!isHod && (
          <select value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value, semester: '' })}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
        <select value={filter.semester} onChange={(e) => setFilter({ ...filter, semester: e.target.value })}>
          <option value="">All semesters</option>
          {semesters.filter((s) => !filter.department || s.department?._id === filter.department).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
      </div>

      {isHod && selected.length > 0 && (
        <div className="card inline-form">
          <div><label>Place {selected.length} selected student(s) in semester</label>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose semester...</option>
              {openSems.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
            </select>
          </div>
          <button className="btn btn-primary inline" disabled={!target} onClick={assign}>Assign &amp; enrol</button>
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr>{isHod && <th />}<th>Roll</th><th>Name</th><th>Dept</th><th>Semester</th><th>Sec</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                {isHod && <td><input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} /></td>}
                <td>{p.rollNumber}</td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}><Avatar user={p.user} size={36} /><div>{p.user?.name}<div className="muted small">{p.user?.email}</div></div></div></td>
                <td>{p.department?.code}</td>
                <td>{p.semester?.name || <em className="muted">Not placed</em>}</td>
                <td>{p.section}</td>
                <td><Badge value={p.status} /></td>
                <td className="actions">
                  <Link className="btn btn-small" to={`/students/${p.user?._id}/record`}>Record</Link>
                  {isHod && <button className="btn btn-small" onClick={() => startEdit(p)}>Edit</button>}
                  {p.status === 'active'
                    ? <button className="btn btn-small btn-danger" onClick={() => setStatus(p, 'suspended')}>Suspend</button>
                    : <button className="btn btn-small" onClick={() => setStatus(p, 'active')}>Activate</button>}
                  <button className="btn btn-small btn-danger" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
