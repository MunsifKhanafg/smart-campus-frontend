import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { Badge, fmtDateTime } from '../components/ui.jsx';

// One teacher (or HOD): contact details, qualification and every subject they teach, with the number of students in each.
// Principal: any department. HOD: own department only (the server enforces it).
export default function TeacherProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/users/${id}/profile`).then((r) => setData(r.data.data)).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading teacher...</p>;
  const { teacher: t, courses, totals } = data;

  return (
    <>
      <div className="crumbs">
        <Link to="/teachers">Teachers</Link><span>/</span><span>{t.name}</span>
      </div>
      <div className="hero">
        <div className="grow">
          <h1>{t.name} {t.role === 'hod' && <Badge value="upcoming" text="HOD" />}</h1>
          <p>{t.qualification || 'Qualification not entered'} · {t.department?.name}</p>
        </div>
        <Badge value={t.isActive ? 'active' : 'archived'} text={t.isActive ? 'active' : 'inactive'} />
      </div>

      <div className="tiles">
        <div className="tile"><div className="ico">📘</div><div><b>{totals.courses}</b><span>Current classes</span></div></div>
        <div className="tile teal"><div className="ico">⏱️</div><div><b>{totals.creditHours}</b><span>Credit hours</span></div></div>
        <div className="tile rose"><div className="ico">🎓</div><div><b>{totals.students}</b><span>Students taught</span></div></div>
      </div>

      <div className="card">
        <h3>Contact</h3>
        <div className="cols-2">
          <div>Email: <b>{t.email}</b></div>
          <div>Phone: <b>{t.phone || '—'}</b></div>
          <div>Department: <b>{t.department?.name}</b></div>
          <div className="muted small">Last login: {t.lastLogin ? fmtDateTime(t.lastLogin) : 'never'}</div>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Subjects taught</h3>
        <table>
          <thead><tr><th>Subject</th><th>Semester</th><th>Section</th><th>Credits</th><th>Students</th><th>Status</th><th /></tr></thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c._id}>
                <td><b>{c.code}</b> {c.title}</td>
                <td>{c.semester?.name}<div className="muted small">{c.semester?.academicYear}</div></td>
                <td>{c.section}</td>
                <td>{c.creditHours}</td>
                <td>{c.students}</td>
                <td><Badge value={c.status} /></td>
                <td><Link className="btn btn-small" to={`/courses/${c._id}`}>Open</Link></td>
              </tr>
            ))}
            {!courses.length && <tr><td colSpan={7} className="muted">No subjects assigned yet. The HOD assigns them under "Assign Teachers".</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
