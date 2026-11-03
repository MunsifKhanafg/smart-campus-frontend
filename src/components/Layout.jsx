import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice.js';
import api from '../api/axios.js';
import Brand from './Brand.jsx';

const ROLE_LABEL = {
  university_head: 'University Head',
  hod: 'HOD',
  finance_officer: 'Finance Officer',
  teacher: 'Teacher',
  student: 'Student',
};

// Menu items per role. Later modules simply add more entries here (and a route in App.jsx).
const COMMON = [
  ['/calendar', 'Academic Calendar'],
  ['/announcements', 'Announcements'],
];
const MENU = {
  university_head: [
    ['/dashboard', 'Dashboard'],
    ['/departments', 'Departments'],
    ['/teachers', 'Teachers'],
    ['/students', 'Students'],
    ['/attendance', 'Attendance'],
    ['/users', 'Users'],
    ['/semesters', 'Semesters'],
    ['/courses', 'Courses'],
    ['/examinations', 'Examinations'],
    ['/fee-notices', 'Fee Notices'],
    ['/finance', 'Finance Reports'],
    ['/admissions', 'Exam Admissions'],
    ['/documents', 'Student Documents'],
    ['/complaints', 'Complaints'],
    ['/insights', 'Reports & Insights'],
    ...COMMON,
    ['/settings', 'University Settings'],
  ],
  hod: [
    ['/dashboard', 'Dashboard'],
    ['/departments', 'My Department'],
    ['/teachers', 'Teachers'],
    ['/students', 'Students'],
    ['/attendance', 'Attendance'],
    ['/semesters', 'Semesters'],
    ['/courses', 'Courses'],
    ['/timetable', 'Timetable'],
    ['/examinations', 'Examinations'],
    ['/fee-notices', 'Fee Notices'],
    ['/admissions', 'Exam Admissions'],
    ['/documents', 'Student Documents'],
    ['/complaints', 'Complaints'],
    ['/insights', 'Reports & Insights'],
    ...COMMON,
  ],
  finance_officer: [
    ['/dashboard', 'Dashboard'],
    ['/fee-notices', 'Fee Notices'],
    ['/finance', 'Finance Desk'],
    ['/admissions', 'Exam Admissions'],
    ['/complaints', 'Complaints'],
    ...COMMON,
  ],
  teacher: [
    ['/dashboard', 'Dashboard'],
    ['/courses', 'My Courses'],
    ['/my-timetable', 'My Timetable'],
    ['/examinations', 'Exam Date Sheet'],
    ...COMMON,
  ],
  student: [
    ['/dashboard', 'Dashboard'],
    ['/my-courses', 'My Courses'],
    ['/my-timetable', 'My Timetable'],
    ['/exams', 'Exams & Admission'],
    ['/results', 'My Results'],
    ['/fees', 'Fees & Payments'],
    ['/documents', 'My Documents'],
    ['/complaints', 'Complaints'],
    ['/my-performance', 'Academic Support'],
    ['/my-record', 'My Academic Record'],
    ...COMMON,
  ],
};

const ICON = {
  '/dashboard': '🏠', '/departments': '🏛️', '/teachers': '👩‍🏫', '/students': '🎓', '/attendance': '✅', '/users': '👥',
  '/semesters': '📚', '/courses': '📘', '/timetable': '🕘', '/my-timetable': '🕘', '/examinations': '📝', '/fee-notices': '🧾',
  '/finance': '💰', '/admissions': '🪪', '/documents': '📄', '/complaints': '📣', '/insights': '📊', '/calendar': '📅',
  '/announcements': '📢', '/settings': '⚙️', '/my-courses': '📘', '/exams': '📝', '/results': '🏆', '/fees': '💳',
  '/my-performance': '📈', '/my-record': '🗂️',
};

export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Unread notification count for the bell. Checked on load and then once a minute.
  useEffect(() => {
    let alive = true;
    const check = () =>
      api.get('/notifications', { params: { unread: 'true' } })
        .then((r) => alive && setUnread(r.data.data.unreadCount))
        .catch(() => {});
    check();
    const timer = setInterval(check, 60 * 1000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const doLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand light showCampus />
        <nav onClick={() => setOpen(false)}>
          {(MENU[user.role] || []).map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span className="nav-ico">{ICON[to] || '•'}</span>{label}
            </NavLink>
          ))}
          <NavLink to="/contact" target="_blank">University Contact</NavLink>
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
          <div className="spacer" />
          <NavLink to="/notifications" className="bell" aria-label="Notifications" title="Notifications">
            🔔{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
          </NavLink>
          <div className="who">
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}{user.department ? ` · ${user.department.code}` : ''}</span>
          </div>
          <NavLink to="/change-password" className="btn btn-ghost">Password</NavLink>
          <button className="btn btn-ghost" onClick={doLogout}>Logout</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
