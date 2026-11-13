import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Tabs } from '../components/ui.jsx';
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

// The library for the staff.
//   Library controller : runs everything (desk, books, loans, fines, reservations, labels, reports, rules).
//   Principal          : the same screens read-only (monitoring), and may change the library rules. The principal gives somebody
//                        library access by adding a "Library Controller" account on the Users page.
// Every tab calls the library API; the server decides again what each role may do (see server/src/routes/library.js).
const CONTROLLER_TABS = [
  ['overview', 'Dashboard'], ['desk', 'Issue & Return'], ['books', 'Books'], ['loans', 'Loans'], ['students', 'Students'],
  ['reservations', 'Reservations'], ['messages', 'Notifications'], ['complaints', 'Complaints'], ['labels', 'Barcode Labels'],
  ['reports', 'Reports'], ['activity', 'Activity Log'], ['rules', 'Rules'],
];
// The desk and the labels are hands-on work, so the principal does not get them.
const PRINCIPAL_TABS = CONTROLLER_TABS.filter(([id]) => !['desk', 'labels'].includes(id));

export default function Library() {
  const { user } = useSelector((s) => s.auth);
  const run = user.role === 'library_controller'; // may change things; the principal only watches
  const tabs = run ? CONTROLLER_TABS : PRINCIPAL_TABS;
  const [params, setParams] = useSearchParams();
  const wanted = params.get('tab');
  const [tab, setTab] = useState(tabs.some(([id]) => id === wanted) ? wanted : 'overview');
  const [init, setInit] = useState({}); // starting filters for a tab opened from a dashboard tile
  const [msg, ok, fail] = useFlash();
  const [currency, setCurrency] = useState('');

  useEffect(() => { api.get('/library/rules').then((r) => setCurrency(r.data.data.currency || '')).catch(() => {}); }, []);

  // Open a tab, optionally with starting filters (for example the Loans tab showing only overdue books).
  const go = (next, startWith = {}) => {
    setInit(startWith);
    setTab(next);
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const props = { run, ok, fail, go, init };
  const key = `${tab}:${JSON.stringify(init)}`; // a tab opened with new filters starts fresh

  return (
    <CurrencyContext.Provider value={currency}>
      <div className="row-between">
        <h1>{run ? 'Library' : 'Library Monitoring'}</h1>
        {!run && <Link className="btn btn-ghost" to="/users">Give library access (Users)</Link>}
      </div>
      <p className="muted">
        {run
          ? 'Books, issue and return, fines, reservations, reminders and reports. Reminders and complaints for books that are not returned run automatically.'
          : 'You can see everything the library does: books, loans, fines, messages, complaints and the activity log. Only the library controller issues and receives books. You can change the library rules.'}
      </p>
      <Alert msg={msg} />
      <Tabs tabs={tabs} active={tab} onChange={(t) => go(t)} />

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
