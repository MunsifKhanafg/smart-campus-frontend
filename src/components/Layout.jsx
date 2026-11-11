import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice.js';
import api from '../api/axios.js';
import Brand from './Brand.jsx';
import Avatar from './Avatar.jsx';
import LogoToggles from './LogoToggles.jsx';
import useResponsiveTables from './useResponsiveTables.js';

const ROLE_LABEL = {
  university_head: 'University Head',
  hod: 'HOD',
  finance_officer: 'Finance Officer',
  teacher: 'Teacher',
  student: 'Student',
};

// Each role only sees the pages it really works with, grouped under small headings.
// (Pages a role should not open are also blocked by the routes in App.jsx and by the server.)
const MENU = {
  university_head: [
    { items: [['/dashboard', 'Dashboard']] },
    { title: 'University', items: [['/departments', 'Departments'], ['/teachers', 'Teachers'], ['/students', 'Students'], ['/applications', 'New Applications'], ['/attendance', 'Attendance'], ['/staff-attendance', 'Staff Attendance']] },
    { title: 'Finance', items: [['/finance-overview', 'Finance Overview'], ['/promotion-fees', 'Promotion Fees'], ['/fee-reminders', 'Unpaid Lists']] },
    { title: 'Academics', items: [['/curriculum', 'BS Curriculum'], ['/insights', 'Reports & Insights']] },
    { title: 'Communication', items: [['/assistant', 'AI Assistant'], ['/announcements', 'Announcements'], ['/calendar', 'Academic Calendar'], ['/complaints', 'Complaints']] },
    { title: 'Administration', items: [['/users', 'Users & HODs'], ['/settings', 'University Settings']] },
  ],
  hod: [
    { items: [['/dashboard', 'Dashboard']] },
    { title: 'My department', items: [['/departments', 'My Department'], ['/teachers', 'Teachers'], ['/students', 'Students'], ['/attendance', 'Attendance'], ['/staff-attendance', 'Staff Attendance']] },
    { title: 'Academics', items: [['/semesters', 'Semesters'], ['/curriculum', 'BS Curriculum'], ['/assign-teachers', 'Assign Teachers'], ['/courses', 'Courses'], ['/timetable', 'Timetable'], ['/examinations', 'Examinations']] },
    { title: 'Students & fees', items: [['/applications', 'New Applications'], ['/admissions', 'Exam Admissions'], ['/documents', 'Student Documents'], ['/fee-notices', 'Fee Notices'], ['/promotion-fees', 'Promotion Fees'], ['/fee-reminders', 'Unpaid Lists']] },
    { title: 'Support', items: [['/assistant', 'AI Assistant'], ['/complaints', 'Complaints'], ['/insights', 'Reports & Insights'], ['/announcements', 'Announcements'], ['/calendar', 'Academic Calendar']] },
  ],
  finance_officer: [
    { items: [['/dashboard', 'Dashboard']] },
    { title: 'Money', items: [['/finance-overview', 'Finance Overview'], ['/fee-notices', 'Fee Notices'], ['/promotion-fees', 'Promotion Fees'], ['/fee-reminders', 'Unpaid Lists'], ['/finance', 'Finance Desk']] },
    { title: 'Students', items: [['/assistant', 'AI Assistant'], ['/admissions', 'Exam Admissions'], ['/complaints', 'Fee Complaints']] },
    { title: 'Updates', items: [['/announcements', 'Announcements']] },
  ],
  teacher: [
    { items: [['/dashboard', 'Dashboard']] },
    { title: 'Teaching', items: [['/courses', 'My Courses'], ['/my-timetable', 'My Timetable'], ['/staff-attendance', 'My Check-in & Leave'], ['/my-attendance', 'Student Attendance'], ['/examinations', 'Exam Date Sheet']] },
    { title: 'Updates', items: [['/announcements', 'Announcements'], ['/calendar', 'Academic Calendar']] },
  ],
  student: [
    { items: [['/dashboard', 'Dashboard']] },
    { title: 'Study', items: [['/my-courses', 'My Courses'], ['/my-timetable', 'My Timetable'], ['/calendar', 'Academic Calendar']] },
    { title: 'Exams & results', items: [['/exams', 'Exams & Admission'], ['/results', 'My Results'], ['/my-performance', 'Academic Support']] },
    { title: 'Fees & records', items: [['/fees', 'Fees & Payments'], ['/documents', 'My Documents'], ['/my-record', 'My Academic Record']] },
    { title: 'Help', items: [['/complaints', 'Complaints'], ['/announcements', 'Announcements']] },
  ],
};

