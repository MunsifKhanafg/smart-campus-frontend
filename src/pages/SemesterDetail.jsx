import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { Tabs, fmtDate } from '../components/ui.jsx';
import StudentsPanel from '../components/StudentsPanel.jsx';
import AttendancePanel from '../components/AttendancePanel.jsx';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1, 3) : '');

// One semester: every class with its teacher, weekly time, room and number of students.
export default function SemesterDetail() {
  const { deptId, semId } = useParams();
  const { user } = useSelector((s) => s.auth);
  const isHod = user.role === 'hod';
  const [semester, setSemester] = useState(null);
  const [courses, setCourses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [tt, setTt] = useState(null);
  const [students, setStudents] = useState([]);
  const [classSize, setClassSize] = useState({});
  const [tab, setTab] = useState('classes');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/semesters/${semId}`),
      api.get('/courses', { params: { semester: semId } }),
      api.get(`/timetables/semester/${semId}`),
      api.get('/students', { params: { semester: semId } }),
    ])
      .then(async ([s, c, t, st]) => {
        setSemester(s.data.data);
        setCourses(c.data.data);
        setSlots(t.data.data.slots);
        setTt(t.data.data.timetable);
        setStudents(st.data.data);
        // How many students sit in each class.
        const sizes = {};
        await Promise.all(c.data.data.map(async (k) => {
          try { sizes[k._id] = (await api.get(`/enrollments/course/${k._id}`)).data.data.students.length; } catch { sizes[k._id] = 0; }
        }));
        setClassSize(sizes);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [semId]);

  const slotsByCourse = useMemo(() => {
    const m = {};
    slots.forEach((x) => { const k = x.course?._id; (m[k] = m[k] || []).push(x); });
    return m;
  }, [slots]);

  const teacherCount = new Set(courses.map((c) => c.teacher?._id).filter(Boolean)).size;

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!semester) return <p className="muted">Loading semester...</p>;

  const deptName = semester.department?.name;

  return (
    <>
      <div className="crumbs">
        {!isHod && <><Link to="/departments">Departments</Link><span>/</span></>}
        <Link to={`/departments/${deptId}`}>{deptName}</Link><span>/</span>
        <span>{semester.name}</span>
      </div>

      <div className="hero">
        <div className="grow">
          <h1>{semester.name}</h1>
          <p>{deptName} · {semester.academicYear} · {fmtDate(semester.startDate)} to {fmtDate(semester.endDate)}</p>
        </div>
        <span className={`badge ${semester.status}`}>{semester.status}</span>
        <span className="badge">Timetable: {tt?.status || 'draft'}</span>
        {isHod && <Link className="btn" to="/timetable">Edit timetable</Link>}
      </div>

      <div className="tiles">
        <div className="tile"><div className="ico">📘</div><div><b>{courses.length}</b><span>Courses</span></div></div>
        <div className="tile teal"><div className="ico">🕘</div><div><b>{slots.length}</b><span>Classes per week</span></div></div>
        <div className="tile amber"><div className="ico">👩‍🏫</div><div><b>{teacherCount}</b><span>Teachers</span></div></div>
        <div className="tile rose"><div className="ico">🎓</div><div><b>{students.length}</b><span>Total students</span></div></div>
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[['classes', 'Classes & teachers'], ['students', 'Students'], ['attendance', 'Attendance']]} />

      {tab === 'classes' && (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Course</th><th>Teacher</th><th>Weekly time &amp; room</th><th>Students</th><th>Credit hrs</th></tr></thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c._id}>
                  <td>
                    <b>{c.code}</b> {c.title}
                    <div className="muted small">Section {c.section || '—'} · <span className={`badge ${c.status}`}>{c.status}</span></div>
                  </td>
                  <td>{c.teacher ? <>{c.teacher.name}<div className="muted small">{c.teacher.email}</div></> : <em className="muted">No teacher assigned</em>}</td>
                  <td>
                    {(slotsByCourse[c._id] || []).map((x) => (
                      <span key={x._id} className="slot-chip"><b>{cap(x.day)}</b> {x.startTime}–{x.endTime} · {x.room}</span>
                    ))}
                    {!slotsByCourse[c._id] && <em className="muted">Not on the timetable</em>}
                  </td>
                  <td><b>{classSize[c._id] ?? '…'}</b></td>
                  <td>{c.creditHours}</td>
                </tr>
              ))}
              {!courses.length && <tr><td colSpan={5} className="muted">No courses in this semester yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'students' && <StudentsPanel department={deptId} semester={semId} />}
      {tab === 'attendance' && <AttendancePanel department={deptId} semester={semId} />}
    </>
  );
}
