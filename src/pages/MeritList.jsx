import { useEffect, useMemo, useState } from 'react';
import api, { errorMessage } from '../api/axios.js';
import AdmissionShell from '../components/AdmissionShell.jsx';

// Public merit list. It exists only while the University Head has switched "show the merit list publicly" on.
// Ranked per department and programme by the percentage the server calculated from the marks.
export default function MeritList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.get('/public/merit-list').then((r) => setData(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, []);

  const departments = useMemo(() => [...new Set((data?.groups || []).map((g) => g.department))], [data]);
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.groups || [])
      .filter((g) => !dept || g.department === dept)
      .map((g) => ({ ...g, items: needle ? g.items.filter((i) => i.name.toLowerCase().includes(needle) || i.applicationNumber.toLowerCase().includes(needle)) : g.items }))
      .filter((g) => g.items.length);
  }, [data, dept, q]);

  return (
    <AdmissionShell wide title="Merit list" subtitle={data?.intakeName ? `Intake: ${data.intakeName}` : undefined}>
      {error && <div className="adm-alert error">{error}</div>}
      {data && !data.published && <div className="adm-alert info">The merit list has not been published yet. Please check again later.</div>}

      {data?.published && (
        <>
          <div className="adm-card">
            <div className="adm-grid">
              <div>
                <label>Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label>Search by name or application number</label><input value={q} onChange={(e) => setQ(e.target.value)} /></div>
            </div>
            <p className="small muted" style={{ marginTop: '.7rem' }}>
              Ranked by percentage. If two applicants have the same percentage, the one who applied first is ranked higher. "Selected" means the department has accepted the application.
            </p>
            <div className="adm-actions"><button type="button" className="adm-btn ghost" onClick={() => window.print()}>Print</button></div>
          </div>

          {!groups.length && <div className="adm-alert info">No applicants match.</div>}
          {groups.map((g) => (
            <div className="adm-card" key={`${g.department}|${g.programName}`}>
              <h3>{g.department}{g.programName ? ` · ${g.programName}` : ''} <span className="muted small">({g.items.length} applicants)</span></h3>
              <div className="adm-scroll">
                <table className="adm-table">
                  <thead><tr><th>Rank</th><th>Application no.</th><th>Name</th><th>Marks</th><th>Percentage</th><th /></tr></thead>
                  <tbody>
                    {g.items.map((i) => (
                      <tr key={i.applicationNumber} className={i.selected ? 'sel' : ''}>
                        <td><span className="adm-rank">{i.rank}</span></td>
                        <td>{i.applicationNumber}</td>
                        <td>{i.name}</td>
                        <td>{i.obtainedMarks} / {i.totalMarks}</td>
                        <td><b>{i.percentage}%</b></td>
                        <td>{i.selected && <span className="adm-chip">Selected</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </AdmissionShell>
  );
}
