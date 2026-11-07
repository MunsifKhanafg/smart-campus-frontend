import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';

// Public merit list. The University Head publishes it in Settings. Applicants are ranked inside each department by merit score.
export default function MeritList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dept, setDept] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/public/merit-list', { params: dept ? { department: dept } : {} })
      .then((r) => { setData(r.data.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [dept]);

  const q = search.trim().toLowerCase();

  return (
    <AdmissionShell title={data?.intake ? `Merit list: ${data.intake}` : 'Merit list'} subtitle="Ranked by merit score inside each department. Applicants called for an interview are marked." wide>
      {error && <div className="adm-alert warn">{error} <Link to="/track-application">Track my application</Link></div>}

      {data && (
        <>
          <div className="adm-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220 }}>
              <label>Department</label>
              <select value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All departments</option>
                {data.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <label>Find by name or application number</label>
              <input value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {!data.departments.length && <div className="adm-card muted">There are no applicants to show yet.</div>}
          {data.departments.map((d) => {
            const rows = q ? d.rows.filter((r) => `${r.name} ${r.applicationNumber}`.toLowerCase().includes(q)) : d.rows;
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
                          <td>{r.selected && <span className="adm-chip">Called for interview</span>}</td>
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
