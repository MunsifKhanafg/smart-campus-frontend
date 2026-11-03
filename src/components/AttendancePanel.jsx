import { Fragment, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/axios.js';

// Attendance of every class in a department (optionally one semester).
// Click "Students" on a row to see each student's attendance for that class.
export default function AttendancePanel({ department, semester }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // course id being expanded
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setData(null);
    setOpen(null);
    const params = {};
    if (department) params.department = department;
    if (semester) params.semester = semester;
    api.get('/attendance/department', { params })
      .then((r) => { setData(r.data.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [department, semester]);

  const toggle = async (courseId) => {
    if (open === courseId) return setOpen(null);
    setOpen(courseId);
    setDetail(null);
    try {
      setDetail((await api.get(`/attendance/course/${courseId}/summary`)).data.data);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="muted">Loading attendance...</p>;
  if (!data.rows.length) return <div className="empty-state"><div className="big">🗓️</div>No classes found for this selection.</div>;

  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr><th>Class</th><th>Semester</th><th>Teacher</th><th>Students</th><th>Average attendance</th><th>Below {data.minPercent}%</th><th /></tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <Fragment key={r.course._id}>
              <tr>
                <td><b>{r.course.code}</b> {r.course.title}{r.course.section ? ` (${r.course.section})` : ''}</td>
                <td>{r.semester}</td>
                <td>{r.teacher || <em className="muted">No teacher</em>}</td>
                <td>{r.students}</td>
                <td>
                  {r.averagePercent === null ? <span className="muted">No data yet</span> : (
                    <div className="row-between" style={{ gap: '.5rem', flexWrap: 'nowrap' }}>
                      <div className="pill-bar"><i className={r.averagePercent < data.minPercent ? 'low' : ''} style={{ width: `${Math.min(100, r.averagePercent)}%` }} /></div>
                      <b>{r.averagePercent}%</b>
                    </div>
                  )}
                </td>
                <td>{r.belowLimit > 0 ? <span className="badge failed">{r.belowLimit}</span> : <span className="badge present">0</span>}</td>
                <td><button className="btn btn-small" onClick={() => toggle(r.course._id)}>{open === r.course._id ? 'Hide' : 'Students'}</button></td>
              </tr>
              {open === r.course._id && (
                <tr>
                  <td colSpan={7} style={{ background: '#f8fafc' }}>
                    {!detail ? 'Loading...' : (
                      <table>
                        <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th>%</th></tr></thead>
                        <tbody>
                          {detail.rows.map((s) => (
                            <tr key={s.student}>
                              <td>{s.rollNumber}</td>
                              <td>{s.name}</td>
                              <td>{s.present ?? 0}</td>
                              <td>{s.absent ?? 0}</td>
                              <td>{s.leave ?? 0}</td>
                              <td><span className={`badge ${s.belowLimit ? 'failed' : 'present'}`}>{s.percent === null ? '—' : `${s.percent}%`}</span></td>
                            </tr>
                          ))}
                          {!detail.rows.length && <tr><td colSpan={6} className="muted">No enrolled students.</td></tr>}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
