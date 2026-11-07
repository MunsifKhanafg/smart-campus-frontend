import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

const METHOD = { gateway: 'Online', bank: 'Bank transfer', manual: 'At the office' };

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

// Student: fee obligations, fee cart, three ways to pay (online, bank transfer, office), payment history, receipts.
export default function MyFees() {
  const [msg, ok, fail] = useFlash();
  const [fees, setFees] = useState([]);
  const [cart, setCart] = useState({ items: [], total: 0, currency: '' });
  const [payments, setPayments] = useState([]);
  const [pick, setPick] = useState({}); // practicals chosen for each fee before adding it to the cart
  const [busy, setBusy] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const load = useCallback(() => {
    api.get('/fees/mine').then((r) => setFees(r.data.data)).catch(fail);
    api.get('/fees/cart').then((r) => setCart(r.data.data)).catch(() => {});
    api.get('/payments/mine').then((r) => setPayments(r.data.data)).catch(() => {});
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const add = async (f, practicals) => {
    try { setCart((await api.post('/fees/cart', { notice: f._id ?? f.notice, practicals })).data.data); load(); } catch (err) { fail(err); }
  };
  const remove = async (id) => { try { setCart((await api.delete(`/fees/cart/${id}`)).data.data); load(); } catch (err) { fail(err); } };

  const checkout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/payments/checkout');
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
            <div className="actions" style={{ marginTop: '.6rem' }}>
              <button className="btn btn-primary" style={{ marginTop: 0 }} disabled={busy || cart.total <= 0} onClick={checkout}>{busy ? 'Opening payment page…' : '💳 Pay online'}</button>
              <button className="btn" disabled={cart.total <= 0} onClick={() => setBankOpen(!bankOpen)}>🏦 Pay by bank transfer</button>
            </div>
            <p className="muted small">
              The exam fee and the practical fees are added into ONE amount. The server calculates the final price, including any late fee, again when you pay.
              You can also pay in cash at the finance office with your roll number.
            </p>
            {bankOpen && <BankTransfer lines={payable} total={cart.total} cur={cur} ok={ok} fail={fail} done={() => { setBankOpen(false); load(); }} />}
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
                <td>{METHOD[p.method] || p.method}</td>
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

// Way 2: send the money to the university bank account, then tell the finance office the details and attach the slip.
// Nothing is paid until a finance officer checks the bank statement and presses "Received".
function BankTransfer({ lines, total, cur, ok, fail, done }) {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ bankName: '', reference: '', transferDate: new Date().toISOString().slice(0, 10), note: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/payments/bank-info').then((r) => setInfo(r.data.data)).catch(fail); }, [fail]);

  const send = async (e) => {
    e.preventDefault();
    if (!file) return fail('Please attach a photo or PDF of the bank slip');
    const fd = new FormData();
    fd.append('items', JSON.stringify(lines.map((i) => ({ notice: i.notice, practicals: i.practicals || 0 }))));
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
    fd.append('files', file);
    setBusy(true);
    try {
      await api.post('/payments/bank', fd);
      ok('Your transfer was sent to the finance office. You will get a notification when it is received.');
      done();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const hasAccount = info && (info.accountNumber || info.iban);
  return (
    <form className="sub-card" onSubmit={send} style={{ marginTop: '.8rem' }}>
      <h4>Pay by bank transfer</h4>
      {!info && <p className="muted">Loading bank details…</p>}
      {info && !hasAccount && <div className="alert alert-info">The university has not added its bank account yet. Please pay online or at the office.</div>}
      {hasAccount && (
        <div className="tiles" style={{ marginBottom: '.6rem' }}>
          {[['Bank', info.bankName], ['Account title', info.accountTitle], ['Account number', info.accountNumber], ['IBAN', info.iban], ['Branch', info.branch]]
            .filter(([, v]) => v).map(([k, v]) => <div className="tile" key={k}><div><b style={{ fontSize: '1rem' }}>{v}</b><span>{k}</span></div></div>)}
        </div>
      )}
      {info?.instructions && <p className="muted small">{info.instructions}</p>}
      <p>Send exactly <b>{money(total, cur)}</b>, then fill in the details below.</p>
      <div className="form-grid">
        <div><label>Your bank</label><input required minLength={2} value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. HBL, Meezan" /></div>
        <div><label>Transaction / reference number</label><input required minLength={3} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
        <div><label>Transfer date</label><input type="date" required value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} /></div>
        <div><label>Photo or PDF of the slip</label><input type="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files[0])} /></div>
      </div>
      <label>Note (optional)</label>
      <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      <button className="btn btn-primary" disabled={busy || !hasAccount}>{busy ? 'Sending…' : 'Send to the finance office'}</button>
    </form>
  );
}
