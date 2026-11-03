import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice.js';
import Brand from '../components/Brand.jsx';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loginLoading, error } = useSelector((s) => s.auth);
  const settings = useSelector((s) => s.settings);
  const [form, setForm] = useState({ email: '', password: '' });

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login(form));
    if (login.fulfilled.match(res)) navigate('/dashboard');
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <Brand size={56} showCampus />
        <h2>Sign in</h2>
        {settings.currentAcademicYear && <p className="muted">Academic Year {settings.currentAcademicYear}</p>}
        {error && <div className="alert alert-error">{error}</div>}
        <label>Email</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => { dispatch(clearError()); setForm({ ...form, email: e.target.value }); }}
        />
        <label>Password</label>
        <input
          type="password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button className="btn btn-primary" disabled={loginLoading}>
          {loginLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
