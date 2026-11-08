import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, Tabs, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

const KIND = { bank: 'Bank account', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
const KIND_ICON = { bank: '🏦', jazzcash: '📱', easypaisa: '📱' };
const OFFICE_WAY = { cash: 'Cash', bank: 'Bank deposit', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
const SMS_TEXT = {
  sent: 'SMS sent to the student',
  no_phone: 'No mobile number, so no SMS',
  not_configured: 'SMS is not set up on the server (the student got the in-app notification)',
  failed: 'The SMS could not be sent',
};
const rangeTo = (n) => Array.from({ length: n + 1 }, (_, i) => i);

// Finance desk: payments to receive, office collection, payment accounts, verified payments, refunds, balances and reports.
// The University Head can look at everything here but cannot change anything.
export default function FinanceDesk() {
  const role = useSelector((s) => s.auth.user.role);
  const isFinance = role === 'finance_officer';
  const [msg, ok, fail] = useFlash();
  const [tab, setTab] = useState(isFinance ? 'bank' : 'payments');

  const tabs = [['payments', 'Payments'], ['outstanding', 'Outstanding balances'], ['report', 'Financial report']];
  tabs.unshift(['bank', 'Payments to receive']);
  if (isFinance) tabs.splice(1, 0, ['office', 'Pay at office'], ['accounts', 'Payment accounts']);

  return (
    <>
      <div className="row-between">
        <h1>Finance Desk</h1>
        <Link className="btn" to="/fee-reminders">⏰ Unpaid student lists</Link>
      </div>
      <Alert msg={msg} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'bank' && <ToReceive canReview={isFinance} ok={ok} fail={fail} />}
      {tab === 'payments' && <Payments canRefund={isFinance} ok={ok} fail={fail} />}
      {tab === 'office' && isFinance && <OfficePayment ok={ok} fail={fail} />}
      {tab === 'accounts' && isFinance && <Accounts ok={ok} fail={fail} />}
      {tab === 'outstanding' && <Outstanding fail={fail} />}
      {tab === 'report' && <Report fail={fail} />}
    </>
  );
}

// ---------- Online payments by transfer: bank account, JazzCash or EasyPaisa ----------
// The student first filled the requirements (mobile number, documents) and sent the money. Everything they typed is kept here, in the
// officer's file. The officer compares the payment with the account statement / wallet history, then presses Receive:
// the student gets the receipt, an in-app notification and an SMS. Or Reject with a reason (the student is told why).
function ToReceive({ canReview, ok, fail }) {
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
        ok(`Received. Receipt ${data.data.receiptNumber}. ${SMS_TEXT[data.data.smsStatus] || 'The student was notified'}.`);
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
        <input placeholder="Search name, roll number, email or transaction number..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">Waiting to be received</option>
          <option value="paid">Received</option>
          <option value="failed">Rejected</option>
          <option value="all">All</option>
        </select>
      </div>

      {action && (
        <form className="card" onSubmit={submit}>
          <h3>{action.kind === 'confirm' ? 'Receive this payment' : 'Reject this payment'}: {action.payment.student?.name} ({action.payment.rollNumber})</h3>
          <p className="muted">
            {KIND[action.payment.bank?.channel] || 'Transfer'} · to {action.payment.bank?.accountLabel} · reference <b>{action.payment.bank?.reference}</b> · due {money(action.payment.totalAmount, action.payment.currency)}
          </p>
          {action.kind === 'confirm' ? (
            <>
              <label>Amount you see in the account / wallet</label>
              <input type="number" required min={0} value={action.amount} onChange={(e) => setAction({ ...action, amount: e.target.value })} />
              <label>Note (optional)</label>
              <input value={action.text} onChange={(e) => setAction({ ...action, text: e.target.value })} />
              <p className="muted small">If the amount is different from the amount due, the server refuses. Reject it instead and tell the student what is missing.</p>
            </>
          ) : (
            <>
              <label>Reason (the student will read this)</label>
              <input required minLength={3} value={action.text} onChange={(e) => setAction({ ...action, text: e.target.value })} placeholder="e.g. We could not find this payment in the account" />
            </>
          )}
          <div className="actions">
            <button className={`btn ${action.kind === 'confirm' ? 'btn-primary' : 'btn-danger'} mt`} disabled={busy}>
              {action.kind === 'confirm' ? 'Receive: issue receipt, notify and send SMS' : 'Reject and notify student'}
            </button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setAction(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Sent</th><th>Student &amp; requirements</th><th>Fees</th><th>Amount</th><th>Paid into / from</th><th>Slip</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p._id}>
                <td>{fmtDateTime(p.bank?.submittedAt || p.createdAt)}<div className="muted small">paid on {p.bank?.transferDate ? fmtDate(p.bank.transferDate) : '—'}</div></td>
                <td>
                  {p.student?.name}
                  <div className="muted small">{p.rollNumber} · {p.student?.email}</div>
                  <div className="muted small">📱 {p.requirements?.phone || p.student?.phone || 'no number'}</div>
                  {p.requirements?.documents?.length > 0 && (
                    <div className="muted small">Documents: {p.requirements.documents.map((d) => `${d.type} (${String(d.status).replace(/_/g, ' ')})`).join(', ')}</div>
                  )}
                </td>
                <td className="small">{p.items.map((i) => i.title).join(', ')}</td>
                <td><b>{money(p.totalAmount, p.currency)}</b></td>
                <td>
                  {KIND_ICON[p.bank?.channel]} <b>{KIND[p.bank?.channel] || 'Transfer'}</b>
                  <div className="muted small">to {p.bank?.accountLabel}</div>
                  <div className="muted small">from {p.bank?.channel === 'bank' ? p.bank?.bankName : p.bank?.senderNumber}</div>
                  <div className="muted small">Ref {p.bank?.reference}</div>
                  {p.bank?.note && <div className="muted small">{p.bank.note}</div>}
                </td>
                <td>{p.bank?.proof?.storedName && <button className="btn btn-small" onClick={() => downloadSafe(`/payments/${p._id}/bank/proof`, p.bank.proof.originalName || 'slip', fail)}>View slip</button>}</td>
                <td>
                  <Badge value={p.status === 'failed' ? 'rejected' : p.status} text={p.status === 'pending' ? 'to receive' : p.status === 'paid' ? 'received' : 'rejected'} />
                  {p.status === 'failed' && <div className="muted small">{p.bank?.rejectReason}</div>}
                  {p.status === 'paid' && <div className="muted small">{p.receiptNumber}{p.smsStatus ? ` · ${SMS_TEXT[p.smsStatus]}` : ''}</div>}
                </td>
                <td className="actions">
                  {canReview && p.status === 'pending' && (
                    <>
                      <button className="btn btn-small btn-primary" onClick={() => setAction({ kind: 'confirm', payment: p, amount: p.totalAmount, text: '' })}>Receive</button>
                      <button className="btn btn-small btn-danger" onClick={() => setAction({ kind: 'reject', payment: p, text: '' })}>Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- The accounts students pay into ----------
// The finance officer adds bank accounts, JazzCash and EasyPaisa numbers. Students see only the active ones, with a copy button.
// An account that already received payments cannot be deleted; switch it off instead.
const EMPTY_ACCOUNT = { type: 'bank', title: '', number: '', bankName: '', iban: '', branch: '', instructions: '' };

function Accounts({ ok, fail }) {
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(null); // null | { ...fields, _id? }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/payments/bank-info').then((r) => setAccounts(r.data.data.accounts)).catch(fail);
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const isBank = form?.type === 'bank';

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { title: form.title, number: form.number, instructions: form.instructions };
      if (isBank) Object.assign(body, { bankName: form.bankName, iban: form.iban, branch: form.branch });
      if (form._id) await api.put(`/payments/accounts/${form._id}`, body);
      else await api.post('/payments/accounts', { type: form.type, ...body });
      ok(form._id ? 'Account saved' : 'Account added. Students can pay into it now');
      setForm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setBusy(false); }
  };

  const toggle = async (a) => {
    try { await api.patch(`/payments/accounts/${a._id}/active`, { active: !a.active }); load(); } catch (err) { fail(err); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete ${a.label}?\n\nIf students already paid into it, it cannot be deleted. Switch it off instead.`)) return;
    try { await api.delete(`/payments/accounts/${a._id}`); ok('Account deleted'); load(); } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="row-between">
        <p className="muted" style={{ margin: 0 }}>Students choose one of these when they pay by transfer. Only active accounts are shown to them.</p>
        <button className="btn btn-primary" onClick={() => { setError(''); setForm({ ...EMPTY_ACCOUNT }); }}>+ Add account</button>
      </div>

      {form && (
        <form className="card mt" onSubmit={save}>
          <h3>{form._id ? 'Edit account' : 'Add an account'}</h3>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div>
              <label>Type</label>
              <select disabled={!!form._id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="bank">🏦 Bank account</option>
                <option value="jazzcash">📱 JazzCash</option>
                <option value="easypaisa">📱 EasyPaisa</option>
              </select>
            </div>
            <div><label>Account title (name on the account)</label><input required minLength={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Smart Campus Fee Account" /></div>
            <div>
              <label>{isBank ? 'Account number' : `${KIND[form.type]} mobile number`}</label>
              <input required value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder={isBank ? '0123456789' : '0300 1234567'} />
            </div>
            {isBank && (
              <>
                <div><label>Bank name</label><input required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. HBL" /></div>
                <div><label>IBAN (optional)</label><input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
                <div><label>Branch (optional)</label><input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
              </>
            )}
          </div>
          <label>Instructions for students (optional)</label>
          <input value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="e.g. Write your roll number in the transfer note" />
          <div className="actions">
            <button className="btn btn-primary mt" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="dept-grid mt">
        {accounts.map((a) => (
          <div key={a._id} className="dept-card" style={{ cursor: 'default', opacity: a.active ? 1 : 0.6 }}>
            <div className="row-between" style={{ gap: '.5rem' }}>
              <span className="code">{KIND_ICON[a.type]} {KIND[a.type]}</span>
              <Badge value={a.active ? 'active' : 'archived'} text={a.active ? 'shown to students' : 'switched off'} />
            </div>
            <h3>{a.title}</h3>
            <div><b style={{ fontSize: '1.1rem' }}>{a.number}</b></div>
            {a.bankName && <div className="meta">{a.bankName}{a.branch ? ` · ${a.branch}` : ''}</div>}
            {a.iban && <div className="meta">IBAN {a.iban}</div>}
            {a.instructions && <div className="muted small">{a.instructions}</div>}
            <div className="actions" style={{ marginTop: '.6rem' }}>
              <button className="btn btn-small" onClick={() => { setError(''); setForm({ ...EMPTY_ACCOUNT, ...a }); }}>Edit</button>
              <button className="btn btn-small" onClick={() => toggle(a)}>{a.active ? 'Switch off' : 'Switch on'}</button>
              <button className="btn btn-small btn-danger" onClick={() => remove(a)}>Delete</button>
            </div>
          </div>
        ))}
        {!accounts.length && <div className="card empty-state"><div className="big">🏦</div>No account yet. Press "Add account" so students can pay by bank transfer, JazzCash or EasyPaisa.</div>}
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

  const how = (p) => {
    if (p.method === 'manual') {
      const way = OFFICE_WAY[p.office?.paidVia || 'cash'];
      return `Office · ${way}${p.office?.reference ? ` · ${p.office.reference}` : ''} (${p.collectedBy?.name || '—'})`;
    }
    if (p.method === 'bank') return `${KIND[p.bank?.channel] || 'Transfer'}${p.bank?.reference ? ` · ${p.bank.reference}` : ''}`;
    return 'Online card';
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
                <td className="small">{how(p)}</td>
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

// ---------- The student comes to the office ----------
// The officer finds the student, ticks the fees (and how many practicals), fills the same requirements form the student would fill
// online (mobile number for the SMS, documents handed over), says how the money arrived (cash, bank deposit, JazzCash or EasyPaisa
// with its transaction number) and records it. ONE amount, ONE receipt. The server records who collected it and when, and the student
// gets the same notification and SMS as after an online payment.
function OfficePayment({ ok, fail }) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [fees, setFees] = useState([]);
  const [picked, setPicked] = useState({}); // notice id -> number of practicals, for every ticked fee
  const [req, setReq] = useState(null); // requirements of the ticked fees
  const [phone, setPhone] = useState('');
  const [received, setReceived] = useState([]); // required documents the student handed over at the counter
  const [way, setWay] = useState('cash');
  const [reference, setReference] = useState('');
  const [payerName, setPayerName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [admKey, setAdmKey] = useState(0); // bumped after a payment so the exam admission panel reloads

  const find = async (e) => {
    e.preventDefault();
    try { setStudents((await api.get('/fees/students', { params: { search } })).data.data); } catch (err) { fail(err); }
  };

  const reset = () => { setStudent(null); setStudents([]); setPicked({}); setReq(null); setPhone(''); setReceived([]); setWay('cash'); setReference(''); setPayerName(''); setNote(''); setFees([]); };

  // After a payment the student stays selected, so the officer can apply for the exam admission right away.
  const afterPay = async () => {
    setPicked({}); setReq(null); setPhone(''); setReceived([]); setWay('cash'); setReference(''); setPayerName(''); setNote('');
    try { setFees((await api.get(`/fees/students/${student._id}/fees`)).data.data); } catch (err) { fail(err); }
    setAdmKey((k) => k + 1);
  };

  const choose = async (s) => {
    setStudent(s);
    setPicked({}); setReq(null); setPhone(''); setReceived([]);
    try { setFees((await api.get(`/fees/students/${s._id}/fees`)).data.data); } catch (err) { fail(err); }
  };

  const ids = Object.keys(picked).join(',');
  useEffect(() => {
    if (!student || !ids) { setReq(null); return; }
    api.get(`/fees/students/${student._id}/requirements`, { params: { notices: ids } }).then((r) => setReq(r.data.data)).catch(() => setReq(null));
  }, [student, ids]);

  const payable = fees.filter((f) => f.state === 'payable' || f.state === 'in_cart');
  const toggle = (id) => setPicked((p) => { const n = { ...p }; if (id in n) delete n[id]; else n[id] = 0; return n; });
  const tickDoc = (type) => setReceived((r) => (r.includes(type) ? r.filter((x) => x !== type) : [...r, type]));

  // Price shown to the officer. The server calculates it again when the payment is recorded.
  const priceOf = (f) => {
    const n = picked[f._id] ?? 0;
    const base = f.amount + n * (f.practicalFee || 0);
    const late = f.price?.phase === 'late' ? (f.lateFee || 0) + n * (f.practicalLateFee || 0) : 0;
    return { n, base, late, total: base + late };
  };
  const total = payable.filter((f) => f._id in picked).reduce((s, f) => s + priceOf(f).total, 0);
  const cur = fees[0]?.currency || '';

  const missingDocs = (req?.documents || []).filter((d) => d.status === 'missing');
  const docsOk = missingDocs.every((d) => received.includes(d.type));
  const savedPhone = req?.phone || '';

  const record = async () => {
    setBusy(true);
    try {
      const items = Object.entries(picked).map(([notice, practicals]) => ({ notice, practicals }));
      const body = { student: student._id, items, paidVia: way, note: note || undefined };
      if (way !== 'cash') { body.reference = reference; if (payerName) body.payerName = payerName; }
      if (phone.trim()) body.phone = phone.trim();
      if (received.length) body.receivedDocuments = received;
      const { data } = await api.post('/payments/manual', body);
      ok(`Payment recorded. Receipt ${data.data.receiptNumber}. ${SMS_TEXT[data.data.smsStatus] || 'The student was notified'}.`);
      afterPay();
    } catch (err) { fail(err); } finally { setBusy(false); }
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
            <button className="btn btn-ghost" onClick={reset}>Change student</button>
          </div>
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

          {Object.keys(picked).length > 0 && (
            <>
              <div className="sub-card" style={{ marginTop: '1rem' }}>
                <h4>1. Requirements</h4>
                <label>Student's mobile number (the confirmation SMS goes here)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={savedPhone ? `Saved: ${savedPhone}. Type only to change it` : '0300 1234567'} />
                {!savedPhone && !phone.trim() && <p className="muted small">This student has no phone number saved. Enter one so the SMS can be sent.</p>}
                {req?.text && <p className="muted small">Fee requirements: {req.text}</p>}
                {(req?.documents || []).map((d) => (
                  <div key={d.type} className="row-between" style={{ padding: '.25rem 0' }}>
                    <span>📄 {d.type}</span>
                    {d.status === 'missing' ? (
                      <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={received.includes(d.type)} onChange={() => tickDoc(d.type)} /> Received at the office</label>
                    ) : (
                      <span className="muted small">{d.status.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="sub-card" style={{ marginTop: '.8rem' }}>
                <h4>2. How was the money received?</h4>
                <div className="form-grid">
                  <div>
                    <label>Received by</label>
                    <select value={way} onChange={(e) => setWay(e.target.value)}>
                      {Object.entries(OFFICE_WAY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  {way !== 'cash' && (
                    <>
                      <div><label>Transaction / reference number</label><input required minLength={3} value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                      <div><label>Name of the person who paid (optional)</label><input value={payerName} onChange={(e) => setPayerName(e.target.value)} /></div>
                    </>
                  )}
                </div>
                <label>Note (optional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. cash received at counter 2" />
              </div>
            </>
          )}

          <div className="row-between" style={{ marginTop: '.8rem' }}><strong>Total to collect (one receipt)</strong><strong>{money(total, cur)}</strong></div>
          <button className="btn btn-primary" disabled={busy || !Object.keys(picked).length || !docsOk || (way !== 'cash' && reference.trim().length < 3)} onClick={record}>
            {busy ? 'Recording…' : 'Record payment, issue receipt and notify student'}
          </button>
          {!docsOk && <p className="muted small">Tick "Received at the office" for every missing document, or ask the student to bring them.</p>}

          <OfficeAdmission student={student} refreshKey={admKey} ok={ok} fail={fail} />
        </div>
      )}
    </>
  );
}

// ---------- Examination admission for a student who is at the office ----------
// A student who cannot use the online system pays here and does not need to log in afterwards: the officer applies for the exam
// admission for them. The HOD still reviews it (the server checks every rule again), and when it is approved the officer prints the
// admit card from here.
function OfficeAdmission({ student, refreshKey, ok, fail }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    api.get(`/admissions/student/${student._id}`).then((r) => setRows(r.data.data)).catch(fail);
  }, [student._id, fail]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const apply = async (examId) => {
    setBusy(examId);
    try {
      await api.post('/admissions/request-for', { student: student._id, examination: examId });
      ok('Admission requested for the student. The HOD will review it.');
      load();
    } catch (err) { fail(err); } finally { setBusy(''); }
  };

  if (!rows) return null;
  return (
    <div className="sub-card" style={{ marginTop: '1rem' }}>
      <h4>Examination admission for {student.name}</h4>
      {!rows.length && <p className="muted">No examination is open for this student's semester.</p>}
      {rows.map((r) => {
        const status = r.admission?.status;
        const canApply = !status || ['requires_correction', 'rejected'].includes(status);
        return (
          <div key={r.examination._id} style={{ padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row-between">
              <b>{r.examination.name}</b>
              {status ? <Badge value={status} text={status.replace(/_/g, ' ')} /> : <Badge value="upcoming" text="not requested" />}
            </div>
            <ul style={{ margin: '.3rem 0' }}>
              {r.checks.map((c) => <li key={c.key}>{c.passed ? '✅' : '❌'} {c.label} <span className="muted small">— {c.detail}</span></li>)}
            </ul>
            {r.admission?.reason && status !== 'approved' && <p className="muted small">{r.admission.reason}</p>}
            <div className="actions">
              {canApply && <button className="btn btn-small btn-primary" disabled={!r.allPassed || busy === r.examination._id} onClick={() => apply(r.examination._id)}>Apply for the student</button>}
              {status === 'pending' && <span className="muted small">Waiting for the HOD to review.</span>}
              {status === 'approved' && <button className="btn btn-small btn-primary" onClick={() => downloadSafe(`/admissions/${r.admission._id}/admit-card`, 'AdmitCard.pdf', fail)}>Print admit card</button>}
            </div>
            {canApply && !r.allPassed && <p className="muted small">The student must meet every requirement first. {r.reason}</p>}
          </div>
        );
      })}
    </div>
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
            <div className="card stat"><span>{money(data.collected.online.amount)}</span>Online card ({data.collected.online.count})</div>
            <div className="card stat"><span>{money(data.collected.bank?.amount)}</span>Bank / JazzCash / EasyPaisa ({data.collected.bank?.count || 0})</div>
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
