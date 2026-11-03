import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDateTime, label } from '../components/ui.jsx';

// Examination admission requests. The HOD approves, rejects or sends them back for correction.
// The server re-checks every rule at the moment of approval, so an ineligible student cannot be approved.
export default function Admissions() {
  const role = useSelector((s) => s.auth.user.role);
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending');
  const [open, setOpen] = useState(null); // row being reviewed
  const [decision, setDecision] = useState({ status: 'approved', remarks: '' });

  const load = useCallback(() => {
    api.get('/admissions', { params: status ? { status } : {} }).then((r) => setRows(r.data.data)).catch(fail);
  }, [status, fail]);
  useEffect(() => { load(); }, [load]);

  const review = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admissions/${open._id}/review`, { status: decision.status, remarks: decision.remarks || undefined });
      ok('Review saved. The student has been notified.');
      setOpen(null);
      load();
    } catch (err) {
      const failed = err.response?.data?.details;
      if (Array.isArray(failed) && failed[0]?.label) fail(`${err.response.data.message}`);
      else fail(err);
      load();
    }
  };

  return (
    <>
      <h1>Examination Admissions</h1>
      <Alert msg={msg} />
      <div className="card filters">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="requires_correction">Requires correction</option>
          </select>
        </div>
      </div>

      {open && isHod && (
        <form className="card" onSubmit={review}>
          <h3>{open.studentName} <span className="muted small">{open.rollNumber} · {open.examination?.name}</span></h3>
          <ul>
            {open.checks?.map((c) => (
              <li key={c.key}>{c.passed ? '✅' : '❌'} {c.label} <span className="muted small">— {c.detail}</span></li>
            ))}
          </ul>
          <div className="form-grid">
            <div>
              <label>Decision</label>
              <select value={decision.status} onChange={(e) => setDecision({ ...decision, status: e.target.value })}>
                <option value="approved">Approve</option>
                <option value="requires_correction">Requires correction</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
          </div>
          <label>Remarks {decision.status !== 'approved' && '(required)'}</label>
          <textarea rows={2} value={decision.remarks} onChange={(e) => setDecision({ ...decision, remarks: e.target.value })} />
          <div className="actions">
            <button className="btn btn-primary">Save decision</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setOpen(null)}>Cancel</button>
          </div>
          <p className="muted small">The checklist above is the state of the requirements as of the last check. The server re-checks it when you save.</p>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Roll</th><th>Student</th><th>Examination</th><th>Requested</th><th>Status</th><th>Why</th>{isHod && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{r.rollNumber}</td>
                <td>{r.studentName}</td>
                <td>{r.examination?.name}</td>
                <td>{fmtDateTime(r.requestedAt)}</td>
                <td><Badge value={r.status} text={label(r.status)} /></td>
                <td className="small">{r.reason || '—'}</td>
                {isHod && <td><button className="btn btn-small" onClick={() => { setOpen(r); setDecision({ status: 'approved', remarks: '' }); }}>Review</button></td>}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No admission requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
