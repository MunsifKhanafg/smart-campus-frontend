import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const LABEL = { university_head: 'University Head', hod: 'HOD', finance_officer: 'Finance Officer', teacher: 'Teacher', student: 'Student' };

// A readable temporary password with no look-alike characters (no 0/O, 1/l/I).
const makePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

export default function Users() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [filters, setFilters] = useState({ role: '', department: '', search: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '', qualification: '' });

  const load = useCallback(async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await api.get('/users', { params });
      setUsers(data.data);
    } catch (e) {
      setMsg({ type: 'error', text: errorMessage(e) });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/departments').then((r) => setDepts(r.data.data.filter((d) => d.status === 'active'))).catch(() => {});
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form };
      if (!body.department || !isHead || body.role === 'finance_officer') delete body.department;
      if (!body.phone) delete body.phone;
      if (!body.qualification) delete body.qualification;
      await api.post('/users', body);
      setMsg({ type: 'success', text: 'User created. They must change the password at first login.' });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '', qualification: '' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const toggle = async (u) => {
    try {
      await api.patch(`/users/${u._id}/active`, { isActive: !u.isActive });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
    }
  };

  const remove = async (u) => {
    // First read what the teacher is connected to, so the confirmation window can list it (and the server accepts the delete).
    let info = { hasRecords: false, items: [] };
    try { info = (await api.get(`/users/${u._id}/delete-preview`)).data.data; } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
      return;
    }
    const yes = await confirm({
      tone: 'danger',
      title: `Delete teacher "${u.name}"?`,
      message: 'The account will be deleted permanently.\n\nTheir subjects stay on the timetable and show "No teacher assigned" until you choose a new teacher, and you get a notification listing them. Use Deactivate instead if you only want to stop them signing in.',
      details: info.items.map((i) => `${i.count} ${i.label}`),
      confirmText: 'Delete teacher',
    });
    if (!yes) return;
    try {
      const { data } = await api.delete(`/users/${u._id}`, { params: info.hasRecords ? { force: 'true' } : {} });
      setMsg({ type: 'success', text: data.message || 'Teacher deleted' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ---------- Edit a person: name, email, phone, qualification, and a new temporary password for a forgotten one ----------
  // The principal can edit any staff member. An HOD can edit the teachers of their own department. The server checks both.
  const [edit, setEdit] = useState(null);
  const canEdit = (u) => u.role !== 'university_head' && (isHead || u.role === 'teacher');

  const openEdit = (u) => {
    setEdit({
      id: u._id, role: u.role, name: u.name, email: u.email, phone: u.phone || '', qualification: u.qualification || '', password: '',
      original: { name: u.name, email: u.email, phone: u.phone || '', qualification: u.qualification || '' },
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const done = [];
    try {
      if (edit.role === 'student') {
        // Students are corrected on the Students page. The principal can still fix a login email here.
        if (edit.email.trim().toLowerCase() !== edit.original.email.toLowerCase()) {
          await api.patch(`/users/${edit.id}/email`, { email: edit.email.trim() });
          done.push('email');
        }
      } else {
        const body = {};
        if (edit.name.trim() !== edit.original.name) body.name = edit.name.trim();
        if (edit.email.trim().toLowerCase() !== edit.original.email.toLowerCase()) body.email = edit.email.trim();
        if (edit.phone.trim() !== edit.original.phone) body.phone = edit.phone.trim();
        if (edit.qualification.trim() !== edit.original.qualification) body.qualification = edit.qualification.trim();
        if (Object.keys(body).length) {
          await api.put(`/users/${edit.id}`, body);
          done.push(...Object.keys(body));
        }
      }
      if (edit.password) {
        await api.post(`/users/${edit.id}/reset-password`, { temporaryPassword: edit.password });
        done.push('password');
      }
      if (!done.length) return setMsg({ type: 'error', text: 'Nothing was changed.' });

      const hint = [];
      if (done.includes('email')) hint.push('They must sign in with the new email.');
      if (done.includes('password')) hint.push(`Give them the temporary password (${edit.password}). They must choose their own at the next login.`);
      setMsg({ type: 'success', text: `${edit.original.name}: ${done.join(', ')} changed. ${hint.join(' ')}` });
      setEdit(null);
      load();
    } catch (err) {
      // If the details were saved but the password was not, the list still needs to show the new details.
      if (done.length) load();
      setMsg({ type: 'error', text: `${done.length ? `Saved: ${done.join(', ')}. ` : ''}${errorMessage(err)}` });
    }
  };

  // Students are added on the Students page, because they need an academic profile too.
  const roleOptions = isHead ? ['teacher', 'finance_officer'] : ['teacher'];

  return (
    <>
      <div className="row-between">
        <h1>{isHead ? 'Users' : 'Teachers & Students'}</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Add user</button>
      </div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {showForm && (
        <form className="card" onSubmit={create}>
          <h3>New user</h3>
          <div className="form-grid">
            <div><label>Full name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label>Email</label><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label>Temporary password (min 8)</label><input required minLength={8} type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label>Qualification (e.g. MS Computer Science)</label><input maxLength={200} value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></div>
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roleOptions.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
              </select>
            </div>
            {isHead && form.role !== 'finance_officer' && (
              <div>
                <label>Department</label>
                <select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select...</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="actions">
            <button className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {edit && (
        <form className="card login-edit" onSubmit={saveEdit}>
          <h3 style={{ marginTop: 0 }}>Edit {LABEL[edit.role]}: {edit.original.name}</h3>
          <div className="form-grid">
            {edit.role !== 'student' && <div><label>Full name</label><input required minLength={2} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>}
            <div><label>Email (used to sign in)</label><input required type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            {edit.role !== 'student' && <div><label>Phone</label><input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>}
            {edit.role !== 'student' && <div><label>Qualification</label><input maxLength={200} value={edit.qualification} onChange={(e) => setEdit({ ...edit, qualification: e.target.value })} /></div>}
          </div>

          <h4>Forgot the password?</h4>
          <p className="muted small" style={{ marginTop: 0 }}>
            Nobody can read a password, but you can set a new temporary one. Type one (at least 8 characters) or press Generate, then tell it to the person.
            When they sign in they must choose their own password. Leave this empty to keep the current password.
          </p>
          <div className="inline-form">
            <div><input type="text" minLength={8} placeholder="new temporary password" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
            <button type="button" className="btn" onClick={() => setEdit({ ...edit, password: makePassword() })}>Generate</button>
          </div>

          <div className="actions">
            <button className="btn btn-primary">Save changes</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card filters">
        <input placeholder="Search name or email..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
          <option value="">All roles</option>
          {Object.entries(LABEL).filter(([k]) => k !== 'university_head').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {isHead && (
          <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}{u.qualification && <div className="muted small">{u.qualification}</div>}</td>
                <td>{u.email}{u.phone && <div className="muted small">{u.phone}</div>}</td>
                <td>{LABEL[u.role]}</td>
                <td>{u.department?.code || '—'}</td>
                <td><span className={`badge ${u.isActive ? 'active' : 'archived'}`}>{u.isActive ? 'active' : 'inactive'}</span></td>
                <td className="actions">
                  {canEdit(u) && <button className="btn btn-small" onClick={() => openEdit(u)}>Edit / reset password</button>}
                  {u.role !== 'university_head' && u._id !== user._id && !(u.role === 'hod' && !isHead) && (
                    <button className="btn btn-small" onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                  )}
                  {u.role === 'teacher' && (
                    <button className="btn btn-small btn-danger" onClick={() => remove(u)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={6} className="muted">No users found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
