import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { LoanActions, LoanState, Charges, Pager, clean, who } from './common.jsx';

const STATUS = [['open', 'Issued now'], ['overdue', 'Overdue'], ['unpaid', 'Fine not paid'], ['returned', 'Returned'], ['lost', 'Lost'], ['all', 'All loans']];

// Every loan: issued, overdue, returned, lost, with unpaid fines. Filter by status, student, book, department and dates.
export default function Loans({ run, ok, fail, init = {} }) {
  const [f, setF] = useState({ status: init.status || 'open', q: '', department: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [depts, setDepts] = useState([]);

  const load = useCallback(() => {
    api.get('/library/loans', { params: { ...clean(f), page, limit: 25 } }).then((r) => setData(r.data.data)).catch(fail);
  }, [f, page, fail]);
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {}); }, []);

  const change = (k) => (e) => { setPage(1); setF({ ...f, [k]: e.target.value }); };

  return (
    <>
      <div className="card filters">
        <select value={f.status} onChange={change('status')}>{STATUS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
        <input placeholder="Student name, roll number or book title..." value={f.q} onChange={change('q')} />
        <select value={f.department} onChange={change('department')}><option value="">All departments</option>{depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
        <div><label>Issued from</label><input type="date" value={f.from} onChange={change('from')} /></div>
        <div><label>to</label><input type="date" value={f.to} min={f.from || undefined} onChange={change('to')} /></div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Department</th><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th><th>Money</th>{run && <th />}</tr></thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l._id}>
                <td>{who(l)}</td><td>{l.department?.code || '—'}</td>
                <td><b>{l.book?.title}</b><div className="muted small"><code>{l.copyCode}</code>{l.renewals ? ` · renewed ${l.renewals}×` : ''}{l.complaint ? ' · department complaint filed' : ''}{l.principalComplaint ? ' · principal informed' : ''}</div></td>
                <td>{l.issuedDay}</td><td>{l.dueDay}</td><td>{l.returnedDay || '—'}</td>
                <td><LoanState loan={l} /></td><td><Charges loan={l} /></td>
                {run && <td><LoanActions loan={l} run onDone={load} ok={ok} fail={fail} /></td>}
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={9} className="muted">No loans match.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </>
  );
}
