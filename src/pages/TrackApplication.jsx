import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';
import { fmtDateTime } from '../components/ui.jsx';

const LABEL = {
  submitted: 'Received',
  under_review: 'Under review',
  needs_info: 'More information needed',
  accepted: 'Accepted',
  rejected: 'Not selected',
};

// Public. The applicant proves it is their application with the number AND the email they applied with.
export default function TrackApplication() {
  const [form, setForm] = useState({ applicationNumber: '', email: '' });
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [extra, setExtra] = useState({}); // document name -> File
  const [ok, setOk] = useState('');

  const look = async (e) => {
    e?.preventDefault();
    setError(''); setOk(''); setBusy(true);
    try {
      const { data } = await api.post('/public/admissions/track', { applicationNumber: form.applicationNumber.trim(), email: form.email.trim() });
      setApp(data.data);
    } catch (err) { setApp(null); setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const sendDocs = async (e) => {
    e.preventDefault();
    const entries = Object.entries(extra).filter(([, f]) => f);
    if (!entries.length) return setError('Choose at least one file');
    const fd = new FormData();
    fd.append('applicationNumber', form.applicationNumber.trim());
    fd.append('email', form.email.trim());
    entries.forEach(([label, file]) => { fd.append('files', file); fd.append('labels', label); });
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/public/admissions/resubmit', fd);
      setApp(data.data);
      setExtra({});
      setOk('Documents received. Your application is back under review.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <AdmissionShell title="Track my application" subtitle="Enter the application number you received and the email you applied with.">
      <form className="adm-card" onSubmit={look}>
        <div className="adm-grid">
          <div><label>Application number</label><input required placeholder="APP-2026-00001" value={form.applicationNumber} onChange={(e) => setForm({ ...form, applicationNumber: e.target.value })} /></div>
          <div><label>Email</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="adm-actions"><button className="adm-btn" disabled={busy}>{busy ? 'Looking…' : 'Check status'}</button></div>
      </form>

      {error && <div className="adm-alert error">{error}</div>}
      {ok && <div className="adm-alert ok">{ok}</div>}

      {app && (
        <>
          <div className="adm-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ marginBottom: '.2rem' }}>{app.name}</h3>
                <div className="muted small">{app.applicationNumber} · {app.department}{app.program ? ` · ${app.program}` : ''}{app.intake ? ` · ${app.intake}` : ''}</div>
              </div>
              <span className={`adm-status ${app.status}`}>{LABEL[app.status]}</span>
            </div>
            {app.remarks && !(app.merit?.called && app.merit.interview?.message?.startsWith(app.remarks)) && <div className={`adm-alert ${app.status === 'rejected' ? 'error' : 'warn'}`} style={{ marginTop: '1rem' }}><b>Message from the admissions office:</b><br />{app.remarks}</div>}
            {app.status === 'accepted' && (
              <div className="adm-alert ok" style={{ marginTop: '1rem' }}>
                Congratulations! {app.enrolled ? 'Your student account has been created. Sign in with your email and the first password the department gave you.' : 'The department will contact you about your student account.'}
              </div>
            )}
            {app.merit && (
              <div className={`adm-alert ${app.merit.called ? 'ok' : 'warn'}`} style={{ marginTop: '1rem' }}>
                <b>Merit list:</b> you are number {app.merit.rank} with a merit score of {app.meritScore}.
                {app.merit.called
                  ? <div style={{ whiteSpace: 'pre-line', marginTop: '.5rem' }}><b>You are called for an interview.</b>{'\n'}{app.merit.interview?.message}</div>
                  : <div className="small" style={{ marginTop: '.3rem' }}>You were not called for an interview in this round. <Link to="/merit-list">See the merit list</Link>.</div>}
              </div>
            )}
            {!app.merit && <p className="small muted">The merit list is published after applications close. Your rank and merit score appear here when it is published.</p>}
            <p className="small muted">Documents received: {app.documents.join(', ') || 'none'}</p>
            {app.missingDocuments.length > 0 && <p className="small" style={{ color: '#92400e' }}>Still missing: {app.missingDocuments.join(', ')}</p>}
          </div>

          {app.canAddDocuments && (
            <form className="adm-card" onSubmit={sendDocs}>
              <h3>Send the requested documents</h3>
              <p className="small muted">Upload the documents the office asked for. A file with the same name replaces the older one.</p>
              <div className="adm-grid">
                {[...new Set([...app.missingDocuments, ...app.documents])].map((label) => (
                  <div key={label}>
                    <label>{label}{app.missingDocuments.includes(label) ? ' (missing)' : ' (replace)'}</label>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setExtra((x) => ({ ...x, [label]: e.target.files[0] }))} />
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
                  <b>{LABEL[h.status]}</b> <span className="muted small">· {h.by} · {fmtDateTime(h.at)}</span>
                  {h.note && <div className="small">{h.note}</div>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <p className="small muted">Lost your number? Contact the admissions office. <Link to="/contact">Contact details</Link></p>
    </AdmissionShell>
  );
}
