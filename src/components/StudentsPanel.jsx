import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { fmtDate } from './ui.jsx';
import Avatar from './Avatar.jsx';

// Students of a department, or of one semester. Read-only list with a link to each full record.
// For one semester the table also shows the total, contact details and enrollment details of every student.
export default function StudentsPanel({ department, semester }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [activeCourses, setActiveCourses] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setRows(null);
    const done = (list, extra = {}) => { setRows(list); setTotal(list.length); setActiveCourses(extra.activeCourses ?? null); setError(''); };
    if (semester) {
      api.get(`/semesters/${semester}/roster`)
        .then((r) => done(r.data.data.students.map((s) => ({
          key: s.profileId, userId: s.userId, roll: s.rollNumber, name: s.name, email: s.email, phone: s.phone, section: s.section,
          photo: { _id: s.userId, name: s.name, hasPhoto: s.hasPhoto, photoUpdatedAt: s.photoUpdatedAt },
          semesterName: null, status: s.status, admissionYear: s.admissionYear, guardian: [s.guardianName, s.guardianPhone].filter(Boolean).join(' · '),
          courses: s.coursesEnrolled, since: s.enrolledSince,
        })), { activeCourses: r.data.data.activeCourses }))
        .catch((e) => setError(errorMessage(e)));
      return;
    }
    const params = {};
    if (department) params.department = department;
    api.get('/students', { params })
      .then((r) => done(r.data.data.map((p) => ({
        key: p._id, userId: p.user?._id, roll: p.rollNumber, name: p.user?.name, email: p.user?.email, phone: p.user?.phone || '',
        photo: p.user,
        section: p.section, semesterName: p.semester?.name || null, status: p.status, admissionYear: p.admissionYear || null,
        guardian: [p.guardianName, p.guardianPhone].filter(Boolean).join(' · '), courses: null, since: null,
      }))))
      .catch((e) => setError(errorMessage(e)));
  }, [department, semester]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows) return <p className="muted">Loading students...</p>;

  const q = search.trim().toLowerCase();
  const shown = q ? rows.filter((p) => `${p.roll} ${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(q)) : rows;

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: '.75rem' }}>
        <strong>
          {semester ? `${total} student${total === 1 ? '' : 's'} enrolled in this semester` : `${shown.length} student${shown.length === 1 ? '' : 's'}`}
          {semester && activeCourses !== null && <span className="muted small"> · {activeCourses} active courses</span>}
        </strong>
        <input style={{ maxWidth: 280 }} placeholder="Search name, email, phone or roll..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reg. no.</th><th>Name</th><th>Contact</th>
              {!semester && <th>Semester</th>}
              <th>Section</th><th>Admission</th>
              {semester && <th>Enrollment</th>}
              <th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.key}>
                <td>{p.roll}</td>
                <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem' }}><Avatar user={p.photo} size={34} />{p.name}</span></td>
                <td className="small">{p.email}{p.phone && <div>{p.phone}</div>}{p.guardian && <div className="muted">Guardian: {p.guardian}</div>}</td>
                {!semester && <td>{p.semesterName || <em className="muted">Not placed</em>}</td>}
                <td>{p.section}</td>
                <td>{p.admissionYear || '—'}</td>
                {semester && <td className="small"><b>{p.courses}</b> course{p.courses === 1 ? '' : 's'}{p.since && <div className="muted">since {fmtDate(p.since)}</div>}</td>}
                <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td><Link className="btn btn-small" to={`/students/${p.userId}/record`}>Profile</Link></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={9} className="muted">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
