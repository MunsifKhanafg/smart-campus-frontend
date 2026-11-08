import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import TeacherEditPanel from '../components/TeacherEditPanel.jsx';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1, 3) : '');

// One teacher: every class and subject they teach, grouped by semester, with weekly times and class size.
export default function TeacherDetail() {
  const { teacherId } = useParams();
  const me = useSelector((s) => s.auth.user);
  const [teacher, setTeacher] = useState(null);
  const [courses, setCourses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [sizes, setSizes] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/users'), api.get('/courses', { params: { teacher: teacherId } })])
      .then(async ([u, c]) => {
        const t = u.data.data.find((x) => x._id === teacherId);
        if (!t) return setError('Teacher not found or you do not have access to this teacher.');
        const list = c.data.data;
        setTeacher(t);
        setCourses(list);

        const semIds = [...new Set(list.map((k) => k.semester?._id).filter(Boolean))];
        const [tt, counts] = await Promise.all([
          Promise.all(semIds.map((id) => api.get(`/timetables/semester/${id}`).then((r) => r.data.data.slots).catch(() => []))),
          Promise.all(list.map((k) => api.get(`/enrollments/course/${k._id}`).then((r) => [k._id, r.data.data.students.length]).catch(() => [k._id, 0]))),
        ]);
        setSlots(tt.flat().filter((s) => String(s.teacher?._id || s.teacher) === teacherId));
        setSizes(Object.fromEntries(counts));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [teacherId]);

  const bySemester = useMemo(() => {
    const map = new Map();
    courses.forEach((k) => {
      const key = k.semester?.name || 'No semester';
      (map.get(key) || map.set(key, []).get(key)).push(k);
    });
    return [...map.entries()];
  }, [courses]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!teacher) return <p className="muted">Loading teacher...</p>;

  const active = courses.filter((k) => k.status === 'active');
  const totalStudents = Object.values(sizes).reduce((a, b) => a + b, 0);
  // The University Head can edit teachers and HODs; an HOD can edit the teachers of their own department (the server checks it too).
  const canEdit = me.role === 'university_head' ? teacher.role !== 'university_head' : me.role === 'hod' && teacher.role === 'teacher';

  return (
    <>
      <div className="crumbs"><Link to="/teachers">Teachers</Link><span>/</span><span>{teacher.name}</span></div>

      <div className="hero">
        <div className="person-card" style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.3)', cursor: 'default', boxShadow: 'none' }}>
          <div className="avatar" style={{ width: 64, height: 64, fontSize: '1.8rem', background: 'rgba(255,255,255,.25)' }}>{teacher.name[0]}</div>
        </div>
        <div className="grow">
          <h1>{teacher.name} {teacher.role === 'hod' && <span className="badge">HOD</span>}</h1>
          <p>{teacher.department?.name || 'No department'} · {teacher.email}</p>
        </div>
        <span className={`badge ${teacher.isActive ? 'active' : 'archived'}`}>{teacher.isActive ? 'active' : 'inactive'}</span>
      </div>

      {canEdit && (
        <TeacherEditPanel
          teacher={teacher}
          onSaved={(u) => setTeacher((t) => ({ ...t, name: u.name, email: u.email, phone: u.phone, qualification: u.qualification }))}
        />
      )}

      <div className="tiles">
        <div className="tile"><div className="ico">📘</div><div><b>{active.length}</b><span>Subjects / classes</span></div></div>
        <div className="tile teal"><div className="ico">📚</div><div><b>{bySemester.length}</b><span>Semesters</span></div></div>
        <div className="tile amber"><div className="ico">🕘</div><div><b>{slots.length}</b><span>Lectures per week</span></div></div>
        <div className="tile rose"><div className="ico">🎓</div><div><b>{totalStudents}</b><span>Students taught</span></div></div>
      </div>

      {!courses.length && <div className="card empty-state"><div className="big">📭</div>No classes have been assigned to this teacher yet.</div>}

      {bySemester.map(([semName, list]) => (
        <section key={semName} className="group">
          <h3 className="group-title">{semName} <span>{list.length}</span></h3>
          <div className="dept-grid">
            {list.map((k) => (
              <div key={k._id} className="dept-card" style={{ cursor: 'default' }}>
                <div className="row-between" style={{ gap: '.5rem' }}>
                  <span className="code">{k.code}</span>
                  <span className={`badge ${k.status}`}>{k.status}</span>
                </div>
                <h3>{k.title}</h3>
                <div className="meta">Section {k.section || '—'} · {k.creditHours} credit hrs</div>
                <div>
                  {slots.filter((s) => (s.course?._id || s.course) === k._id).map((s) => (
                    <span key={s._id} className="slot-chip"><b>{cap(s.day)}</b> {s.startTime}–{s.endTime} · {s.room}</span>
                  ))}
                  {!slots.some((s) => (s.course?._id || s.course) === k._id) && <em className="muted small">Not on the timetable</em>}
                </div>
                <div className="mini"><div><b>{sizes[k._id] ?? '…'}</b>Students</div></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
