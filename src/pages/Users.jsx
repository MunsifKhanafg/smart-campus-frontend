import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';

const LABEL = { university_head: 'University Head', hod: 'HOD', finance_officer: 'Finance Officer', library_controller: 'Library Controller', teacher: 'Teacher', student: 'Student' };
// These two belong to the whole college (no department). Only the principal adds them.
const COLLEGE_ROLES = ['finance_officer', 'library_controller'];

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
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '', qualification: '', maxWeeklyHours: '', subjects: '', allDepartments: false });

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
      if (!body.department || !isHead || COLLEGE_ROLES.includes(body.role)) delete body.department;
      if (!body.phone) delete body.phone;
      if (!body.qualification) delete body.qualification;
      // Subjects the teacher can teach (comma separated). "Teaches in every department" is for common subjects (English, Mathematics...)
      // and only the principal can set it: such a teacher needs no home department.
      if (body.role === 'teacher') {
        body.subjects = String(body.subjects || '').split(',').map((x) => x.trim()).filter(Boolean);
        if (!(isHead && body.allDepartments)) delete body.allDepartments;
      } else {
        delete body.subjects;
        delete body.allDepartments;
      }
      // Weekly teaching hours limit for a teacher. Empty = no limit.
      if (body.role === 'teacher' && body.maxWeeklyHours !== '') body.maxWeeklyHours = Number(body.maxWeeklyHours); else delete body.maxWeeklyHours;
      await api.post('/users', body);
      setMsg({ type: 'success', text: 'User created. They must change the password at first login.' });
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'teacher', department: '', phone: '', qualification: '', maxWeeklyHours: '', subjects: '', allDepartments: false });
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
    const subjects = (u.subjects || []).join(', ');
    const extra = (u.extraDepartments || []).map((d) => d._id || d);
    setEdit({
      id: u._id, role: u.role, home: u.department?._id || '', name: u.name, email: u.email, phone: u.phone || '', qualification: u.qualification || '', password: '',
      maxWeeklyHours: u.maxWeeklyHours ? String(u.maxWeeklyHours) : '', subjects, extraDepartments: extra, allDepartments: !!u.allDepartments,
      original: { name: u.name, email: u.email, phone: u.phone || '', qualification: u.qualification || '', maxWeeklyHours: u.maxWeeklyHours ? String(u.maxWeeklyHours) : '', subjects, extraDepartments: extra, allDepartments: !!u.allDepartments },
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
        // Teaching workload: the weekly hours limit (empty = no limit), the subjects the person can teach, and the other departments they teach in.
        if (edit.maxWeeklyHours !== edit.original.maxWeeklyHours) body.maxWeeklyHours = edit.maxWeeklyHours === '' ? null : Number(edit.maxWeeklyHours);
        if (edit.subjects.trim() !== edit.original.subjects.trim()) body.subjects = edit.subjects.split(',').map((x) => x.trim()).filter(Boolean);
        if ([...edit.extraDepartments].sort().join() !== [...edit.original.extraDepartments].sort().join()) body.extraDepartments = edit.extraDepartments;
        if (isHead && edit.role === 'teacher' && edit.allDepartments !== edit.original.allDepartments) body.allDepartments = edit.allDepartments;
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
  const roleOptions = isHead ? ['teacher', 'finance_officer', 'library_controller'] : ['teacher'];

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
            {form.role === 'teacher' && (
              <div><label>Weekly teaching hours limit (optional)</label><input type="number" min={1} max={60} placeholder="empty = no limit" value={form.maxWeeklyHours} onChange={(e) => setForm({ ...form, maxWeeklyHours: e.target.value })} /></div>
            )}
            {form.role === 'teacher' && (
              <div><label>Subjects this teacher can teach (comma separated)</label><input placeholder="English, Mathematics" value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} /></div>
            )}
            <div>
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roleOptions.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}
              </select>
            </div>
            {isHead && !COLLEGE_ROLES.includes(form.role) && (
              <div>
                <label>{form.allDepartments ? 'Home department (optional)' : 'Department'}</label>
                <select required={!form.allDepartments} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  <option value="">{form.allDepartments ? 'None (belongs to the whole college)' : 'Select...'}</option>
                  {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {isHead && form.role === 'teacher' && (
            <label className="check mt">
              <input type="checkbox" checked={form.allDepartments} onChange={(e) => setForm({ ...form, allDepartments: e.target.checked })} />
              Teaches in every department (common subjects such as English, Mathematics, Islamiat, Pakistan Studies). No home department is needed.
            </label>
          )}
          {isHead && form.role === 'library_controller' && (
            <p className="muted small" style={{ marginBottom: 0 }}>A library controller runs the library (books, issue and return, fines, reservations, reports) and marks their own attendance. They belong to no department. Only people with this role can manage the library; you monitor everything from Library Monitoring.</p>
          )}
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

          {['teacher', 'hod'].includes(edit.role) && (
            <>
              <h4>Teaching workload</h4>
              <div className="form-grid">
                <div>
                  <label>Weekly teaching hours (limit)</label>
                  <input type="number" min={1} max={60} placeholder="empty = no limit" value={edit.maxWeeklyHours} onChange={(e) => setEdit({ ...edit, maxWeeklyHours: e.target.value })} />
                </div>
                <div>
                  <label>Subjects this person can teach (comma separated)</label>
                  <input placeholder="English, Mathematics" value={edit.subjects} onChange={(e) => setEdit({ ...edit, subjects: e.target.value })} />
                </div>
              </div>
              <p className="muted small" style={{ marginTop: 0 }}>
                There is no fixed limit. Set the weekly hours that match the real workload, for example 8, 12 or 20 classes a week, or leave it empty for no limit.
                When the HOD assigns a subject, the server refuses it only if it would take the teacher over this number.
              </p>
              {isHead && edit.role === 'teacher' && (
                <label className="check mt">
                  <input type="checkbox" checked={edit.allDepartments} onChange={(e) => setEdit({ ...edit, allDepartments: e.target.checked })} />
                  Teaches in every department (common subjects: English, Mathematics, Islamiat, Pakistan Studies...)
                </label>
              )}
              {!edit.allDepartments && depts.filter((d) => d._id !== edit.home).length > 0 && (
                <>
                  <label>Also teaches in (common subjects such as English or Islamiat)</label>
                  <div className="actions" style={{ flexWrap: 'wrap' }}>
                    {depts.filter((d) => d._id !== edit.home).map((d) => (
                      <label key={d._id} className="check" style={{ marginRight: '1rem' }}>
                        <input type="checkbox" checked={edit.extraDepartments.includes(d._id)}
                          onChange={(e) => setEdit({ ...edit, extraDepartments: e.target.checked ? [...edit.extraDepartments, d._id] : edit.extraDepartments.filter((x) => x !== d._id) })} />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

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
                <td>{u.name}{u.qualification && <div className="muted small">{u.qualification}</div>}{['teacher', 'hod'].includes(u.role) && <div className="muted small">{u.maxWeeklyHours ? `Limit: ${u.maxWeeklyHours} hours/week` : 'No weekly limit'}</div>}{(u.subjects || []).length > 0 && <div className="muted small">Teaches: {u.subjects.join(', ')}</div>}</td>
                <td>{u.email}{u.phone && <div className="muted small">{u.phone}</div>}</td>
                <td>{LABEL[u.role]}</td>
                <td>{u.allDepartments ? <span className="badge upcoming">All departments</span> : (u.department?.code || '—')}{u.allDepartments && u.department && <div className="muted small">home: {u.department.code}</div>}</td>
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
