import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, Tabs, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

const METHOD = { gateway: 'Online', bank: 'Bank transfer', manual: 'Office' };
const rangeTo = (n) => Array.from({ length: n + 1 }, (_, i) => i);

// Finance desk: bank transfers to check, office collection, verified payments, refunds, outstanding balances and reports.
// The University Head can look at payments, outstanding balances and reports, but cannot change anything.
export default function FinanceDesk() {
  const role = useSelector((s) => s.auth.user.role);
  const isFinance = role === 'finance_officer';
  const [msg, ok, fail] = useFlash();
  const [tab, setTab] = useState(isFinance ? 'bank' : 'payments');

  const tabs = [['payments', 'Payments'], ['outstanding', 'Outstanding balances'], ['report', 'Financial report']];
  tabs.unshift(['bank', 'Bank transfers']);
  if (isFinance) tabs.splice(1, 0, ['office', 'Office payment']);

  return (
    <>
      <h1>Finance Desk</h1>
      <Alert msg={msg} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'bank' && <BankTransfers canReview={isFinance} ok={ok} fail={fail} />}
      {tab === 'payments' && <Payments canRefund={isFinance} ok={ok} fail={fail} />}
      {tab === 'office' && isFinance && <OfficePayment ok={ok} fail={fail} />}
      {tab === 'outstanding' && <Outstanding fail={fail} />}
      {tab === 'report' && <Report fail={fail} />}
    </>
  );
}

