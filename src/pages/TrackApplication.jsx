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
  needs_info: 'The department needs something from you. Read the message below and upload the documents.',
  accepted: 'Congratulations! Your application was accepted. The department will contact you about the next steps.',
  rejected: 'Your application was not selected. The reason is given below.',
};

// Public. The applicant needs BOTH the application number and the email used on the form.
export default function TrackApplication() {
  const [form, setForm] = useState({ applicationNumber: '', email: '' });
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState({}); // document name -> File

  const look = async (e) => {
    e?.preventDefault();
    setError(''); setOk(''); setApp(null); setBusy(true);
    try {
      const { data } = await api.post('/public/admissions/track', { applicationNumber: form.applicationNumber.trim(), email: form.email.trim() });
      setApp(data.data);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const sendDocs = async (e) => {
    e.preventDefault();
    const entries = Object.entries(extra).filter(([, f]) => f);
    if (!entries.length) return setError('Choose at least one file');
    const fd = new FormData();
    fd.append('applicationNumber', form.applicationNumber.trim());
    fd.append('email', form.email.trim());
    entries.forEach(([name, file]) => { fd.append('files', file); fd.append('labels', name); });
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/public/admissions/resubmit', fd);
      setApp(data.data);
      setExtra({});
      setOk('Documents received. Your application is back under review.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <AdmissionShell title="Track your application" subtitle="Enter the application number you received and the email address you used on the form.">
      <form className="adm-card" onSubmit={look}>
        <div className="adm-grid">
          <div><label>Application number</label><input required placeholder="APP-2026-00017" value={form.applicationNumber} onChange={(e) => setForm({ ...form, applicationNumber: e.target.value })} /></div>
          <div><label>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="adm-actions"><button className="adm-btn" disabled={busy}>{busy ? 'Checking…' : 'Check status'}</button></div>
      </form>

      {error && <div className="adm-alert error">{error}</div>}
      {ok && <div className="adm-alert ok">{ok}</div>}

      {app && (
        <>
          <div className="adm-card">
            <h3>{app.name} <span className="muted small">· {app.applicationNumber}</span></h3>
            <p><span className={`adm-status ${app.status}`}>{STATUS_TEXT[app.status] || label(app.status)}</span></p>
            <p>{STATUS_HELP[app.status]}</p>
            {app.remarks && <div className={`adm-alert ${app.status === 'accepted' ? 'ok' : 'warn'}`}><b>Message from the university:</b> {app.remarks}</div>}
            {app.status === 'accepted' && app.enrolled && <div className="adm-alert ok">Your student account has been created. Sign in with your email and the first password the department gave you.</div>}
            <p className="muted small">
              {app.department}{app.program ? ` · ${app.program}` : ''}{app.intake ? ` · ${app.intake}` : ''} · Submitted {fmtDate(app.submittedAt)}
              {app.meritScore != null && <> · Merit score <span className="adm-pct">{app.meritScore}</span></>}
            </p>

            {app.merit && (
              <div className="adm-alert info">
                Your merit position in the department: <b>#{app.merit.rank}</b>. <Link to="/merit-list">See the merit list</Link>
                {app.merit.interview && (
                  <div style={{ marginTop: '.5rem' }}>
                    <b>You are called for an interview.</b>
                    <div>Date: {fmtDate(app.merit.interview.date)}{app.merit.interview.time ? ` at ${app.merit.interview.time}` : ''}</div>
                    {app.merit.interview.venue && <div>Venue: {app.merit.interview.venue}</div>}
                    {app.merit.interview.message && <div style={{ whiteSpace: 'pre-wrap' }}>{app.merit.interview.message}</div>}
                  </div>
                )}
              </div>
            )}

            <p className="small muted">Documents received: {app.documents.join(', ') || 'none'}</p>
            {app.missingDocuments.length > 0 && <p className="small" style={{ color: '#92400e' }}>Still missing: {app.missingDocuments.join(', ')}</p>}
          </div>

          {app.canAddDocuments && (
            <form className="adm-card" onSubmit={sendDocs}>
              <h3>Send the requested documents</h3>
              <p className="small muted">A file with the same document name replaces the older one.</p>
              <div className="adm-grid">
                {[...new Set([...app.missingDocuments, ...app.documents])].map((name) => (
                  <div key={name}>
                    <label>{name}{app.missingDocuments.includes(name) ? ' (missing)' : ' (replace)'}</label>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setExtra((x) => ({ ...x, [name]: e.target.files[0] }))} />
                  </div>
                ))}
              </div>
              <div className="adm-actions"><button className="adm-btn" disabled={busy}>Send documents</button></div>
            </form>
          )}

          <div className="adm-card">
            <h3>History</h3>
            <ul className="adm-timeline">
              {[...app.history].reverse().map((h, i) => (
                <li key={i}>
                  <b>{STATUS_TEXT[h.status] || label(h.status)}</b> <span className="muted small">· {h.by} · {fmtDateTime(h.at)}</span>
                  {h.note && <div className="small">{h.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AdmissionShell>
  );
}
