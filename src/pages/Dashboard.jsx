import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';

const GREETING = {
  university_head: 'Open a department to see its semesters, classes, teachers, students and attendance.',
  hod: 'Open your department to manage semesters, classes, teachers and students.',
  finance_officer: 'Create fee notices and follow payments from the Finance Desk.',
  teacher: 'Your classes, timings and semesters are below. Open a subject to mark attendance, add topics and more.',
  student: 'Your courses, timetable, results and fees are in the menu.',
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const todayName = () => DAYS[(new Date().getDay() + 6) % 7]; // JS: Sunday = 0

// ---------------------------------------------------------------------------------------------
// Teacher dashboard: subjects per semester, today's classes, weekly timetable with time and room.
// ---------------------------------------------------------------------------------------------
function TeacherDashboard() {
  const [courses, setCourses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/courses'), api.get('/timetables/mine')])
      .then(([c, t]) => {
        setCourses(c.data.data.filter((x) => x.status !== 'archived'));
        setSlots(t.data.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const today = todayName();
  const todays = slots.filter((s) => s.day === today);
  const semesterNames = [...new Set(courses.map((c) => c.semester?.name).filter(Boolean))];

  // subjects grouped by semester, each with its weekly class times
  const bySemester = new Map();
  for (const c of courses) {
    const key = c.semester?._id || 'none';
    if (!bySemester.has(key)) bySemester.set(key, { semester: c.semester, courses: [] });
    bySemester.get(key).courses.push({ ...c, slots: slots.filter((s) => String(s.course?._id) === String(c._id)) });
  }

  if (!loaded) return <p className="muted">Loading your classes…</p>;

  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="ico">📘</div><div><b>{courses.length}</b><span>My subjects</span></div></div>
        <div className="tile teal"><div className="ico">📚</div><div><b>{semesterNames.length}</b><span>Semesters</span></div></div>
        <div className="tile amber"><div className="ico">🕘</div><div><b>{slots.length}</b><span>Classes per week</span></div></div>
        <div className="tile rose"><div className="ico">📅</div><div><b>{todays.length}</b><span>Classes today</span></div></div>
      </div>

      <div className="card table-wrap">
        <h3>Today ({today})</h3>
        <table>
          <thead><tr><th>Time</th><th>Subject</th><th>Semester</th><th>Section</th><th>Room</th></tr></thead>
          <tbody>
            {todays.map((s) => (
              <tr key={s._id}>
                <td><strong>{s.startTime} - {s.endTime}</strong></td>
                <td>{s.course?.code} - {s.course?.title}</td>
                <td>{s.semester?.name}</td>
                <td>{s.course?.section}</td>
                <td>{s.room}</td>
              </tr>
            ))}
            {!todays.length && <tr><td colSpan={5} className="muted">No classes today.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <h3>My weekly timetable</h3>
        <table>
          <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Semester</th><th>Section</th><th>Room</th></tr></thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s._id} style={s.day === today ? { background: '#eef2ff' } : undefined}>
                <td style={{ textTransform: 'capitalize' }}>{s.day}</td>
                <td><strong>{s.startTime} - {s.endTime}</strong></td>
                <td>{s.course?.code} - {s.course?.title}</td>
                <td>{s.semester?.name}</td>
                <td>{s.course?.section}</td>
                <td>{s.room}</td>
              </tr>
            ))}
            {!slots.length && <tr><td colSpan={6} className="muted">Your timetable will appear here after your HOD publishes it.</td></tr>}
          </tbody>
        </table>
      </div>

      <h3>My subjects by semester</h3>
      {[...bySemester.values()].map(({ semester, courses: list }) => (
        <div className="card" key={semester?._id || 'none'}>
          <div className="row-between">
            <h4 style={{ margin: 0 }}>{semester ? `${semester.name} (${semester.academicYear})` : 'No semester'}</h4>
            {semester?.status && <span className="badge">{semester.status}</span>}
          </div>
          {list.map((c) => (
            <div className="sub-card" key={c._id} style={{ marginTop: '.6rem' }}>
              <div className="row-between">
                <div>
                  <strong>{c.code}</strong> - {c.title}
                  <div className="muted small">Section {c.section} · {c.creditHours} credit hours</div>
                </div>
                <Link className="btn btn-small btn-primary" to={`/courses/${c._id}`}>Open</Link>
              </div>
              <div className="small" style={{ marginTop: '.35rem' }}>
                {c.slots.length
                  ? c.slots.map((s) => <div key={s._id} style={{ textTransform: 'capitalize' }}>{s.day} {s.startTime}-{s.endTime} · Room {s.room}</div>)
                  : <span className="muted">Not scheduled yet</span>}
              </div>
            </div>
          ))}
        </div>
      ))}
      {!courses.length && <div className="card muted">No subject has been assigned to you yet. Your HOD assigns subjects to teachers.</div>}
    </>
  );
}

export default function Dashboard() {
  const { user } = useSelector((s) => s.auth);
  const settings = useSelector((s) => s.settings);
  const [stats, setStats] = useState(null);
  const [depts, setDepts] = useState([]);
  const isManager = ['university_head', 'hod'].includes(user.role);

  useEffect(() => {
    if (!isManager) return;
    Promise.all([api.get('/departments'), api.get('/users'), api.get('/students'), api.get('/semesters')])
      .then(([d, u, st, sem]) => {
        const users = u.data.data;
        setDepts(d.data.data);
        setStats({
          departments: d.data.data.length,
          teachers: users.filter((x) => x.role === 'teacher' || x.role === 'hod').length,
          students: st.data.data.length,
          semesters: sem.data.data.length,
        });
      })
      .catch(() => {});
  }, [isManager]);

  const myDeptId = user.department?._id || user.department;

  return (
    <>
      <div className="hero">
        <div className="grow">
          <h1>Welcome, {user.name}</h1>
          <p>{settings.universityName}{settings.campusName ? ` — ${settings.campusName}` : ''}</p>
          <p>{GREETING[user.role]}</p>
        </div>
        {user.role === 'hod' && myDeptId && <Link className="btn" to={`/departments/${myDeptId}`}>Open my department</Link>}
        {user.role === 'university_head' && <Link className="btn" to="/departments">View all departments</Link>}
      </div>

      {user.role === 'teacher' && <TeacherDashboard />}

      {stats && (
        <div className="tiles">
          {user.role === 'university_head' && <div className="tile"><div className="ico">🏛️</div><div><b>{stats.departments}</b><span>Departments</span></div></div>}
          <div className="tile teal"><div className="ico">📚</div><div><b>{stats.semesters}</b><span>Semesters</span></div></div>
          <div className="tile amber"><div className="ico">👩‍🏫</div><div><b>{stats.teachers}</b><span>Teachers / HODs</span></div></div>
          <div className="tile rose"><div className="ico">🎓</div><div><b>{stats.students}</b><span>Students</span></div></div>
        </div>
      )}

      {user.role === 'university_head' && depts.length > 0 && (
        <>
          <h3>Departments</h3>
          <div className="dept-grid">
            {depts.filter((d) => d.status === 'active').map((d) => (
              <Link key={d._id} to={`/departments/${d._id}`} className="dept-card">
                <span className="code">{d.code}</span>
                <h3>{d.name}</h3>
                <div className="meta">HOD: {d.hod ? <b>{d.hod.name}</b> : <em>Not assigned</em>}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
