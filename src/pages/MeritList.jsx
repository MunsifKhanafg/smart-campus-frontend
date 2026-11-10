import { useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';

// Public merit list. It exists only after the University Head has published it (the ranks are frozen at that moment).
// Applicants are ranked inside each department by merit score. "Interview call" marks the candidates called by the university.
export default function MeritList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/public/merit-list', { params: dept ? { department: dept } : {} })
      .then((r) => { setData(r.data.data); setError(''); })
      .catch((e) => { setData(null); setError(errorMessage(e)); });
  }, [dept]);

  const needle = q.trim().toLowerCase();

  return (
    <AdmissionShell wide title={data?.intake ? `Merit list: ${data.intake}` : 'Merit list'} subtitle="Ranked by merit score inside each department.">
      {error && <div className="adm-alert info">{error}</div>}

      {data && (
        <>
          <div className="adm-card">
            <div className="adm-grid">
              <div>
                <label>Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">All departments</option>
                  {data.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
                </select>
              </div>
              <div><label>Search by name or application number</label><input value={q} onChange={(e) => setQ(e.target.value)} /></div>
            </div>
            <div className="adm-actions"><button type="button" className="adm-btn ghost" onClick={() => window.print()}>Print</button></div>
          </div>

          {!data.departments.length && <div className="adm-alert info">There are no ranked applicants to show.</div>}
          {data.departments.map((d) => {
            const rows = needle ? d.rows.filter((r) => `${r.name} ${r.applicationNumber}`.toLowerCase().includes(needle)) : d.rows;
            if (!rows.length) return null;
            return (
              <div className="adm-card" key={d._id}>
                <h3>{d.name} <span className="muted small">({d.rows.length} applicants)</span></h3>
                <div className="adm-scroll">
                  <table className="adm-table">
                    <thead><tr><th>Rank</th><th>Application no.</th><th>Name</th><th>Programme</th><th>Merit score</th><th /></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.applicationNumber} className={r.selected ? 'sel' : ''}>
                          <td><span className="adm-rank">{r.rank}</span></td>
                          <td>{r.applicationNumber}</td>
                          <td>{r.name}</td>
                          <td>{r.program || '—'}</td>
                          <td><b>{r.meritScore}</b></td>
                          <td>{r.selected && <span className="adm-chip">Interview call</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </AdmissionShell>
  );
}
