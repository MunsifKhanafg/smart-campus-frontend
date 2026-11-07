import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/axios.js';
import { useConfirm } from './ConfirmModal.jsx';
import { fmtDate, fmtDateTime } from './ui.jsx';

// Settings > admissions: what will happen when the merit list is published, and the Publish / Withdraw buttons.
// It sits inside the settings <form>, so every button here is type="button".
export default function MeritControl({ refreshKey }) {
  const confirm = useConfirm();
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/applications/merit/status').then((r) => setSt(r.data.data)).catch((e) => setMsg({ type: 'error', text: errorMessage(e) }));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const publish = async () => {
    const yes = await confirm({
      title: 'Publish the merit list now?',
      message: `The merit list becomes public and ${st.calledTotal} applicant(s) are called for an interview. They see the message on their tracking page${st.emailConfigured ? ' and receive it by e-mail' : ''}. This cannot be taken back for e-mails already sent.`,
      details: st.departments.map((d) => `${d.department}: ${d.called} of ${d.applicants} called`),
      confirmText: 'Publish and notify',
    });
    if (!yes) return;
    setBusy(true);
    try {
      const { data } = await api.post('/applications/merit/publish');
      const r = data.data;
      setMsg({ type: 'success', text: `Published. ${r.called} applicant(s) called${r.emailed ? `, ${r.emailed} e-mail(s) sent` : ''}${r.emailFailed ? `, ${r.emailFailed} e-mail(s) failed` : ''}. ${r.emailNote || ''}` });
      load();
    } catch (err) { setMsg({ type: 'error', text: errorMessage(err) }); } finally { setBusy(false); }
  };

  const reset = async () => {
    const yes = await confirm({
      tone: 'danger',
      title: 'Withdraw the merit list?',
      message: 'The list disappears from the public page and the interview calls are removed from the applicants\' tracking pages. E-mails that were already sent cannot be taken back.',
      confirmText: 'Withdraw',
    });
    if (!yes) return;
    setBusy(true);
    try {
      await api.post('/applications/merit/reset');
      setMsg({ type: 'success', text: 'Merit list withdrawn. You can publish it again later.' });
      load();
    } catch (err) { setMsg({ type: 'error', text: errorMessage(err) }); } finally { setBusy(false); }
  };

  if (!st) return <p className="muted small">{msg.text || 'Loading merit list status...'}</p>;

  return (
    <div className="sub-card" style={{ marginTop: '.75rem' }}>
      <h4 style={{ marginTop: 0 }}>Merit list status</h4>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {st.published ? (
        <>
          <div className="alert alert-success">
            Published on {fmtDateTime(st.publishedAt)}. {st.visibleToPublic ? 'It is visible on the public Merit List page.' : `It becomes visible on ${fmtDate(st.meritListDate)}.`}
          </div>
          <div className="actions"><button type="button" className="btn btn-danger" disabled={busy} onClick={reset}>Withdraw merit list</button></div>
        </>
      ) : (
        <>
          {st.problems.length > 0 && (
            <div className="alert alert-info">
              <b>Not ready to publish:</b>
              <ul style={{ margin: '.25rem 0 0 1.1rem' }}>{st.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
            </div>
          )}
          {st.ready && (
            <div className="alert alert-info">
              Ready. {st.meritListDate && st.autoPublish ? `It will be published automatically on ${fmtDate(st.meritListDate)}.` : 'Press Publish when you want it to go out.'}
            </div>
          )}
          {st.departments.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Department</th><th>Ranked applicants</th><th>Called for interview</th></tr></thead>
                <tbody>{st.departments.map((d) => <tr key={d.department}><td>{d.department}</td><td>{d.applicants}</td><td>{d.called}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <p className="muted small">
            Applicants who were rejected or are still waiting to send documents are not ranked. Applicants with the same score share a rank, so everyone tied at the last place is called too.
          </p>
          <div className="actions"><button type="button" className="btn btn-primary" disabled={busy || !st.ready} onClick={publish}>Publish merit list now</button></div>
        </>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>
        {st.emailConfigured
          ? 'E-mail is set up: called applicants also receive the message by e-mail.'
          : 'E-mail is not set up on the server, so called applicants see the message on their "Track my application" page only (SMTP_HOST and SMTP_FROM in server/.env).'}
      </p>
    </div>
  );
}
