import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert } from '../components/ui.jsx';
import { CurrencyContext } from './library/common.jsx';
import Overview from './library/Overview.jsx';
import Desk from './library/Desk.jsx';
import Books from './library/Books.jsx';
import Loans from './library/Loans.jsx';
import Students from './library/Students.jsx';
import Labels from './library/Labels.jsx';
import Reports from './library/Reports.jsx';
import Rules from './library/Rules.jsx';
import { Reservations, Messages, LibraryComplaints, Activity } from './library/Lists.jsx';
import './library.css';

// The library for the library controller. Every part has its own page, opened from the menu on the left:
//   /library (Dashboard), /library/desk, /library/books, /library/loans, /library/students, /library/reservations,
//   /library/messages (Notifications), /library/complaints, /library/labels, /library/reports, /library/activity, /library/rules.
// Only library controllers open these pages (App.jsx and the server both enforce it). The server checks every call again.
// The menu itself is in components/Layout.jsx; keep the two lists in step.
const PAGES = {
  overview: ['Dashboard', 'Books, loans, fines, reservations and complaints at a glance. Reminders and complaints for books that are not returned run automatically.'],
  desk: ['Issue & Return', 'Scan the student ID card and the book, check the details and confirm. Students visit the Library Office; nothing is done online.'],
  books: ['Books', 'The catalogue: add books and copies, edit details and see which copies are available.'],
  loans: ['Loans', 'Every issue and return with its dates, fines and payments.'],
  students: ['Students', 'Find a student and see the books they hold and their borrowing history.'],
  reservations: ['Reservations', 'Students waiting for a book whose copies are all out.'],
  messages: ['Notifications', 'Every library notification sent to students.'],
  complaints: ['Complaints', 'Complaints sent to the students\' departments for books that were not returned.'],
  labels: ['Barcode Labels', 'Print a barcode label for each copy and stick it in the book.'],
  reports: ['Reports', 'Inventory, issued, overdue, history, fines and more. Download as PDF or Excel.'],
  activity: ['Activity Log', 'Who did what in the library, and when.'],
  rules: ['Rules', 'Loan days, fines, reminders, department notification and reservations.'],
};
const pathOf = (id) => (id === 'overview' ? '/library' : `/library/${id}`);

export default function Library() {
  const { user } = useSelector((s) => s.auth);
  const run = ['library_controller', 'university_head'].includes(user.role); // both may run the library; the server checks again
  const { tab: routeTab } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [msg, ok, fail] = useFlash();
  const [currency, setCurrency] = useState('');

  useEffect(() => { api.get('/library/rules').then((r) => setCurrency(r.data.data.currency || '')).catch(() => {}); }, []);

  const tab = routeTab || params.get('tab') || 'overview'; // "?tab=books" (older links) still works
  if (!PAGES[tab]) return <Navigate to="/library" replace />;
  const init = location.state?.init || {}; // starting filters when a page is opened from a dashboard tile

  // Open another library page, optionally with starting filters (for example Loans showing only overdue books).
  const go = (next, startWith = {}) => {
    navigate(pathOf(next), { state: { init: startWith } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const props = { run, ok, fail, go, init };
  const key = `${tab}:${JSON.stringify(init)}`; // a page opened with new filters starts fresh
  const [title, about] = PAGES[tab];

  return (
    <CurrencyContext.Provider value={currency}>
      <h1>{title}</h1>
      <p className="muted">{about}</p>
      <Alert msg={msg} />

      {tab === 'overview' && <Overview key={key} {...props} />}
      {tab === 'desk' && run && <Desk key={key} {...props} />}
      {tab === 'books' && <Books key={key} {...props} />}
      {tab === 'loans' && <Loans key={key} {...props} />}
      {tab === 'students' && <Students key={key} {...props} />}
      {tab === 'reservations' && <Reservations key={key} {...props} />}
      {tab === 'messages' && <Messages key={key} {...props} />}
      {tab === 'complaints' && <LibraryComplaints key={key} {...props} role={user.role} />}
      {tab === 'labels' && run && <Labels key={key} {...props} />}
      {tab === 'reports' && <Reports key={key} {...props} />}
      {tab === 'activity' && <Activity key={key} {...props} />}
      {tab === 'rules' && <Rules key={key} {...props} />}
    </CurrencyContext.Provider>
  );
}