// ---------- Way 2: money the students sent to the university bank account ----------
// The officer compares each transfer with the bank statement, then presses Received (the student gets a receipt, a
// notification and an SMS when SMS is set up) or Reject with a reason (the student is told why).
function BankTransfers({ canReview, ok, fail }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState(null); // { kind: 'confirm' | 'reject', payment, amount, text }
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = { status };
    if (search.trim().length >= 2) params.search = search.trim();
    api.get('/payments/bank', { params }).then((r) => setRows(r.data.data)).catch(fail);
  }, [status, search, fail]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (action.kind === 'confirm') {
        const body = { receivedAmount: Number(action.amount) };
        if (action.text) body.note = action.text;
        const { data } = await api.post(`/payments/${action.payment._id}/bank/confirm`, body);
        ok(`Received. Receipt ${data.data.receiptNumber}. The student was notified.`);
      } else {
        await api.post(`/payments/${action.payment._id}/bank/reject`, { reason: action.text });
        ok('Rejected. The student was told why.');
      }
      setAction(null);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="card filters">
        <input placeholder="Search name, roll number or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Waiting to be checked</option>
          <option value="paid">Received</option>
          <option value="failed">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {action && (
        <form className="card" onSubmit={submit}>
          <h3>{action.kind === 'confirm' ? 'Mark as received' : 'Reject this transfer'}: {action.payment.student?.name} ({action.payment.rollNumber})</h3>
          <p className="muted">Reference <b>{action.payment.bank?.reference}</b> · {action.payment.bank?.bankName} · due {money(action.payment.totalAmount, action.payment.currency)}</p>
          {action.kind === 'confirm' ? (
            <>
              <label>Amount shown in the bank statement</label>
              <input type="number" required min={0} value={action.amount} onChange={(e) => setAction({ ...action, amount: e.target.value })} />
              <label>Note (optional)</label>
              <input value={action.text} onChange={(e) => setAction({ ...action, text: e.target.value })} />
              <p className="muted small">If the statement amount is different from the amount due, the server refuses. Reject it instead and tell the student what is missing.</p>
            </>
          ) : (
            <>
              <label>Reason (the student will read this)</label>
              <input required minLength={3} value={action.text} onChange={(e) => setAction({ ...action, text: e.target.value })} placeholder="e.g. We could not find this transfer in the bank statement" />
            </>
          )}
          <div className="actions">
            <button className={`btn ${action.kind === 'confirm' ? 'btn-primary' : 'btn-danger'} mt`} disabled={busy}>
              {action.kind === 'confirm' ? 'Received: issue receipt and notify student' : 'Reject and notify student'}
            </button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setAction(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Sent</th><th>Student</th><th>Fees</th><th>Amount</th><th>Bank &amp; reference</th><th>Slip</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td>{fmtDateTime(p.bank?.submittedAt || p.createdAt)}<div className="muted small">transfer {p.bank?.transferDate ? fmtDate(p.bank.transferDate) : '—'}</div></td>
                <td>{p.student?.name}<div className="muted small">{p.rollNumber} · {p.student?.email}</div></td>
                <td className="small">{p.items.map((i) => i.title).join(', ')}</td>
                <td><b>{money(p.totalAmount, p.currency)}</b></td>
                <td>{p.bank?.bankName}<div className="muted small">Ref {p.bank?.reference}</div>{p.bank?.note && <div className="muted small">{p.bank.note}</div>}</td>
                <td>{p.bank?.proof?.storedName && <button className="btn btn-small" onClick={() => downloadSafe(`/payments/${p._id}/bank/proof`, p.bank.proof.originalName || 'slip', fail)}>View slip</button>}</td>
                <td>
                  <Badge value={p.status === 'failed' ? 'rejected' : p.status} text={p.status === 'pending' ? 'to check' : p.status === 'paid' ? 'received' : 'rejected'} />
                  {p.status === 'failed' && <div className="muted small">{p.bank?.rejectReason}</div>}
                  {p.status === 'paid' && <div className="muted small">{p.receiptNumber}</div>}
                </td>
                <td className="actions">
                  {canReview && p.status === 'pending' && (
                    <>
                      <button className="btn btn-small btn-primary" onClick={() => setAction({ kind: 'confirm', payment: p, amount: p.totalAmount, text: '' })}>Received</button>
                      <button className="btn btn-small btn-danger" onClick={() => setAction({ kind: 'reject', payment: p, text: '' })}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">No bank transfers here.</td></tr>}
          </tbody>
        </table>
      </div>
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
                <td>{p.method === 'manual' ? `Office (${p.collectedBy?.name || '—'})` : p.method === 'bank' ? `Bank transfer${p.bank?.reference ? ` · ${p.bank.reference}` : ''}` : 'Online'}</td>
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

// Way 3: the student stands at the counter. The officer finds them by roll number, email or name, picks the fees (and how
// many practicals) and records the cash. ONE amount is charged. The server records who collected it, the amount, the
// receipt number and the date, and the student gets a notification (and an SMS when SMS is set up), like an online payment.
function OfficePayment({ ok, fail }) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [picked, setPicked] = useState({}); // notice id -> number of practicals, for every ticked fee
  const [note, setNote] = useState('');

  const find = async (e) => {
    e.preventDefault();
    try { setStudents((await api.get('/fees/students', { params: { search } })).data.data); } catch (err) { fail(err); }
  };

  const choose = async (s) => {
    setStudent(s);
    setPicked({});
    try { setFees((await api.get(`/fees/students/${s._id}/fees`)).data.data); } catch (err) { fail(err); }
  };

  const payable = fees.filter((f) => f.state === 'payable' || f.state === 'in_cart');
  const toggle = (id) => setPicked((p) => { const n = { ...p }; if (id in n) delete n[id]; else n[id] = 0; return n; });

  // Price shown to the officer. The server calculates it again when the payment is recorded.
  const priceOf = (f) => {
    const n = picked[f._id] ?? 0;
    const base = f.amount + n * (f.practicalFee || 0);
    const late = f.price?.phase === 'late' ? (f.lateFee || 0) + n * (f.practicalLateFee || 0) : 0;
    return { n, base, late, total: base + late };
  };
  const total = payable.filter((f) => f._id in picked).reduce((s, f) => s + priceOf(f).total, 0);
  const cur = fees[0]?.currency || '';

  const record = async () => {
    try {
      const items = Object.entries(picked).map(([notice, practicals]) => ({ notice, practicals }));
      const { data } = await api.post('/payments/manual', { student: student._id, items, note: note || undefined });
      ok(`Payment recorded. Receipt ${data.data.receiptNumber}. The student was notified${student.hasPhone ? ' by notification and SMS' : ''}.`);
      setStudent(null); setStudents([]); setPicked({}); setNote(''); setFees([]);
    } catch (err) { fail(err); }
  };

  return (
    <>
      <form className="card inline-form" onSubmit={find}>
        <div><label>Find the student (roll number, email or name)</label><input required minLength={2} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. CS-2024-001 or student@university.edu" /></div>
        <button className="btn btn-primary inline">Search</button>
      </form>

      {!student && students.length > 0 && (
        <div className="card table-wrap">
          <table>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td>{s.rollNumber}</td><td>{s.name}<div className="muted small">{s.email}</div></td><td>{s.department?.code} · {s.semester?.name || 'not placed'}</td>
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
            <h3>{student.name} <span className="muted small">{student.rollNumber} · {student.email}</span></h3>
            <button className="btn btn-ghost" onClick={() => setStudent(null)}>Change student</button>
          </div>
          {!student.hasPhone && <div className="alert alert-info">This student has no phone number saved, so no SMS can be sent. They will still get an in-app notification.</div>}
          {!payable.length && <p className="muted">This student has no open fee to pay.</p>}
          {payable.map((f) => {
            const on = f._id in picked;
            const p = priceOf(f);
            return (
              <div key={f._id} className="row-between" style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <label className="check" style={{ margin: 0 }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(f._id)} />
                  <span>
                    {f.title} <span className="muted small">({f.semester?.name} · due {fmtDate(f.dueDate)}{f.price?.phase === 'late' ? ' · LATE' : ''})</span>
                    <div className="muted small">
                      Fee {money(f.amount, cur)}{p.n > 0 && <> + {p.n} practical{p.n === 1 ? '' : 's'} x {money(f.practicalFee, cur)}</>}{p.late > 0 && <> + late fee {money(p.late, cur)}</>}
                    </div>
                  </span>
                </label>
                <div className="actions">
                  {on && f.practicalFee > 0 && (
                    <select style={{ width: 'auto' }} value={picked[f._id]} onChange={(e) => setPicked({ ...picked, [f._id]: Number(e.target.value) })}>
                      {rangeTo(f.maxPracticals ?? 3).map((n) => <option key={n} value={n}>{n} practical{n === 1 ? '' : 's'}</option>)}
                    </select>
                  )}
                  <b>{money(p.total, cur)}</b>
                </div>
              </div>
            );
          })}
          {payable.some((f) => f.state === 'in_cart') && <p className="muted small">Fees already in the student's online cart can be paid here too.</p>}
          <div className="row-between" style={{ marginTop: '.8rem' }}><strong>Total to collect (one receipt)</strong><strong>{money(total, cur)}</strong></div>
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cash received at counter 2" />
          <button className="btn btn-primary" disabled={!Object.keys(picked).length} onClick={record}>Record payment, issue receipt and notify student</button>
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
            <div className="card stat"><span>{money(data.collected.bank?.amount)}</span>Bank transfer ({data.collected.bank?.count || 0})</div>
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
