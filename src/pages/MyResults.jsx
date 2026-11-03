import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, downloadSafe } from '../components/ui.jsx';

// Student: every published result (current and previous semesters) with DMC download.
export default function MyResults() {
  const [msg, , fail] = useFlash();
  const [rows, setRows] = useState(null);

  useEffect(() => { api.get('/results/mine').then((r) => setRows(r.data.data)).catch(fail); }, [fail]);

  return (
    <>
      <div className="row-between">
        <h1>My Results</h1>
        <Link className="btn btn-ghost" to="/check-result" target="_blank">Verify a DMC</Link>
      </div>
      <Alert msg={msg} />
      {rows && !rows.length && <div className="card muted">No result has been published for you yet.</div>}
      {rows?.map((r) => (
        <div className="card" key={r._id}>
          <div className="row-between">
            <div>
              <h3 style={{ marginBottom: 0 }}>{r.examination?.name}</h3>
              <div className="muted small">{r.semester?.name} {r.semester?.academicYear ? `(${r.semester.academicYear})` : ''} · published {fmtDate(r.publishedAt)}{r.dmcNumber ? ` · ${r.dmcNumber}` : ''}</div>
            </div>
            <div className="actions">
              <Badge value={r.outcome} />
              <button className="btn btn-small" onClick={() => downloadSafe(`/results/${r._id}/dmc`, `${r.dmcNumber || 'DMC'}.pdf`, fail)}>Download DMC</button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Subject</th><th>Max</th><th>Obtained</th><th>Result</th></tr></thead>
              <tbody>
                {r.subjects.map((s) => (
                  <tr key={s.code}>
                    <td>{s.code}</td><td>{s.title}</td><td>{s.maxMarks}</td><td>{s.absent ? 'Absent' : s.obtained}</td>
                    <td><Badge value={s.passed ? 'pass' : 'fail'} /></td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}><strong>Total</strong></td><td><strong>{r.totalMax}</strong></td><td><strong>{r.totalObtained}</strong></td>
                  <td><strong>{r.percentage}% · Grade {r.grade}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  );
}
