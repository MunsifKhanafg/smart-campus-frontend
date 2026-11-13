import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, Tabs, fmtDate, fmtDateTime, label } from '../components/ui.jsx';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { CurrencyContext, Pager, Stat, LoanState, Charges, useMoney, clean } from './library/common.jsx';
import './library.css';

// The student's own library. Everything comes from the logged-in student's account (the server never takes a student id from the browser):
//   search the catalogue and see which books are available, reserve a book whose copies are all out,
//   the books I have now with their return dates, renewals, my fines, my reservations, the messages the library sent me, and my history.
const TABS = [['books', 'Search books'], ['current', 'My books'], ['fines', 'Fines'], ['reservations', 'Reservations'], ['messages', 'Notifications'], ['history', 'History']];
const SMS = { sent: 'SMS sent', no_phone: 'No phone number on file', not_configured: 'In-app only', disabled: 'In-app only', failed: 'SMS failed', pending: 'Sending' };

export default function MyLibrary() {
  const [msg, ok, fail] = useFlash();
  const [tab, setTab] = useState('books');
  const [sum, setSum] = useState(null);

  const loadSummary = useCallback(() => api.get('/library/me/summary').then((r) => setSum(r.data.data)).catch(fail), [fail]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  return (
    <CurrencyContext.Provider value={sum?.currency || ''}>
      <div className="row-between">
        <h1>Library</h1>
        <Link className="btn btn-ghost" to="/assistant">🤖 Ask the library assistant</Link>
      </div>
      <Alert msg={msg} />

      {sum && <Tiles sum={sum} go={setTab} />}
      {sum?.totals.overdue > 0 && (
        <div className="alert alert-error">You have {sum.totals.overdue} overdue book{sum.totals.overdue === 1 ? '' : 's'}. Please return {sum.totals.overdue === 1 ? 'it' : 'them'} to the library desk. A fine is added for every late day.</div>
      )}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'books' && <Catalogue ok={ok} fail={fail} onChange={loadSummary} />}
      {tab === 'current' && <Current sum={sum} ok={ok} fail={fail} onChange={loadSummary} />}
      {tab === 'fines' && <Fines sum={sum} />}
      {tab === 'reservations' && <MyReservations sum={sum} ok={ok} fail={fail} onChange={loadSummary} />}
      {tab === 'messages' && <MyMessages fail={fail} />}
      {tab === 'history' && <History sum={sum} />}

      {sum && (
        <div className="card lib-howto">
          <h3>How the library works</h3>
          <ol>
            <li>Find a book here and check that a copy is available. Take it to the library desk with your student card; the library controller issues it for <b>{sum.rules.loanDays} days</b> (up to {sum.rules.maxBooksPerStudent} books at a time).</li>
            <li>You get an SMS (to the phone number in your student record) and a notification with the return date, and reminders before and after it.</li>
            <li>Return the book at the desk. {sum.rules.maxRenewals ? `You can renew a book ${sum.rules.maxRenewals} time${sum.rules.maxRenewals === 1 ? '' : 's'} (${sum.rules.renewDays} more days) from My books, if nobody is waiting for it.` : 'Books cannot be renewed.'}</li>
            <li>After the return date the fine is <b>{sum.currency} {sum.rules.finePerDay}</b> per book per day{sum.rules.graceDays ? ` (after ${sum.rules.graceDays} grace day${sum.rules.graceDays === 1 ? '' : 's'})` : ''}. Pay fines at the library desk.</li>
            <li>If every copy is out, press <b>Reserve</b>. When a copy comes back it is held for you for {sum.rules.reservationHoldDays} days and you are told.</li>
          </ol>
        </div>
      )}
    </CurrencyContext.Provider>
  );
}

