import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { changePassword } from '../store/authSlice.js';
import Brand from '../components/Brand.jsx';

export default function ChangePassword() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) return setError('New passwords do not match');
    setBusy(true);
    const res = await dispatch(changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
    setBusy(false);
    if (changePassword.fulfilled.match(res)) navigate('/dashboard');
    else setError(res.payload);
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Brand size={48} />
        <h2>Change password</h2>
        {user?.mustChangePassword && (
          <div className="alert alert-info">Your account was created by an administrator. Please set your own password to continue.</div>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <label>Current password</label>
        <input type="password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <label>New password (min 8 characters)</label>
        <input type="password" required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        <label>Confirm new password</label>
        <input type="password" required value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
      </form>
    </div>
  );
}
