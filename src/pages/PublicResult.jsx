import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import Brand from '../components/Brand.jsx';
import { useFlash, Alert, Badge, Tabs, fmtDate } from '../components/ui.jsx';

// Public page (no login). A roll number alone is never enough: the date of birth must match too.
// The server limits how many tries one address may make.
export default function PublicResult() {
  const user = useSelector((s) => s.auth.user);
  const [tab, setTab] = useState('result');
  const [msg, , fail, clear] = useFlash();
  const [form, setForm] = useState({ rollNumber: '', dateOfBirth: '' });
  const [dmc, setDmc] = useState({ dmcNumber: '', verificationCode: '' });
  const [result, setResult] = useState(null);
  const [verified, setVerified] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async (e) => {
    e.preventDefault();
    clear(); setResult(null); setBusy(true);
    try { setResult((await api.post('/public/results', form)).data.data); } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    clear(); setVerified(null); setBusy(true);
    try { setVerified((await api.post('/public/dmc/verify', dmc)).data.data); } catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <div className="public-page">
      <header className="row-between">
        <Brand showCampus />
        <Link className="btn btn-ghost" to={user ? '/dashboard' : '/login'}>{user ? 'Dashboard' : 'Login'}</Link>
      </header>
      <h1>Check result</h1>
      <Tabs tabs={[['result', 'Check my result'], ['dmc', 'Verify a DMC']]} active={tab} onChange={(t) => { setTab(t); clear(); }} />
      <Alert msg={msg} />

      {tab === 'result' && (
        <>
          <form className="card" onSubmit={check} style={{ maxWidth: 460 }}>
            <label>Roll number</label>
            <input required value={form.rollNumber} onChange={(e) => setForm({ ...form, rollNumber: e.target.value })} />
            <label>Date of birth</label>
            <input type="date" required value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            <button className="btn btn-primary" disabled={busy}>Show result</button>
            <p className="muted small">For your privacy both details must match. After several wrong tries you will have to wait before trying again. Logged-in students can see everything under My Results.</p>
          </form>
          {result && (
            <>
              <h3>{result.studentName} <span className="muted small">({result.rollNumber})</span></h3>
              {result.results.map((r, i) => (
                <div className="card table-wrap" key={i}>
                  <h4 style={{ marginTop: 0 }}>{r.examination} <span className="muted small">{r.semester}</span></h4>
                  <table>
                    <thead><tr><th>Code</th><th>Subject</th><th>Max</th><th>Obtained</th></tr></thead>
                    <tbody>
                      {r.subjects.map((s) => <tr key={s.code}><td>{s.code}</td><td>{s.title}</td><td>{s.maxMarks}</td><td>{s.obtained}</td></tr>)}
                      <tr><td colSpan={2}><strong>Total</strong></td><td><strong>{r.totalMax}</strong></td><td><strong>{r.totalObtained}</strong></td></tr>
                    </tbody>
                  </table>
                  <p>{r.percentage}% · Grade {r.grade} · <Badge value={r.outcome} /></p>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {tab === 'dmc' && (
        <>
          <form className="card" onSubmit={verify} style={{ maxWidth: 460 }}>
            <p className="muted">Enter the DMC number and the verification code printed on the certificate.</p>
            <label>DMC number</label>
            <input required placeholder="DMC-2026-000001" value={dmc.dmcNumber} onChange={(e) => setDmc({ ...dmc, dmcNumber: e.target.value })} />
            <label>Verification code</label>
            <input required value={dmc.verificationCode} onChange={(e) => setDmc({ ...dmc, verificationCode: e.target.value })} />
            <button className="btn btn-primary" disabled={busy}>Verify</button>
          </form>
          {verified && (
            <div className="alert alert-success">
              Genuine certificate: {verified.studentName} · {verified.examination} · {verified.percentage}% · Grade {verified.grade} · {verified.outcome} · issued {fmtDate(verified.issuedAt)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
