import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios.js';
import { loadMe, changePassword } from '../store/authSlice.js';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, Tabs, fmtDateTime } from '../components/ui.jsx';

const ROLE_LABEL = { university_head: 'University Head', hod: 'HOD', finance_officer: 'Finance Officer', teacher: 'Teacher', student: 'Student' };

// What each role may do. The server enforces this on every request; this table only explains it.
const PERMISSIONS = [
  ['University Head', 'Everything: university settings, departments, HOD assignment, curriculum upload, reports, accounts and access.'],
  ['HOD', 'Only their own department: semesters, courses, teacher assignment, timetables, examinations, student admission, documents and complaints addressed to them.'],
  ['Finance Officer', 'Fee notices, verified payments, receipts, refunds, outstanding balances and financial reports.'],
  ['Teacher', 'Only the courses and classes assigned to them: topics, attendance, assignments, quizzes and examination marks.'],
  ['Student', 'Only their own courses, timetable, attendance, results, DMCs, fees, documents and complaints.'],
];

// Everybody: update own details, email and password.
// University Head only: manage the access of every other account (switch on/off, set a temporary password).
export default function Account() {
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const [tab, setTab] = useState('profile');
  const [msg, ok, fail, clear] = useFlash();

  return (
    <>
      <h1>My Account</h1>
      <p className="muted">{ROLE_LABEL[user.role]}{user.lastLogin ? ` · last login ${fmtDateTime(user.lastLogin)}` : ''}</p>
      <Alert msg={msg} />
      <Tabs
        tabs={[['profile', 'Profile & email'], ['password', 'Password'], ...(isHead ? [['access', 'Access control']] : [])]}
        active={tab}
        onChange={(t) => { setTab(t); clear(); }}
      />
      {tab === 'profile' && <Profile user={user} dispatch={dispatch} ok={ok} fail={fail} />}
      {tab === 'password' && <Password dispatch={dispatch} ok={ok} fail={fail} />}
      {tab === 'access' && isHead && <Access me={user} confirm={confirm} ok={ok} fail={fail} />}
    </>
  );
}

function Profile({ user, dispatch, ok, fail }) {
  const [form, setForm] = useState({ name: user.name || '', phone: user.phone || '', qualification: user.qualification || '', email: user.email || '', currentPassword: '' });
  const emailChanged = form.email.trim().toLowerCase() !== (user.email || '').toLowerCase();

  const save = async (e) => {
    e.preventDefault();
    const body = { name: form.name, phone: form.phone, qualification: form.qualification };
    if (emailChanged) { body.email = form.email; body.currentPassword = form.currentPassword; }
    try {
      await api.patch('/auth/account', body);
      ok(emailChanged ? 'Details saved. Use the new email the next time you log in.' : 'Details saved');
      setForm((f) => ({ ...f, currentPassword: '' }));
      dispatch(loadMe());
    } catch (err) { fail(err); }
  };

  return (
    <form className="card" onSubmit={save} style={{ maxWidth: 640 }}>
      <div className="form-grid">
        <div><label>Full name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        {['teacher', 'hod'].includes(user.role) && (
          <div><label>Qualification</label><input value={form.qualification} placeholder="e.g. PhD Computer Science" onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></div>
        )}
        <div><label>Email (used to log in)</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      {emailChanged && (
        <>
          <label>Current password (needed to change your email)</label>
          <input type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        </>
      )}
      <button className="btn btn-primary">Save changes</button>
    </form>
  );
}

function Password({ dispatch, ok, fail }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return fail('The new passwords do not match');
    setBusy(true);
    const res = await dispatch(changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
    setBusy(false);
    if (changePassword.fulfilled.match(res)) { ok('Password changed'); setForm({ currentPassword: '', newPassword: '', confirm: '' }); }
    else fail(res.payload);
  };

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 480 }}>
      <label>Current password</label>
      <input type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      <label>New password (at least 8 characters)</label>
      <input type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      <label>Confirm new password</label>
      <input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
    </form>
  );
}

function Access({ me, confirm, ok, fail }) {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState({ role: '', search: '' });
  const [reset, setReset] = useState(null); // { user, password }

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/users', { params }).then((r) => setUsers(r.data.data)).catch(fail);
  }, [filter, fail]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  const toggle = async (u) => {
    const stop = u.isActive;
    const yes = await confirm({
      tone: stop ? 'danger' : 'primary',
      title: `${stop ? 'Switch off' : 'Switch on'} ${u.name}?`,
      message: stop ? 'They will be logged out and cannot log in again until you switch the account on. Their records stay.' : 'They will be able to log in again.',
      confirmText: stop ? 'Switch off' : 'Switch on',
    });
    if (!yes) return;
    try { await api.patch(`/users/${u._id}/active`, { isActive: !u.isActive }); ok(`${u.name} is now ${stop ? 'switched off' : 'active'}`); load(); } catch (err) { fail(err); }
  };

  const doReset = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/users/${reset.user._id}/reset-password`, { temporaryPassword: reset.password });
      ok(`Temporary password set for ${reset.user.name}. Give it to them in person. They must choose their own at the next login.`);
      setReset(null);
    } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="card table-wrap">
        <h3>What each role can access</h3>
        <table>
          <tbody>{PERMISSIONS.map(([r, t]) => <tr key={r}><td><b>{r}</b></td><td className="small">{t}</td></tr>)}</tbody>
        </table>
        <p className="muted small">Permissions come from the role and the department. They are checked by the server on every request, not just hidden in the screens.</p>
      </div>

      {reset && (
        <form className="card" onSubmit={doReset}>
          <h3>Temporary password for {reset.user.name}</h3>
          <input required minLength={8} type="text" value={reset.password} placeholder="At least 8 characters" onChange={(e) => setReset({ ...reset, password: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary mt">Set password</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setReset(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card filters">
        <input placeholder="Search name or email..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <select value={filter.role} onChange={(e) => setFilter({ ...filter, role: e.target.value })}>
          <option value="">All roles</option>
          {Object.entries(ROLE_LABEL).filter(([k]) => k !== 'university_head').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Last login</th><th>Access</th><th /></tr></thead>
          <tbody>
            {users.filter((u) => u._id !== me._id && u.role !== 'university_head').map((u) => (
              <tr key={u._id}>
                <td>{u.name}<div className="muted small">{u.email}</div></td>
                <td>{ROLE_LABEL[u.role]}</td>
                <td>{u.department?.code || '—'}</td>
                <td className="small">{u.lastLogin ? fmtDateTime(u.lastLogin) : 'never'}</td>
                <td><Badge value={u.isActive ? 'active' : 'archived'} text={u.isActive ? 'on' : 'off'} /></td>
                <td className="actions">
                  <button className="btn btn-small" onClick={() => toggle(u)}>{u.isActive ? 'Switch off' : 'Switch on'}</button>
                  <button className="btn btn-small" onClick={() => setReset({ user: u, password: '' })}>Reset password</button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan={6} className="muted">No accounts found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
