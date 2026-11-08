import { useState } from 'react';
import api, { errorMessage } from '../api/axios.js';

// A readable temporary password with no look-alike characters (no 0/O, 1/l/I).
const makePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

// Edit one teacher from the teacher's own page: correct the name, email, phone or qualification, and set a new temporary
// password when the teacher has forgotten theirs (nobody can read a password, so it is replaced, never shown).
// The University Head can edit any teacher or HOD; an HOD can edit the teachers of their own department.
// The server checks this again on every request, so this panel is only the convenient way in.
// teacher: the user being edited. onSaved(user): called with the saved details so the page can show them straight away.
export default function TeacherEditPanel({ teacher, onSaved }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '', password: '' });
  const [busy, setBusy] = useState(false);

  const start = () => {
    setF({ name: teacher.name, email: teacher.email, phone: teacher.phone || '', qualification: teacher.qualification || '', password: '' });
    setMsg({ type: '', text: '', password: '' });
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const done = [];
    let updated = null;
    try {
      const body = {};
      if (f.name.trim() !== teacher.name) body.name = f.name.trim();
      if (f.email.trim().toLowerCase() !== teacher.email.toLowerCase()) body.email = f.email.trim();
      if (f.phone.trim() !== (teacher.phone || '')) body.phone = f.phone.trim();
      if (f.qualification.trim() !== (teacher.qualification || '')) body.qualification = f.qualification.trim();
      if (Object.keys(body).length) {
        const { data } = await api.put(`/users/${teacher._id}`, body);
        updated = data.data;
        done.push(...Object.keys(body));
      }
      if (f.password) {
        await api.post(`/users/${teacher._id}/reset-password`, { temporaryPassword: f.password });
        done.push('password');
      }
      if (!done.length) {
        setMsg({ type: 'error', text: 'Nothing was changed.', password: '' });
        return;
      }
      const notes = [];
      if (done.includes('email')) notes.push('They must sign in with the new email.');
      if (done.includes('password')) notes.push('Give them the temporary password below. They must choose their own at the next login.');
      setMsg({ type: 'success', text: `Saved: ${done.join(', ')}. ${notes.join(' ')}`, password: done.includes('password') ? f.password : '' });
      if (updated) onSaved(updated);
      setOpen(false);
    } catch (err) {
      // The details may have been saved even though the password step failed: keep the page in step with the server.
      if (updated) onSaved(updated);
      setMsg({ type: 'error', text: `${done.length ? `Saved: ${done.join(', ')}. ` : ''}${errorMessage(err)}`, password: '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>Account details</h3>
          <p className="muted small" style={{ margin: '.2rem 0 0' }}>Fix a name or email, or set a new password if {teacher.name.split(' ')[0]} forgot it.</p>
        </div>
        {!open && <button className="btn btn-primary inline" onClick={start}>✏️ Edit details / reset password</button>}
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {msg.password && (
        <div className="sub-card">
          Temporary password: <b style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{msg.password}</b>{' '}
          <button type="button" className="btn btn-small" onClick={() => navigator.clipboard?.writeText(msg.password)}>Copy</button>
          <div className="muted small">This is shown only now. It is not stored in a readable form anywhere.</div>
        </div>
      )}

      {open && (
        <form onSubmit={save}>
          <div className="form-grid">
            <div><label>Full name</label><input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><label>Email (used to sign in)</label><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><label>Phone</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div><label>Qualification</label><input maxLength={200} value={f.qualification} onChange={(e) => setF({ ...f, qualification: e.target.value })} /></div>
          </div>

          <h4>Forgot the password?</h4>
          <p className="muted small" style={{ marginTop: 0 }}>
            Type a new temporary password (at least 8 characters) or press Generate. Leave it empty to keep the current password.
            Any open sessions of this teacher are signed out, and they must choose their own password at the next login.
          </p>
          <div className="inline-form">
            <div><input type="text" minLength={8} placeholder="new temporary password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
            <button type="button" className="btn" onClick={() => setF({ ...f, password: makePassword() })}>Generate</button>
          </div>

          <div className="actions">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
