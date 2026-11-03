import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';

// Students of a department, optionally one semester. Read-only list with a link to each full record.
export default function StudentsPanel({ department, semester }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    const params = {};
    if (department) params.department = department;
    if (semester) params.semester = semester;
    api.get('/students', { params })
      .then((r) => { setRows(r.data.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [department, semester]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <p className="muted">Loading students...</p>;

  const q = search.trim().toLowerCase();
  const shown = q
    ? rows.filter((p) => `${p.rollNumber} ${p.user?.name} ${p.user?.email}`.toLowerCase().includes(q))
    : rows;

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: '.75rem' }}>
        <strong>{shown.length} student{shown.length === 1 ? '' : 's'}</strong>
        <input style={{ maxWidth: 280 }} placeholder="Search name, email or roll..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Roll</th><th>Name</th><th>Semester</th><th>Section</th><th>Status</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p._id}>
                <td>{p.rollNumber}</td>
                <td>{p.user?.name}<div className="muted small">{p.user?.email}</div></td>
                <td>{p.semester?.name || <em className="muted">Not placed</em>}</td>
                <td>{p.section}</td>
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td><Link className="btn btn-small" to={`/students/${p.user?._id}/record`}>Record</Link></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="muted">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
