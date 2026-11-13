import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios.js';
import { Badge, fmtDate, fmtDateTime, label } from '../../components/ui.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { Pager, clean } from './common.jsx';

// ---------------------------------------------------------------------------------------------
// Reservations: students waiting for a title whose copies are all out. A returned copy is held for the first one in the queue.
export function Reservations({ run, ok, fail }) {
  const confirm = useConfirm();
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const load = useCallback(() => { api.get('/library/reservations', { params: { status, page, limit: 25 } }).then((r) => setData(r.data.data)).catch(fail); }, [status, page, fail]);
  useEffect(() => { load(); }, [load]);

  const cancel = async (r) => {
    const yes = await confirm({ title: 'Cancel this reservation?', message: `${r.student} will lose their place for "${r.book?.title}". A held copy goes to the next student.`, confirmText: 'Cancel reservation' });
    if (!yes) return;
    try { const { data: res } = await api.delete(`/library/reservations/${r._id}`); ok(res.message); load(); } catch (e) { fail(e); }
  };

  return (
    <>
      <div className="card filters">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          {['open', 'waiting', 'ready', 'fulfilled', 'cancelled', 'expired', 'all'].map((s) => <option key={s} value={s}>{s === 'open' ? 'Waiting and ready' : label(s)}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Book</th><th>Asked on</th><th>Status</th><th>Held until</th>{run && <th />}</tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r._id}>
                <td>{r.student} · {r.rollNumber}</td><td>{r.book?.title}<div className="muted small">{r.book?.bookId}</div></td><td>{fmtDate(r.createdAt)}</td>
                <td><Badge value={r.status} /></td><td>{r.holdUntilDay || '—'}</td>
                {run && <td>{['waiting', 'ready'].includes(r.status) && <button className="btn btn-small btn-danger" onClick={() => cancel(r)}>Cancel</button>}</td>}
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={6} className="muted">No reservations.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The history of every SMS and in-app message the library sent, and whether the text message went out.
const SMS = { sent: ['approved', 'SMS sent'], no_phone: ['pending', 'No phone number'], not_configured: ['pending', 'SMS not set up'], disabled: ['archived', 'SMS off in Rules'], failed: ['rejected', 'Failed'], pending: ['pending', 'Sending'] };
export function Messages({ fail }) {
  const [f, setF] = useState({ status: '', kind: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, counts: {}, smsConfigured: true });
  const load = useCallback(() => { api.get('/library/messages', { params: { ...clean(f), page, limit: 30 } }).then((r) => setData(r.data.data)).catch(fail); }, [f, page, fail]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      {!data.smsConfigured && <div className="alert alert-info">The SMS service is not configured on the server, so students only get the in-app notification. The administrator sets the SMS provider in <code>server/.env</code>.</div>}
      <p>{Object.entries(data.counts).map(([k, n]) => <span key={k} style={{ marginRight: '1rem' }}>{(SMS[k] || [, k])[1]} <b>{n}</b></span>)}</p>
      <div className="card filters">
        <select value={f.status} onChange={(e) => { setPage(1); setF({ ...f, status: e.target.value }); }}><option value="">All results</option>{Object.entries(SMS).map(([k, [, t]]) => <option key={k} value={k}>{t}</option>)}</select>
        <select value={f.kind} onChange={(e) => { setPage(1); setF({ ...f, kind: e.target.value }); }}>
          <option value="">All kinds</option>{['issued', 'before_due', 'due_today', 'overdue', 'returned', 'lost', 'reservation_ready', 'reservation_expired', 'fine'].map((k) => <option key={k} value={k}>{label(k)}</option>)}
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Student</th><th>Kind</th><th>Message</th><th>SMS</th></tr></thead>
          <tbody>
            {data.items.map((x) => (
              <tr key={x._id}><td>{fmtDateTime(x.at)}</td><td>{x.student} · {x.rollNumber}</td><td>{label(x.kind)}</td><td>{x.text}</td><td><Badge value={(SMS[x.status] || ['pending'])[0]} text={(SMS[x.status] || [, x.status])[1]} /></td></tr>
            ))}
            {!data.items.length && <tr><td colSpan={5} className="muted">No messages yet.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Complaints the library filed by itself about books that were not returned. The department (HOD) reviews and resolves them
// on the normal Complaints page; they close by themselves when the book comes back.
export function LibraryComplaints({ fail, role }) {
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/library/complaints', { params: clean({ status }) }).then((r) => setRows(r.data.data)).catch(fail); }, [status, fail]);

  return (
    <>
      <div className="card">
        <p style={{ margin: 0 }}>
          When a student does not return a book, the library files a complaint to the student's department by itself (student, book, issue date and overdue days included).
          The HOD reviews and resolves it on the <b>Complaints</b> page{role === 'university_head' ? <> (you can open it <Link to="/complaints">here</Link>)</> : ''}. The principal is informed when the delay is long. A complaint closes by itself when the book is returned.
        </p>
      </div>
      <div className="card filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option><option value="open">Open</option><option value="in_review">In review</option><option value="resolved">Resolved</option><option value="rejected">Rejected</option>
        </select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Filed</th><th>Student</th><th>Department</th><th>Sent to</th><th>Subject</th><th>Status</th><th>Resolution</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c._id}>
                <td>{fmtDate(c.createdAt)}</td><td>{c.student} · {c.rollNumber}</td><td>{c.department?.code}</td><td>{label(c.recipient)}</td>
                <td>{c.subject}<div className="muted small">{label(c.category)}</div></td><td><Badge value={c.status} text={label(c.status)} /></td><td>{c.resolution}{c.resolvedAt ? <div className="muted small">{fmtDate(c.resolvedAt)}</div> : null}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="muted">No library complaints.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Every library action (who did what and when), from the project's audit log.
export function Activity({ fail }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  useEffect(() => {
    const t = setTimeout(() => api.get('/library/activity', { params: { ...clean({ q: q.trim() }), page, limit: 40 } }).then((r) => setData(r.data.data)).catch(fail), 250);
    return () => clearTimeout(t);
  }, [q, page, fail]);

  const detail = (meta) => Object.entries(meta || {}).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k, v]) => `${label(k)}: ${v}`).join(' · ');

  return (
    <>
      <div className="card filters"><input placeholder="Filter by action, for example issue, return, rules, report..." value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} /></div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {data.items.map((a) => (
              <tr key={a._id}><td>{fmtDateTime(a.at)}</td><td>{a.actor}<div className="muted small">{label(a.role)}</div></td><td>{label(a.action)}</td><td className="small">{detail(a.meta)}</td></tr>
            ))}
            {!data.items.length && <tr><td colSpan={4} className="muted">No activity yet.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
      </div>
    </>
  );
}
