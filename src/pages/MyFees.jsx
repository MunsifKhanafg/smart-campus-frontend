import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import RequirementDocs from '../components/RequirementDocs.jsx';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

const METHOD = { gateway: 'Online card', bank: 'Transfer', manual: 'At the office' };
const CHANNEL = { bank: 'Bank account', jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
const CHANNEL_ICON = { bank: '🏦', jazzcash: '📱', easypaisa: '📱' };
const DOC_TEXT = { approved: 'approved', pending: 'uploaded, waiting for review', requires_correction: 'needs correction', rejected: 'rejected', received_at_office: 'received at the office', missing: 'not uploaded yet' };

// "Exam fee 5000 + 2 practicals x 1000 + late fee 500 = 7500" - one amount, one payment.
function Breakdown({ price, cur }) {
  if (!price) return null;
  return (
    <div className="muted small">
      Fee {money(price.examAmount, cur)}
      {price.practicals > 0 && <> + {price.practicals} practical{price.practicals === 1 ? '' : 's'} = {money(price.practicalAmount, cur)}</>}
      {price.lateFee > 0 && <> + late fee {money(price.lateFee, cur)}</>}
    </div>
  );
}

const rangeTo = (n) => Array.from({ length: n + 1 }, (_, i) => i);

// Student: fee obligations, fee cart, the requirements form, three ways to pay (online, transfer to a bank / JazzCash / EasyPaisa
// account, or cash at the office), payment history and receipts. The finance office confirms transfers; the student then gets
// a notification and an SMS.
export default function MyFees() {
  const [msg, ok, fail] = useFlash();
  const [fees, setFees] = useState([]);
  const [cart, setCart] = useState({ items: [], total: 0, currency: '' });
  const [payments, setPayments] = useState([]);
  const [pick, setPick] = useState({}); // practicals chosen for each fee before adding it to the cart
  const [busy, setBusy] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [req, setReq] = useState(null); // requirements of the fees in the cart: phone + documents
  const [phone, setPhone] = useState('');

  const load = useCallback(() => {
    api.get('/fees/mine').then((r) => setFees(r.data.data)).catch(fail);
    api.get('/fees/cart').then((r) => setCart(r.data.data)).catch(() => {});
    api.get('/payments/mine').then((r) => setPayments(r.data.data)).catch(() => {});
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  // The requirements follow the cart: whenever the fees in the cart change, ask the server what they need.
  const cartKey = cart.items.map((i) => i.notice).join(',');
  useEffect(() => {
    if (!cartKey) { setReq(null); return; }
    api.get('/fees/requirements').then((r) => { setReq(r.data.data); setPhone((p) => p || r.data.data.phone || ''); }).catch(() => setReq(null));
  }, [cartKey]);

  const add = async (f, practicals) => {
    try { setCart((await api.post('/fees/cart', { notice: f._id ?? f.notice, practicals })).data.data); load(); } catch (err) { fail(err); }
  };
  const remove = async (id) => { try { setCart((await api.delete(`/fees/cart/${id}`)).data.data); load(); } catch (err) { fail(err); } };

  const missing = req?.missing || [];
  const phoneOk = /^(\+92|0092|0)?3\d{9}$/.test(phone.replace(/[\s-]/g, ''));
  const ready = missing.length === 0 && phoneOk;

  const checkout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/payments/checkout', { phone: phone.trim() });
      const url = data.data.checkoutUrl;
      // Only follow a page of this site or an https gateway page. Never a javascript: or other odd address.
      const sameSite = typeof url === 'string' && ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith(window.location.origin));
      if (!sameSite && !(typeof url === 'string' && url.startsWith('https://'))) throw new Error('The payment page address is not valid');
      window.location.href = url; // gateway page. Card details never touch our server
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const cur = cart.currency || fees[0]?.currency || '';
  const STATE = { paid: 'paid', in_cart: 'scheduled', payable: 'open', not_started: 'upcoming', expired: 'closed', bank_pending: 'pending' };
  const STATE_TEXT = { bank_pending: 'transfer being checked' };
  const payable = cart.items.filter((i) => ['normal', 'late'].includes(i.phase));

  return (
    <>
      <h1>Fees and Payments</h1>
      <Alert msg={msg} />

      <div className="card table-wrap">
        <h3>My fees</h3>
        <table>
          <thead><tr><th>Fee</th><th>Semester</th><th>Due</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {fees.map((f) => {
              const hasPracticals = f.practicalFee > 0;
              const max = f.maxPracticals ?? 3;
              const chosen = pick[f._id] ?? f.practicalsInCart ?? 0;
              const canAdd = f.state === 'payable' || f.state === 'in_cart';
              return (
                <tr key={f._id}>
                  <td>
                    {f.title}
                    {f.examination && <div className="muted small">{f.examination.name}</div>}
                    {hasPracticals && <div className="muted small">Each practical adds {money(f.practicalFee, cur)}</div>}
                    {f.requirements && <div className="muted small">Requirements: {f.requirements}</div>}
                    {f.requiredDocuments?.length > 0 && <div className="muted small">Documents: {f.requiredDocuments.join(', ')}</div>}
                  </td>
                  <td>{f.semester?.name}</td>
                  <td>{fmtDate(f.dueDate)}{f.lateDueDate && <div className="muted small">late until {fmtDate(f.lateDueDate)} (+{money(f.lateFee, cur)}{hasPracticals && f.practicalLateFee > 0 ? ` + ${money(f.practicalLateFee, cur)} per practical` : ''})</div>}</td>
                  <td>
                    {f.price ? money(f.price.total, cur) : '—'}
                    <Breakdown price={f.price} cur={cur} />
                  </td>
                  <td><Badge value={STATE[f.state]} text={STATE_TEXT[f.state] || f.state.replace('_', ' ')} /></td>
                  <td className="actions">
                    {canAdd && hasPracticals && (
                      <select style={{ width: 'auto' }} value={chosen} onChange={(e) => setPick({ ...pick, [f._id]: Number(e.target.value) })} title="How many practicals do you have?">
                        {rangeTo(max).map((n) => <option key={n} value={n}>{n} practical{n === 1 ? '' : 's'}</option>)}
                      </select>
                    )}
                    {canAdd && <button className="btn btn-small btn-primary" onClick={() => add(f, hasPracticals ? chosen : 0)}>{f.state === 'in_cart' ? 'Update cart' : 'Add to cart'}</button>}
                    {f.state === 'in_cart' && <button className="btn btn-small" onClick={() => remove(f._id)}>Remove</button>}
                  </td>
                </tr>
              );
            })}
            {!fees.length && <tr><td colSpan={6} className="muted">No fee notice has been published for you.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Fee cart</h3>
        {!cart.items.length && <p className="muted">Your cart is empty.</p>}
        {cart.items.map((i) => (
          <div className="row-between" key={i.notice} style={{ padding: '.4rem 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <b>{i.title}</b>{' '}
              {i.phase === 'late' && <Badge value="late" text="late fee applies" />}
              {!['normal', 'late'].includes(i.phase) && <Badge value="closed" text="cannot be paid" />}
              <Breakdown price={i} cur={cur} />
            </div>
            <div className="actions">
              {i.practicalFee > 0 && (
                <select style={{ width: 'auto' }} value={i.practicals} onChange={(e) => add(i, Number(e.target.value))} title="Number of practicals">
                  {rangeTo(i.maxPracticals ?? 3).map((n) => <option key={n} value={n}>{n} practical{n === 1 ? '' : 's'}</option>)}
                </select>
              )}
              <b>{money(i.total, cur)}</b>
              <button className="btn btn-small" onClick={() => remove(i.notice)}>Remove</button>
            </div>
          </div>
        ))}

        {cart.items.length > 0 && (
          <>
            <div className="row-between" style={{ marginTop: '.8rem' }}><strong>Total payable (one payment)</strong><strong>{money(cart.total, cur)}</strong></div>

            {/* Step 1: the requirements. They are saved on the payment, in the finance officer's file. */}
            <div className="sub-card" style={{ marginTop: '.8rem' }}>
              <h4>Step 1: requirements</h4>
              <label>Your mobile number (the payment confirmation SMS is sent here)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" />
              {phone && !phoneOk && <p className="small" style={{ color: '#b91c1c' }}>Enter a valid mobile number, for example 0300 1234567.</p>}
              {req?.text && <p className="muted small">Fee requirements: {req.text}</p>}
              <RequirementDocs documents={req?.documents || []} ok={ok} fail={fail} onUploaded={() => api.get('/fees/requirements').then((r) => setReq(r.data.data))} />
              {[].map((d) => (
                <div key={d.type} className="row-between" style={{ padding: '.2rem 0' }}>
                  <span>📄 {d.type}</span>
                  <span className={`badge ${d.status === 'missing' ? 'rejected' : d.status === 'approved' ? 'approved' : 'pending'}`}>{DOC_TEXT[d.status] || d.status}</span>
                </div>
              ))}
              {missing.length > 0 && (
                <div className="alert alert-info" style={{ marginTop: '.5rem' }}>
                  Upload {missing.join(', ')} above, then pay.
                </div>
              )}
            </div>

            {/* Step 2: pay */}
            <div className="actions" style={{ marginTop: '.8rem' }}>
              <button className="btn btn-primary" style={{ marginTop: 0 }} disabled={busy || cart.total <= 0 || !ready} onClick={checkout}>{busy ? 'Opening payment page…' : '💳 Pay online by card'}</button>
              <button className="btn" disabled={cart.total <= 0 || !ready} onClick={() => setBankOpen(!bankOpen)}>🏦 Pay by bank, JazzCash or EasyPaisa</button>
            </div>
            <p className="muted small">
              The exam fee and the practical fees are added into ONE amount. The server calculates the final price, including any late fee, again when you pay.
              When the finance office receives your payment you get a notification and an SMS. You can also pay at the finance office with your roll number:
              the officer fills in the same requirements for you.
            </p>
            {bankOpen && <BankTransfer lines={payable} total={cart.total} cur={cur} phone={phone} ok={ok} fail={fail} done={() => { setBankOpen(false); load(); }} />}
          </>
        )}
      </div>

      <div className="card table-wrap">
        <h3>Payment history</h3>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Items</th><th>Total</th><th>How</th><th>Status</th><th /></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id}>
                <td>{fmtDateTime(p.paidAt || p.createdAt)}</td>
                <td>{p.receiptNumber || '—'}</td>
                <td className="small">{p.items.map((i) => `${i.title}${i.lateFee ? ` (+${i.lateFee} late)` : ''}`).join(', ')}</td>
                <td>{money(p.totalAmount, p.currency)}</td>
                <td>
                  {p.method === 'bank' ? `${CHANNEL_ICON[p.bank?.channel] || ''} ${CHANNEL[p.bank?.channel] || 'Transfer'}` : METHOD[p.method] || p.method}
                  {p.method === 'bank' && p.bank?.accountLabel && <div className="muted small">to {p.bank.accountLabel}</div>}
                </td>
                <td>
                  {p.method === 'bank' && p.status === 'pending' && <><Badge value="pending" text="waiting for the finance office" /><div className="muted small">Ref {p.bank?.reference}</div></>}
                  {p.method === 'bank' && p.status === 'failed' && <><Badge value="rejected" text="not accepted" /><div className="muted small">{p.bank?.rejectReason || p.failureReason}</div></>}
                  {!(p.method === 'bank' && ['pending', 'failed'].includes(p.status)) && <Badge value={p.status} />}
                </td>
                <td>{(p.status === 'paid' || p.status === 'refunded') && <button className="btn btn-small" onClick={() => downloadSafe(`/payments/${p._id}/receipt`, `${p.receiptNumber || 'receipt'}.pdf`, fail)}>Receipt</button>}</td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={7} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Way 2: send the money to one of the university's accounts (bank, JazzCash or EasyPaisa), then tell the finance office the details
// and attach the slip or screenshot. Nothing is paid until a finance officer sees the money and presses Receive.
function BankTransfer({ lines, total, cur, phone, ok, fail, done }) {
  const [accounts, setAccounts] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [form, setForm] = useState({ bankName: '', senderNumber: '', reference: '', transferDate: new Date().toISOString().slice(0, 10), note: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/payments/bank-info').then((r) => {
      setAccounts(r.data.data.accounts);
      if (r.data.data.accounts.length === 1) setAccountId(r.data.data.accounts[0]._id);
    }).catch(fail);
  }, [fail]);

  const account = accounts?.find((a) => a._id === accountId);
  const copy = (text) => navigator.clipboard?.writeText(text).then(() => ok(`Copied: ${text}`)).catch(() => {});

  const send = async (e) => {
    e.preventDefault();
    if (!account) return fail('Choose the account you sent the money to');
    if (!file) return fail('Please attach a photo or PDF of the slip or the screenshot');
    const fd = new FormData();
    fd.append('items', JSON.stringify(lines.map((i) => ({ notice: i.notice, practicals: i.practicals || 0 }))));
    fd.append('accountId', account._id);
    if (account.type === 'bank') fd.append('bankName', form.bankName);
    else fd.append('senderNumber', form.senderNumber);
    fd.append('phone', phone.trim());
    fd.append('reference', form.reference);
    fd.append('transferDate', form.transferDate);
    if (form.note) fd.append('note', form.note);
    fd.append('files', file);
    setBusy(true);
    try {
      await api.post('/payments/bank', fd);
      ok('Your payment details were sent to the finance office. You will get a notification and an SMS when it is received.');
      done();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <form className="sub-card" onSubmit={send} style={{ marginTop: '.8rem' }}>
      <h4>Step 2: pay into a university account</h4>
      {!accounts && <p className="muted">Loading the accounts…</p>}
      {accounts && !accounts.length && <div className="alert alert-info">The finance office has not added a payment account yet. Please pay online by card or at the office.</div>}

      {accounts?.length > 0 && (
        <>
          <p>Send exactly <b>{money(total, cur)}</b> to one of these accounts, then fill in the details below.</p>
          <div className="dept-grid">
            {accounts.map((a) => (
              <div key={a._id} className="dept-card" role="button" tabIndex={0} onClick={() => setAccountId(a._id)} onKeyDown={(e) => e.key === 'Enter' && setAccountId(a._id)}
                style={{ cursor: 'pointer', outline: accountId === a._id ? '2px solid #4f46e5' : 'none' }}>
                <span className="code">{CHANNEL_ICON[a.type]} {CHANNEL[a.type]}</span>
                <h3>{a.title}</h3>
                <div><b style={{ fontSize: '1.1rem' }}>{a.number}</b> <button type="button" className="link-btn small" onClick={(e) => { e.stopPropagation(); copy(a.number); }}>copy</button></div>
                {a.bankName && <div className="meta">{a.bankName}{a.branch ? ` · ${a.branch}` : ''}</div>}
                {a.iban && <div className="meta">IBAN {a.iban} <button type="button" className="link-btn small" onClick={(e) => { e.stopPropagation(); copy(a.iban); }}>copy</button></div>}
                {a.instructions && <div className="muted small">{a.instructions}</div>}
              </div>
            ))}
          </div>

          {account && (
            <>
              <div className="form-grid" style={{ marginTop: '.8rem' }}>
                {account.type === 'bank'
                  ? <div><label>Name of your bank</label><input required minLength={2} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. HBL, Meezan" /></div>
                  : <div><label>Your {CHANNEL[account.type]} mobile number (you sent the money from it)</label><input required value={form.senderNumber} onChange={(e) => setForm({ ...form, senderNumber: e.target.value })} placeholder="0300 1234567" /></div>}
                <div><label>{account.type === 'bank' ? 'Transaction / reference number' : 'Transaction ID (TID)'}</label><input required minLength={3} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                <div><label>Date you paid</label><input type="date" required value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></div>
                <div><label>Photo or PDF of the slip / screenshot</label><input type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files[0])} /></div>
              </div>
              <label>Note (optional)</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send to the finance office'}</button>
            </>
          )}
        </>
      )}
    </form>
  );
}
