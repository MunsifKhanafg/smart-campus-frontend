import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge } from '../components/ui.jsx';

// Student: current semester courses with attendance at a glance.
export default function MyCourses() {
  const [msg, , fail] = useFlash();
  const [courses, setCourses] = useState(null);
  const [att, setAtt] = useState({});
  const [min, setMin] = useState(75);

  useEffect(() => {
    api.get('/enrollments/my-courses').then((r) => setCourses(r.data.data)).catch(fail);
    api.get('/attendance/me').then((r) => {
      setMin(r.data.data.minPercent);
      setAtt(Object.fromEntries(r.data.data.rows.map((x) => [x.course._id, x])));
    }).catch(() => {});
  }, [fail]);

  return (
    <>
      <h1>My Courses</h1>
      <Alert msg={msg} />
      {courses && !courses.length && <div className="card muted">You are not enrolled in any course yet. Your HOD places you in a semester and its courses.</div>}
      <div className="grid">
        {courses?.map((e) => {
          const a = att[e.course._id];
          return (
            <Link key={e._id} to={`/my-courses/${e.course._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card">
                <h3>{e.course.code}</h3>
                <div>{e.course.title}</div>
                <div className="muted small">{e.semester?.name} · {e.course.teacher?.name || 'Teacher not assigned'}</div>
                <div className="mt small">
                  Attendance: {a?.percent === null || a?.percent === undefined ? '—' : <Badge value={a.percent < min ? 'high' : 'low'} text={`${a.percent}%`} />}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
