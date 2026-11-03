import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, downloadSafe } from '../components/ui.jsx';

// Student: published date sheets, examination admission status, and the admit card.
export default function MyExams() {
  const [msg, ok, fail] = useFlash();
  const [sheets, setSheets] = useState([]);
  const [admissions, setAdmissions] = useState([]);

  const load = useCallback(() => {
    api.get('/examinations/mine').then((r) => setSheets(r.data.data)).catch(fail);
    api.get('/admissions/mine').then((r) => setAdmissions(r.data.data)).catch(fail);
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const request = async (examId) => {
    try { await api.post('/admissions/request', { examination: examId }); ok('Admission request sent to your HOD'); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <h1>Examinations</h1>
      <Alert msg={msg} />

      <h3>Examination admission</h3>
      {!admissions.length && <div className="card muted">No published examination for your semester yet.</div>}
      {admissions.map((a) => {
        const status = a.admission?.status;
        return (
          <div className="card" key={a.examination._id}>
            <div className="row-between">
              <h4 style={{ margin: 0 }}>{a.examination.name}</h4>
              {status ? <Badge value={status} /> : <Badge value="not_started" text="not requested" />}
            </div>
            <div className="muted small">{fmtDate(a.examination.startDate)} to {fmtDate(a.examination.endDate)}</div>
            <ul>
              {a.checks.map((c) => (
                <li key={c.key}>
                  {c.passed ? '✅' : '❌'} {c.label} <span className="muted small">— {c.detail}</span>
                  {!c.passed && c.key === 'fees' && <> <Link to="/fees">Pay now</Link></>}
                  {!c.passed && c.key === 'documents' && <> <Link to="/documents">Upload documents</Link></>}
                </li>
              ))}
            </ul>
            {status && status !== 'approved' && <div className={`alert ${status === 'pending' ? 'alert-info' : 'alert-error'}`}>{a.admission.reason || 'Waiting for review'}</div>}
            {!status && !a.allPassed && <div className="alert alert-info">{a.reason}</div>}
            <div className="actions">
              {(!status || status === 'requires_correction' || status === 'rejected') && (
                <button className="btn btn-primary inline" disabled={!a.allPassed} onClick={() => request(a.examination._id)}>{status ? 'Request again' : 'Request admission'}</button>
              )}
              {status === 'approved' && <button className="btn btn-primary inline" onClick={() => downloadSafe(`/admissions/${a.admission._id}/admit-card`, 'AdmitCard.pdf', fail)}>Download admit card</button>}
            </div>
          </div>
        );
      })}

      <h3>Date sheet</h3>
      {!sheets.length && <div className="card muted">No date sheet has been published yet.</div>}
      {sheets.map((s) => (
        <div className="card table-wrap" key={s._id}>
          <h4 style={{ marginTop: 0 }}>{s.name}</h4>
          <table>
            <thead><tr><th>Date</th><th>Time</th><th>Course</th><th>Room</th><th>Max marks</th></tr></thead>
            <tbody>{s.papers.map((p) => <tr key={p._id}><td>{fmtDate(p.date)}</td><td>{p.startTime}–{p.endTime}</td><td>{p.course.code} — {p.course.title}</td><td>{p.room}</td><td>{p.maxMarks}</td></tr>)}</tbody>
          </table>
        </div>
      ))}
    </>
  );
}