function Tiles({ sum, go }) {
  const m = useMoney();
  return (
    <div className="tiles">
      <Stat icon="📖" value={sum.totals.active} text="Books with me" onClick={() => go('current')} />
      <Stat icon="⏰" value={sum.totals.overdue} text="Overdue" tone="rose" onClick={() => go('current')} />
      <Stat icon="💸" value={m(sum.totals.pending)} text="Fine to pay" tone="amber" onClick={() => go('fines')} />
      <Stat icon="🔖" value={sum.reservations.length} text={`Reserved · ${sum.reservations.filter((r) => r.status === 'ready').length} ready`} tone="teal" onClick={() => go('reservations')} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function Catalogue({ ok, fail, onChange }) {
  const confirm = useConfirm();
  const [f, setF] = useState({ q: '', category: '', available: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [cats, setCats] = useState([]);

  const load = useCallback(() => {
    api.get('/library/books', { params: { ...clean(f), page, limit: 15 } }).then((r) => setData(r.data.data)).catch(fail);
  }, [f, page, fail]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { api.get('/library/categories').then((r) => setCats(r.data.data)).catch(() => {}); }, []);

  const change = (k) => (e) => { setPage(1); setF({ ...f, [k]: e.target.value }); };

  const reserve = async (b) => {
    try { const { data: res } = await api.post('/library/me/reserve', { book: b._id }); ok(res.message); load(); onChange(); } catch (e) { fail(e); }
  };
  const cancel = async (b) => {
    const yes = await confirm({ title: 'Cancel your reservation?', message: `You will lose your place in the waiting list for "${b.title}".`, confirmText: 'Cancel reservation', cancelText: 'Keep it' });
    if (!yes) return;
    try { const { data: res } = await api.delete(`/library/me/reservations/${b.mine.reservation._id}`); ok(res.message); load(); onChange(); } catch (e) { fail(e); }
  };

  return (
    <>
      <div className="card filters">
        <input placeholder="Search by title, author, ISBN or subject..." value={f.q} onChange={change('q')} />
        <select value={f.category} onChange={change('category')}><option value="">All categories</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select value={f.available} onChange={change('available')}><option value="">All books</option><option value="true">Available now</option></select>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Book</th><th>Category</th><th>Shelf</th><th>Copies</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.items.map((b) => (
              <tr key={b._id}>
                <td><b>{b.title}</b><div className="muted small">{(b.authors || []).join(', ')}{b.year ? ` · ${b.year}` : ''}{b.edition ? ` · ${b.edition}` : ''}</div></td>
                <td>{b.category}</td><td>{b.shelf || '—'}</td>
                <td>{b.copiesAvailable} of {b.copiesTotal} available</td>
                <td>
                  {b.mine?.borrowed ? <span className="badge active">You have it · due {b.mine.dueDay}</span>
                    : b.mine?.reservation ? <Badge value={b.mine.reservation.status} text={b.mine.reservation.status === 'ready' ? `Ready · collect by ${b.mine.reservation.holdUntilDay}` : 'Reserved · waiting'} />
                    : b.available ? <span className="badge approved">Available</span> : <span className="badge rejected">All copies out</span>}
                </td>
                <td className="actions">
                  {!b.mine?.borrowed && !b.mine?.reservation && !b.available && b.copiesTotal > 0 && <button className="btn btn-small btn-primary" onClick={() => reserve(b)}>Reserve</button>}
                  {b.mine?.reservation && <button className="btn btn-small" onClick={() => cancel(b)}>Cancel reservation</button>}
                </td>
              </tr>
            ))}
            {!data.items.length && <tr><td colSpan={6} className="muted">No books found.</td></tr>}
          </tbody>
        </table>
        <Pager page={page} pages={data.pages} total={data.total} onPage={setPage} />
        <p className="muted small">To borrow an available book, take it to the library desk with your student card.</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function Current({ sum, ok, fail, onChange }) {
  const m = useMoney();
  if (!sum) return <div className="card muted">Loading...</div>;
  const renew = async (l) => {
    try { const { data } = await api.post(`/library/me/loans/${l._id}/renew`); ok(data.message); onChange(); } catch (e) { fail(e); }
  };
  const canRenew = (l) => sum.rules.maxRenewals > 0 && l.renewals < sum.rules.maxRenewals && l.state !== 'overdue';

  return (
    <div className="card table-wrap">
      <table>
        <thead><tr><th>Book</th><th>Copy</th><th>Issued</th><th>Return by</th><th>Status</th><th>Fine so far</th><th /></tr></thead>
        <tbody>
          {sum.current.map((l) => (
            <tr key={l._id}>
              <td><b>{l.book?.title}</b><div className="muted small">{(l.book?.authors || []).join(', ')}{l.renewals ? ` · renewed ${l.renewals}×` : ''}</div></td>
              <td><code>{l.copyCode}</code></td><td>{l.issuedDay}</td><td><b>{l.dueDay}</b></td>
              <td><LoanState loan={l} /></td><td>{l.fine > 0 ? <b className="lib-state-overdue">{m(l.fine)}</b> : '—'}</td>
              <td>{canRenew(l) && <button className="btn btn-small" onClick={() => renew(l)}>Renew</button>}</td>
            </tr>
          ))}
          {!sum.current.length && <tr><td colSpan={7} className="muted">You have no borrowed books right now.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function Fines({ sum }) {
  const m = useMoney();
  if (!sum) return <div className="card muted">Loading...</div>;
  const growing = sum.current.filter((l) => l.pending > 0);
  const rows = [...growing, ...sum.unpaid];
  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fine to pay: {m(sum.totals.pending)}</h3>
        <p className="muted" style={{ marginBottom: 0 }}>Fines are paid at the library desk. A fine on a book that is still with you keeps growing until you return it. Total paid so far: {m(sum.totals.paid)}.</p>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Book</th><th>Return by</th><th>Status</th><th>Charges</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l._id}><td><b>{l.book?.title}</b></td><td>{l.dueDay}</td><td><LoanState loan={l} /></td><td><Charges loan={l} /></td></tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="muted">You have no fine to pay. 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
function MyReservations({ sum, ok, fail, onChange }) {
  const confirm = useConfirm();
  if (!sum) return <div className="card muted">Loading...</div>;
  const cancel = async (r) => {
    const yes = await confirm({ title: 'Cancel this reservation?', message: `"${r.book?.title}" will no longer be kept for you.`, confirmText: 'Cancel reservation', cancelText: 'Keep it' });
    if (!yes) return;
    try { const { data } = await api.delete(`/library/me/reservations/${r._id}`); ok(data.message); onChange(); } catch (e) { fail(e); }
  };
  return (
    <div className="card table-wrap">
      <table>
        <thead><tr><th>Book</th><th>Asked on</th><th>Status</th><th /></tr></thead>
        <tbody>
          {sum.reservations.map((r) => (
            <tr key={r._id}>
              <td><b>{r.book?.title}</b></td><td>{fmtDate(r.createdAt)}</td>
              <td>{r.status === 'ready' ? <span className="badge approved">Ready: collect it at the desk by {r.holdUntilDay}</span> : <span className="badge pending">Waiting · number {r.position} in the list</span>}</td>
              <td><button className="btn btn-small" onClick={() => cancel(r)}>Cancel</button></td>
            </tr>
          ))}
          {!sum.reservations.length && <tr><td colSpan={4} className="muted">You have no reservations. If every copy of a book is out, press Reserve in Search books.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function MyMessages({ fail }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { api.get('/library/me/messages').then((r) => setRows(r.data.data)).catch(fail); }, [fail]);
  if (!rows) return <div className="card muted">Loading...</div>;
  return (
    <div className="card table-wrap">
      <table>
        <thead><tr><th>When</th><th>About</th><th>Message</th><th>SMS</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x._id}><td>{fmtDateTime(x.at)}</td><td>{label(x.kind)}</td><td>{x.text}</td><td className="muted small">{SMS[x.sms] || x.sms}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="muted">No library messages yet. You will be told here (and by SMS) when a book is issued, when it is due and when it is overdue.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
function History({ sum }) {
  if (!sum) return <div className="card muted">Loading...</div>;
  return (
    <div className="card table-wrap">
      <p>Borrowed in total <b>{sum.totals.total}</b> · returned <b>{sum.totals.returned}</b> · lost <b>{sum.totals.lost}</b></p>
      <table>
        <thead><tr><th>Book</th><th>Issued</th><th>Return by</th><th>Returned</th><th>Status</th><th>Charges</th></tr></thead>
        <tbody>
          {sum.history.map((l) => (
            <tr key={l._id}>
              <td><b>{l.book?.title}</b><div className="muted small">{(l.book?.authors || []).join(', ')}</div></td>
              <td>{l.issuedDay}</td><td>{l.dueDay}</td><td>{l.returnedDay || '—'}</td><td><LoanState loan={l} /></td><td><Charges loan={l} /></td>
            </tr>
          ))}
          {!sum.history.length && <tr><td colSpan={6} className="muted">You have not returned any book yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
