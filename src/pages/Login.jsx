import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/authSlice.js';
import LogoPlate from '../components/LogoPlate.jsx';
import './login.css';

const FEATURES = [
  ['📅', 'Timetable & calendar', 'Always know where to be and when'],
  ['📝', 'Assignments & results', 'Submit work, track marks and DMCs'],
  ['💳', 'Fees & receipts', 'Pay online and download receipts'],
  ['🤖', 'AI study assistant', 'Ask questions about your course material'],
];

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loginLoading, error } = useSelector((s) => s.auth);
  const settings = useSelector((s) => s.settings);
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    const res = await dispatch(login(form));
    if (login.fulfilled.match(res)) navigate('/dashboard');
  };

  return (
    <div className="ln">
      <aside className="ln-side">
        <span className="ln-orb o1" /><span className="ln-orb o2" /><span className="ln-orb o3" />
        <Link to="/" className="ln-back">← Back to home</Link>

        <div className="ln-hero">
          <div className="ln-logo"><LogoPlate size={124} /></div>
          <h1>{settings.universityName}</h1>
          <p className="ln-campus">{settings.campusName}{settings.currentAcademicYear ? ` · Academic year ${settings.currentAcademicYear}` : ''}</p>
          <p className="ln-tag">One connected place for students, teachers, departments and the university office.</p>
        </div>

        <div className="ln-features">
          {FEATURES.map(([ico, title, text]) => (
            <div key={title} className="ln-feature">
              <span>{ico}</span>
              <div><b>{title}</b><small>{text}</small></div>
            </div>
          ))}
        </div>
      </aside>

      <main className="ln-main">
        <form className="ln-card" onSubmit={submit}>
          <div className="ln-mobile-brand">
            <div className="ln-logo small"><LogoPlate size={72} /></div>
            <b>{settings.universityName}</b>
          </div>

          <h2>Welcome back 👋</h2>
          <p className="ln-sub">Sign in with the email your department registered for you.</p>
          {error && <div className="alert alert-error">{error}</div>}

          <label>Email address</label>
          <div className="ln-input">
            <span>✉️</span>
            <input
              type="email"
              required
              placeholder="you@university.edu"
              autoComplete="username"
              value={form.email}
              onChange={(e) => { dispatch(clearError()); setForm({ ...form, email: e.target.value }); }}
            />
          </div>

          <label>Password</label>
          <div className="ln-input">
            <span>🔒</span>
            <input
              type={show ? 'text' : 'password'}
              required
              placeholder="Your password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="ln-eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
          </div>

          <button className="ln-submit" disabled={loginLoading}>
            {loginLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="ln-links">
            {settings.admissionPortal?.externalUrl
              ? <a href={settings.admissionPortal.externalUrl} target="_blank" rel="noreferrer">Apply for admission</a>
              : <Link to="/apply">Apply for admission</Link>}
            <span>•</span>
            <Link to="/check-result">Check result</Link>
            <span>•</span>
            <Link to="/contact">Contact us</Link>
          </div>
        </form>
        <small className="ln-foot">© {new Date().getFullYear()} {settings.universityName}</small>
      </main>
    </div>
  );
}
