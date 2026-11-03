import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, Tabs, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

// Finance desk: verified payments, office collection, refunds, outstanding balances and financial reports.
// The University Head can look at payments, outstanding balances and reports, but cannot change anything.
export default function FinanceDesk() {
  const role = useSelector((s) => s.auth.user.role);
  const isFinance = role === 'finance_officer';
  const [msg, ok, fail] = useFlash();
  const [tab, setTab] = useState('payments');

  const tabs = [['payments', 'Payments'], ['outstanding', 'Outstanding balances'], ['report', 'Financial report']];
  if (isFinance) tabs.splice(1, 0, ['office', 'Office payment']);

  return (
    <>
      <h1>Finance Desk</h1>
      <Alert msg={msg} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'payments' && <Payments canRefund={isFinance} ok={ok} fail={fail} />}
      {tab === 'office' && isFinance && <OfficePayment ok={ok} fail={fail} />}
      {tab === 'outstanding' && <Outstanding fail={fail} />}
      {tab === 'report' && <Report fail={fail} />}
    </>
  );
}

function Payments({ canRefund, ok, fail }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [refund, setRefund] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (search.trim().length >= 2) params.search = search.trim();
    if (status) params.status = status;
    api.get('/payments', { params }).then((r) => setRows(r.data.data)).catch(fail);
  }, [search, status, fail]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const doRefund = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/payments/${refund.payment._id}/refund`, { reason: refund.reason });
      ok('Refund recorded');
      setRefund(null);
      load();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="card filters">
        <input placeholder="Search student name or roll number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Paid and refunded</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending (not verified)</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {refund && (
        <form className="card" onSubmit={doRefund}>
          <h3>Refund receipt {refund.payment.receiptNumber}</h3>
          <p>{refund.payment.student?.name}: {money(refund.payment.totalAmount, refund.payment.currency)}</p>
          <label>Reason</label>
          <input required minLength={3} value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
          <div className="actions">
            <button className="btn btn-danger mt">Confirm refund</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setRefund(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Student</th><th>Items</th><th>Total</th><th>Method</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td>{fmtDateTime(p.paidAt || p.createdAt)}</td>
                <td>{p.receiptNumber || '—'}</td>
                <td>{p.student?.name}<div className="muted small">{p.rollNumber}</div></td>
                <td className="small">{p.items.map((i) => i.title).join(', ')}</td>
                <td>{money(p.totalAmount, p.currency)}{p.items.some((i) => i.lateFee > 0) && <div className="muted small">incl. late fee</div>}</td>
                <td>{p.method === 'manual' ? `Office (${p.collectedBy?.name || '—'})` : 'Online'}</td>
                <td><Badge value={p.status} /></td>
                <td className="actions">
                  {['paid', 'refunded'].includes(p.status) && <button className="btn btn-small" onClick={() => downloadSafe(`/payments/${p._id}/receipt`, `${p.receiptNumber}.pdf`, fail)}>Receipt</button>}
                  {canRefund && p.status === 'paid' && <button className="btn btn-small btn-danger" onClick={() => setRefund({ payment: p, reason: '' })}>Refund</button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">No payments found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// An employee takes money at the office. The server records who collected it, the amount, the receipt number and the date.
function OfficePayment({ ok, fail }) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [notices, setNotices] = useState([]);
  const [picked, setPicked] = useState([]);
  const [note, setNote] = useState('');

  const find = async (e) => {
    e.preventDefault();
    try { setStudents((await api.get('/fees/students', { params: { search } })).data.data); } catch (err) { fail(err); }
  };

  const choose = async (s) => {
    setStudent(s);
    setPicked([]);
    try {
      const params = { status: 'published' };
      if (s.semester?._id) params.semester = s.semester._id;
      if (s.department?._id) params.department = s.department._id;
      setNotices((await api.get('/fees/notices', { params })).data.data);
    } catch (err) { fail(err); }
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const record = async () => {
    try {
      const { data } = await api.post('/payments/manual', { student: student._id, notices: picked, note: note || undefined });
      ok(`Payment recorded. Receipt ${data.data.receiptNumber}`);
      setStudent(null); setStudents([]); setPicked([]); setNote('');
    } catch (err) { fail(err); }
  };

  return (
    <>
      <form className="card inline-form" onSubmit={find}>
        <div><label>Find student (name or roll number)</label><input required minLength={2} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <button className="btn btn-primary inline">Search</button>
      </form>

      {!student && students.length > 0 && (
        <div className="card table-wrap">
          <table>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td>{s.rollNumber}</td><td>{s.name}</td><td>{s.department?.code} · {s.semester?.name || 'not placed'}</td>
                  <td><button className="btn btn-small" onClick={() => choose(s)}>Select</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {student && (
        <div className="card">
          <div className="row-between">
            <h3>{student.name} <span className="muted small">{student.rollNumber}</span></h3>
            <button className="btn btn-ghost" onClick={() => setStudent(null)}>Change student</button>
          </div>
          {!notices.length && <p className="muted">No published fee notice for this student's semester.</p>}
          {notices.map((n) => (
            <label key={n._id} className="check">
              <input type="checkbox" checked={picked.includes(n._id)} onChange={() => toggle(n._id)} />
              {n.title} — {money(n.amount)} <span className="muted small">&nbsp;(due {fmtDate(n.dueDate)}; late fee is added by the server if late)</span>
            </label>
          ))}
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cash received at counter 2" />
          <button className="btn btn-primary" disabled={!picked.length} onClick={record}>Record payment and issue receipt</button>
        </div>
      )}
    </>
  );
}

function Outstanding({ fail }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get('/fees/outstanding').then((r) => setRows(r.data.data)).catch(fail); }, [fail]);
  return (
    <div className="card table-wrap">
      <table>
        <thead><tr><th>Fee</th><th>Dept</th><th>Semester</th><th>Students</th><th>Paid</th><th>Unpaid</th><th>Collected</th><th>Outstanding</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.notice._id}>
              <td>{r.notice.title}</td><td>{r.notice.department?.code}</td><td>{r.notice.semester?.name}</td>
              <td>{r.students}</td><td>{r.paid}</td><td>{r.unpaid}</td>
              <td>{money(r.collected)}</td><td>{money(r.outstandingAmount)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={8} className="muted">No published fee notices.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Report({ fail }) {
  const [range, setRange] = useState({ from: '', to: '' });
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (range.from) params.from = range.from;
    if (range.to) params.to = range.to;
    api.get('/fees/report', { params }).then((r) => setData(r.data.data)).catch(fail);
  }, [range, fail]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="card filters">
        <div><label>From</label><input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label>To</label><input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
      </div>
      {data && (
        <>
          <div className="grid">
            <div className="card stat"><span>{money(data.collected.online.amount)}</span>Online ({data.collected.online.count})</div>
            <div className="card stat"><span>{money(data.collected.office.amount)}</span>At the office ({data.collected.office.count})</div>
            <div className="card stat"><span>{money(data.lateFeesCollected)}</span>Late fees collected</div>
            <div className="card stat"><span>{money(data.refunded.amount)}</span>Refunded ({data.refunded.count})</div>
          </div>
          <div className="cols-2">
            <div className="card table-wrap">
              <h3>By department</h3>
              <table>
                <tbody>
                  {data.byDepartment.map((d) => <tr key={d._id}><td>{d.department || '—'}</td><td>{d.count} payments</td><td className="right">{money(d.amount)}</td></tr>)}
                  {!data.byDepartment.length && <tr><td className="muted">No data.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="card table-wrap">
              <h3>By month</h3>
              <table>
                <tbody>
                  {data.byMonth.map((m) => <tr key={m.month}><td>{m.month}</td><td>{m.count} payments</td><td className="right">{money(m.amount)}</td></tr>)}
                  {!data.byMonth.length && <tr><td className="muted">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
