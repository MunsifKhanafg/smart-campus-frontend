import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const LABEL = { university_head: 'University Head', hod: 'HOD', finance_officer: 'Finance Officer', teacher: 'Teacher', student: 'Student' };

export default function Users() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [depts, setDepts] = useState([]);
  const [filters, setFilters] = useState({ role: '', department: '', search: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '' });

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
      await api.post('/users', body);
      setMsg({ type: 'success', text: 'User created. They must change the password at first login.' });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '' });
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
    const yes = await confirm({
      tone: 'danger',
      title: `Delete teacher "${u.name}"?`,
      message: 'The account will be deleted permanently.\n\nThis is only allowed if the teacher has no courses or teaching records. Otherwise use Deactivate.',
      confirmText: 'Delete teacher',
    });
    if (!yes) return;
    try {
      await api.delete(`/users/${u._id}`);
      setMsg({ type: 'success', text: 'Teacher deleted' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const [edit, setEdit] = useState(null); // principal: change someone's login email / password

  const saveLogin = async (e) => {
    e.preventDefault();
    try {
      const done = [];
      if (edit.email.trim().toLowerCase() !== edit.original.toLowerCase()) {
        await api.patch(`/users/${edit.id}/email`, { email: edit.email });
        done.push('email');
      }
      if (edit.password) {
        await api.post(`/users/${edit.id}/reset-password`, { temporaryPassword: edit.password });
        done.push('password');
      }
      if (!done.length) return setMsg({ type: 'error', text: 'Nothing was changed. Type a new email or a new temporary password.' });
      setMsg({ type: 'success', text: `${edit.name}: ${done.join(' and ')} changed.${done.includes('password') ? ' They must choose their own password at the next login.' : ''}` });
      setEdit(null);
      load();
    } catch (err) {
      setMsg({ type: 'error', text: errorMessage(err) });
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
        <form className="card login-edit" onSubmit={saveLogin}>
          <h3 style={{ marginTop: 0 }}>Login details: {edit.name}</h3>
          <div className="form-grid">
            <div><label>Email (used to sign in)</label><input required type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div><label>New temporary password (leave empty to keep the current one)</label><input type="text" minLength={8} placeholder="at least 8 characters" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></div>
          </div>
          <p className="muted small">Share the new details with the person. After a password reset they must choose their own password when they sign in.</p>
          <div className="actions">
            <button className="btn btn-primary">Save login details</button>
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
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{LABEL[u.role]}</td>
                <td>{u.department?.code || '—'}</td>
                <td><span className={`badge ${u.isActive ? 'active' : 'archived'}`}>{u.isActive ? 'active' : 'inactive'}</span></td>
                <td className="actions">
                  {isHead && u.role !== 'university_head' && (
                    <button className="btn btn-small" onClick={() => { setEdit({ id: u._id, name: u.name, original: u.email, email: u.email, password: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Login details</button>
                  )}
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
