import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';
import { fmtDate, fmtDateTime, label } from '../components/ui.jsx';

const STATUS_TEXT = {
  submitted: 'Received',
  under_review: 'Under review',
  needs_info: 'More information needed',
  accepted: 'Accepted',
  rejected: 'Not selected',
};

const STATUS_HELP = {
  submitted: 'Your application has been received and is waiting for the department.',
  under_review: 'The department is reviewing your application.',
  needs_info: 'The department needs something from you. Read the message below and contact the university office.',
  accepted: 'Congratulations! Your application was accepted. The department will contact you about the next steps.',
  rejected: 'Your application was not selected. The reason is given below.',
};

// Public page. The applicant needs BOTH the application number and the email used on the form.
export default function TrackApplication() {
  const [form, setForm] = useState({ applicationNumber: '', email: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const { data } = await api.post('/public/admissions/track', form);
      setResult(data.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdmissionShell title="Track your application" subtitle="Enter the application number you received and the email address you used on the form.">
      <form className="adm-card" onSubmit={submit}>
        <div className="adm-grid">
          <div><label>Application number</label><input required placeholder="APP-2026-00017" value={form.applicationNumber} onChange={(e) => setForm({ ...form, applicationNumber: e.target.value })} /></div>
          <div><label>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="adm-actions"><button className="adm-btn" disabled={busy}>{busy ? 'Checking…' : 'Check status'}</button></div>
      </form>

      {error && <div className="adm-alert error">{error}</div>}

      {result && (
        <div className="adm-card">
          <h3>{result.applicantName} <span className="muted small">· {result.applicationNumber}</span></h3>
          <p>
            <span className={`adm-status ${result.status}`}>{STATUS_TEXT[result.status] || label(result.status)}</span>
          </p>
          <p>{STATUS_HELP[result.status]}</p>
          {result.remarks && <div className={`adm-alert ${result.status === 'accepted' ? 'ok' : 'warn'}`}><b>Message from the university:</b> {result.remarks}</div>}
          <p className="muted small">
            {result.department}{result.programName ? ` · ${result.programName}` : ''}{result.intake ? ` · ${result.intake}` : ''} · Submitted {fmtDate(result.submittedAt)} · Your percentage {result.percentage}%
          </p>
          {result.meritRank && (
            <div className="adm-alert info">Your merit position: <b>{result.meritRank}</b> of {result.meritTotal}{result.programName ? ` in ${result.programName}` : ''}. <Link to="/merit-list">See the merit list</Link></div>
          )}
          <h3 style={{ marginTop: '1rem' }}>History</h3>
          <ul className="adm-timeline">
            {result.history.map((h, i) => (
              <li key={i}><b>{STATUS_TEXT[h.status] || label(h.status)}</b> <span className="muted small">{fmtDateTime(h.at)}</span>{h.remarks && <div className="small">{h.remarks}</div>}</li>
            ))}
          </ul>
        </div>
      )}
    </AdmissionShell>
  );
}