const ICON = {
  '/dashboard': '🏠', '/staff-attendance': '🕐', '/departments': '🏛️', '/teachers': '👩‍🏫', '/students': '🎓', '/attendance': '✅', '/my-attendance': '✅', '/users': '👥',
  '/semesters': '📚', '/courses': '📘', '/timetable': '🕘', '/my-timetable': '🕘', '/examinations': '📝', '/fee-notices': '🧾',
  '/finance': '💰', '/finance-overview': '📈', '/promotion-fees': '🪜', '/fee-reminders': '⏰', '/admissions': '🪪', '/documents': '📄', '/complaints': '📣', '/insights': '📊', '/calendar': '📅',
  '/announcements': '📢', '/settings': '⚙️', '/my-courses': '📘', '/exams': '📝', '/results': '🏆', '/fees': '💳',
  '/my-performance': '📈', '/assistant': '🤖', '/applications': '📥', '/my-record': '🗂️', '/curriculum': '🧬', '/assign-teachers': '🧑‍🏫',
};

export default function Layout() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  useResponsiveTables(); // tables become cards on phones, so nothing scrolls sideways

  // The phone menu closes after every page change, with Esc, and the page behind it does not scroll while it is open.
  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle('drawer-open', open);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('drawer-open'); document.removeEventListener('keydown', onKey); };
  }, [open]);

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
      {open && <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="side-brand"><Brand light showCampus stacked size={50} /></div>
        <nav onClick={() => setOpen(false)}>
          {(MENU[user.role] || []).map((group, i) => (
            <div key={group.title || i} className="nav-group">
              {group.title && <div className="nav-title">{group.title}</div>}
              {group.items.map(([to, label]) => (
                <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <span className="nav-ico">{ICON[to] || '•'}</span>{label}
                </NavLink>
              ))}
            </div>
          ))}
          {user.role === 'student' && (
            <div className="nav-group">
              <NavLink to="/contact" target="_blank"><span className="nav-ico">☎️</span>University Contact</NavLink>
            </div>
          )}
        </nav>

        {/* On a phone the top bar is small, so the account and the sign-out button are always here at the bottom of the menu too. */}
        <div className="side-foot">
          <div style={{ marginBottom: '.5rem' }}><Avatar user={user} size={46} /></div>
          <div className="side-user">
            <b>{user.name}</b>
            <small>{ROLE_LABEL[user.role]}{user.department ? ` · ${user.department.code}` : ''}</small>
          </div>
          <NavLink to="/account" className="side-btn" onClick={() => setOpen(false)}>👤 Account</NavLink>
          <button type="button" className="side-btn out" onClick={doLogout}>⎋ Log out</button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Toggle menu">☰</button>
          <div className="spacer" />
          <LogoToggles />
          <NavLink to="/notifications" className="bell" aria-label="Notifications" title="Notifications">
            🔔{unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
          </NavLink>
          <NavLink to="/account" className="top-avatar" aria-label="My photo and details" title="My photo and details"><Avatar user={user} size={36} /></NavLink>
          <div className="who">
            <strong>{user.name}</strong>
            <span>{ROLE_LABEL[user.role]}{user.department ? ` · ${user.department.code}` : ''}</span>
          </div>
          <NavLink to="/account" className="btn btn-ghost top-account">Account</NavLink>
          <button className="btn btn-ghost top-logout" onClick={doLogout} aria-label="Log out"><span className="lo-ico">⎋</span><span className="lo-txt">Logout</span></button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
