import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import TeacherDashboard from '../components/TeacherDashboard.jsx';
import { money } from '../components/ui.jsx';
import { Stat } from './library/common.jsx';
import './library.css';

const GREETING = {
  university_head: 'Open a department to see its semesters, classes, teachers, students and attendance.',
  hod: 'Open your department to manage semesters, classes, teachers and students.',
  finance_officer: 'Create fee notices and follow payments from the Finance Desk.',
  library_controller: 'Issue and receive books, manage the catalogue and follow overdue books and fines from the Library page.',
  teacher: 'Your classes, timings and semesters are below. Open a subject to mark attendance, add topics and more.',
  student: 'Your courses, timetable, results and fees are in the menu.',
};

// A short library summary on the dashboard. Student: their own books and return dates. Library controller: the library totals. (Never shown to the principal.)
// If the library cannot be read the strip is simply not shown, so it can never break the dashboard.
function LibraryStrip({ role }) {
  const navigate = useNavigate();
  const student = role === 'student';
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get(student ? '/library/me/summary' : '/library/dashboard').then((r) => setD(r.data.data)).catch(() => {});
  }, [student]);
  if (!d) return null;
  const cur = d.currency || '';
  return (
    <>
      <h3>Library</h3>
      {student ? (
        <div className="tiles">
          <Stat icon="📖" value={d.totals.active} text="Books with me" onClick={() => navigate('/my-library')} />
          <Stat icon="⏰" value={d.totals.overdue} text="Overdue books" tone="rose" onClick={() => navigate('/my-library')} />
          <Stat icon="💸" value={money(d.totals.pending, cur)} text="Library fine to pay" tone="amber" onClick={() => navigate('/my-library')} />
        </div>
      ) : (
        <div className="tiles">
          <Stat icon="📚" value={d.books.titles} text={`Book titles · ${d.books.copies} copies`} onClick={() => navigate('/library')} />
          <Stat icon="✅" value={d.books.available} text="Available copies" tone="teal" onClick={() => navigate('/library?tab=books')} />
          <Stat icon="📖" value={d.loans.issued} text="Issued books" tone="amber" onClick={() => navigate('/library?tab=loans')} />
          <Stat icon="⏰" value={d.loans.overdue} text="Overdue books" tone="rose" onClick={() => navigate('/library?tab=loans')} />
          <Stat icon="💸" value={money(d.fines.pending, cur)} text="Fines to collect" tone="rose" onClick={() => navigate('/library?tab=loans')} />
        </div>
      )}
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
    // Every request is read on its own, so one slow or failing list can never hide the departments.
    Promise.allSettled([api.get('/departments'), api.get('/users'), api.get('/students'), api.get('/semesters')])
      .then(([d, u, st, sem]) => {
        const list = (r) => (r.status === 'fulfilled' ? r.value.data.data : []);
        const departments = list(d);
        const users = list(u);
        setDepts(departments);
        setStats({
          departments: departments.length,
          teachers: users.filter((x) => x.role === 'teacher' || x.role === 'hod').length,
          students: list(st).length,
          semesters: list(sem).length,
        });
      });
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
        {user.role === 'library_controller' && <Link className="btn" to="/library?tab=desk">Open the library desk</Link>}
        {user.role === 'student' && <Link className="btn" to="/my-library">My library</Link>}
      </div>

      {user.role === 'teacher' && <TeacherDashboard />}
      {['student', 'library_controller'].includes(user.role) && <LibraryStrip role={user.role} />}

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
            {depts.map((d) => (
              <Link key={d._id} to={`/departments/${d._id}`} className="dept-card">
                <div className="row-between" style={{ gap: '.5rem' }}>
                  <span className="code">{d.code}</span>
                  {d.status !== 'active' && <span className="badge archived">{d.status}</span>}
                </div>
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
