import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { Badge, fmtDate } from '../../components/ui.jsx';
import { LoanActions, LoanState, Charges, useMoney } from './common.jsx';

// Students of the college (the existing student records) and their library history: books out, overdue, fines, every book ever borrowed.
// "Holding books" lists the students who have a book right now, the most overdue first.
export default function Students({ run, ok, fail, init = {} }) {
  const m = useMoney();
  const [q, setQ] = useState('');
  const [holding, setHolding] = useState(init.holding === 'true' || init.holding === true);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null); // history of one student
  const [loaded, setLoaded] = useState(false);

  const search = useCallback(() => {
    if (!holding && q.trim().length < 2) { setRows([]); setLoaded(false); return Promise.resolve(); }
    return api.get('/library/students', { params: { q: q.trim(), holding: holding ? 'true' : undefined } }).then((r) => { setRows(r.data.data); setLoaded(true); }).catch(fail);
  }, [q, holding, fail]);
  useEffect(() => { const t = setTimeout(search, 250); return () => clearTimeout(t); }, [search]);

  const show = useCallback(async (id) => {
    try { setOpen((await api.get(`/library/students/${id}`)).data.data); } catch (e) { fail(e); }
  }, [fail]);
  const reload = () => { search(); if (open) show(open.student._id); };

  return (
    <>
      <div className="card filters">
        <input placeholder="Search by roll number or name (at least 2 letters)..." value={q} onChange={(e) => setQ(e.target.value)} disabled={holding} />
        <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={holding} onChange={(e) => setHolding(e.target.checked)} /> Only students holding books now</label>
      </div>

      {open && (
        <div className="card lib-result">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>{open.student.name} · {open.student.rollNumber}</h3>
            <button className="btn btn-small btn-ghost" onClick={() => setOpen(null)}>Close</button>
          </div>
          <p className="muted">
            {open.student.department?.name} · {open.student.semester} · section {open.student.section} · {open.student.email} · phone {open.student.hasPhone ? open.student.phone : 'not registered (no SMS)'}
          </p>
          <p>
            Borrowed in total <b>{open.totals.total}</b> · out now <b>{open.totals.active}</b> · overdue <b className={open.totals.overdue ? 'lib-state-overdue' : ''}>{open.totals.overdue}</b> · returned <b>{open.totals.returned}</b> · lost <b>{open.totals.lost}</b> · fine to pay <b>{m(open.totals.pending)}</b>
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th><th>Money</th>{run && <th />}</tr></thead>
              <tbody>
                {open.loans.map((l) => (
                  <tr key={l._id}>
                    <td><b>{l.book?.title}</b><div className="muted small"><code>{l.copyCode}</code>{l.renewals ? ` · renewed ${l.renewals}×` : ''}{l.complaint ? ' · complaint filed' : ''}</div></td>
                    <td>{l.issuedDay}</td><td>{l.dueDay}</td><td>{l.returnedDay || '—'}</td>
                    <td><LoanState loan={l} /></td><td><Charges loan={l} /></td>
                    {run && <td><LoanActions loan={l} run onDone={reload} ok={ok} fail={fail} /></td>}
                  </tr>
                ))}
                {!open.loans.length && <tr><td colSpan={7} className="muted">This student has never borrowed a book.</td></tr>}
              </tbody>
            </table>
          </div>
          {open.reservations.length > 0 && (
            <>
              <h4>Reservations</h4>
              <ul>{open.reservations.map((r) => <li key={r._id}>{r.book?.title} — <Badge value={r.status} />{r.holdUntilDay ? ` held until ${r.holdUntilDay}` : ''} (asked {fmtDate(r.createdAt)})</li>)}</ul>
            </>
          )}
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Roll no.</th><th>Student</th><th>Department</th><th>Semester</th><th>Books out</th><th>Overdue</th><th>Fine to pay</th><th>Phone</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id}>
                <td>{s.rollNumber}</td><td>{s.name}{!s.active && <span className="badge archived">inactive</span>}</td><td>{s.department?.code}</td><td>{s.semester}</td>
                <td>{s.active}</td><td className={s.overdue ? 'lib-state-overdue' : ''}>{s.overdue}</td><td>{m(s.pending)}</td>
                <td>{s.hasPhone ? s.phone : <span className="muted">none</span>}</td>
                <td><button className="btn btn-small" onClick={() => show(s._id)}>Library history</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="muted">{holding || loaded ? 'No students found.' : 'Search for a student by roll number or name.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
