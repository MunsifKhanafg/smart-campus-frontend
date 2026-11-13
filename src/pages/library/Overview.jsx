import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { fmtDateTime } from '../../components/ui.jsx';
import { Stat, useMoney } from './common.jsx';

// Library dashboard: total / available / issued / returned / overdue books, fines, students, reservations, complaints and the last 14 days.
// The principal sees the same numbers (monitoring); only the library controller can run the reminder job.
export default function Overview({ run, ok, fail, go }) {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const m = useMoney();

  const load = useCallback(() => api.get('/library/dashboard').then((r) => setD(r.data.data)).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);

  const runJobs = async () => {
    setBusy(true);
    try { const { data } = await api.post('/library/jobs/run'); ok(data.message); load(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  if (!d) return <div className="card muted">Loading...</div>;
  const peak = Math.max(1, ...d.trend.map((t) => Math.max(t.issued, t.returned)));
  const stateText = { present: 'Present', late: 'Late', absent: 'Absent', leave: 'On leave', not_marked: 'Not checked in yet' };

  return (
    <>
      <div className="tiles">
        <Stat icon="📚" value={d.books.titles} text={`Book titles · ${d.books.copies} copies`} onClick={() => go('books')} />
        <Stat icon="✅" value={d.books.available} text="Available copies" tone="teal" onClick={() => go('books')} />
        <Stat icon="📖" value={d.loans.issued} text="Issued books" tone="amber" onClick={() => go('loans', { status: 'open' })} />
        <Stat icon="↩️" value={d.loans.returned} text="Returned books" onClick={() => go('loans', { status: 'returned' })} />
        <Stat icon="⏰" value={d.loans.overdue} text="Overdue books" tone="rose" onClick={() => go('loans', { status: 'overdue' })} />
        <Stat icon="💸" value={m(d.fines.pending)} text="Fines to collect" tone="rose" onClick={() => go('loans', { status: 'unpaid' })} />
        <Stat icon="💰" value={m(d.fines.collected)} text={`Fines collected · waived ${m(d.fines.waived)}`} tone="teal" />
        <Stat icon="🎓" value={d.students.withBooks} text={`Students with books · ${d.students.withOverdue} overdue`} onClick={() => go('students', { holding: true })} />
        <Stat icon="🔖" value={d.reservations.waiting + d.reservations.ready} text={`Reservations · ${d.reservations.ready} ready`} onClick={() => go('reservations')} />
        <Stat icon="📣" value={d.complaints.open} text={`Open complaints · ${d.complaints.total} filed`} tone="amber" onClick={() => go('complaints')} />
        <Stat icon="🗓️" value={`${d.loans.issuedToday} / ${d.loans.returnedToday}`} text="Issued / returned today" />
        <Stat icon="⚠️" value={d.books.lost + d.books.damaged} text={`Lost ${d.books.lost} · damaged ${d.books.damaged}`} onClick={() => go('reports', { report: 'lost-damaged' })} />
      </div>

      <div className="lib-panels">
        <div className="card">
          <h3>Last 14 days</h3>
          <div className="lib-bars" aria-label="Books issued and returned in the last 14 days">
            {d.trend.map((t) => (
              <div className="col" key={t.day} title={`${t.day}: ${t.issued} issued, ${t.returned} returned`}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 70, width: '100%' }}>
                  <div className="bar in" style={{ height: `${(t.issued / peak) * 100}%`, flex: 1 }} />
                  <div className="bar out" style={{ height: `${(t.returned / peak) * 100}%`, flex: 1 }} />
                </div>
                <small>{t.day.slice(8)}</small>
              </div>
            ))}
          </div>
          <div className="lib-legend"><span><i style={{ background: 'var(--primary, #2563eb)' }} />Issued</span><span><i style={{ background: '#16a34a' }} />Returned</span></div>
        </div>

        <div className="card">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Library staff today</h3>
          </div>
          {d.staff.length ? (
            <ul style={{ margin: '.5rem 0 0', paddingLeft: '1.1rem' }}>
              {d.staff.map((s) => (
                <li key={s._id}>{s.name}: <b>{stateText[s.status] || s.status}</b>{s.checkInAt ? ` at ${fmtDateTime(s.checkInAt).split(', ').pop()}` : ''}{s.minutesLate ? ` (${s.minutesLate} min late)` : ''}</li>
              ))}
            </ul>
          ) : <p className="muted">No library controller account exists yet. The principal adds one on the Users page.</p>}
          {run && (
            <div className="actions" style={{ marginTop: '.75rem' }}>
              <button type="button" className="btn" disabled={busy} onClick={runJobs}>{busy ? 'Working...' : 'Send reminders and check overdue books now'}</button>
            </div>
          )}
          <p className="muted small">This also runs by itself every 30 minutes: reminders before and after the return date, overdue detection and complaints.</p>
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Longest overdue</h3>
        <table>
          <thead><tr><th>Student</th><th>Book</th><th>Was due</th><th>Days late</th><th>Fine so far</th></tr></thead>
          <tbody>
            {d.mostOverdue.map((o) => (
              <tr key={o._id}><td>{o.student} · {o.rollNumber}</td><td>{o.book}</td><td>{o.dueDay}</td><td className="lib-state-overdue">{o.overdueDays}</td><td>{m(o.fine)}</td></tr>
            ))}
            {!d.mostOverdue.length && <tr><td colSpan={5} className="muted">No overdue books. 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
