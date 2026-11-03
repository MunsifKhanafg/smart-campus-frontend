import { useEffect, useState, useCallback } from 'react';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime, money, downloadSafe } from '../components/ui.jsx';

// Student: fee obligations, fee cart, online checkout, payment history, receipts.
export default function MyFees() {
  const [msg, ok, fail] = useFlash();
  const [fees, setFees] = useState([]);
  const [cart, setCart] = useState({ items: [], total: 0, currency: '' });
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/fees/mine').then((r) => setFees(r.data.data)).catch(fail);
    api.get('/fees/cart').then((r) => setCart(r.data.data)).catch(() => {});
    api.get('/payments/mine').then((r) => setPayments(r.data.data)).catch(() => {});
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const add = async (id) => { try { setCart((await api.post('/fees/cart', { notice: id })).data.data); load(); } catch (err) { fail(err); } };
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
  const STATE = { paid: 'paid', in_cart: 'scheduled', payable: 'open', not_started: 'upcoming', expired: 'closed' };

  return (
    <>
      <h1>Fees and Payments</h1>
      <Alert msg={msg} />

      <div className="card table-wrap">
        <h3>My fees</h3>
        <table>
          <thead><tr><th>Fee</th><th>Semester</th><th>Due</th><th>Amount</th><th>Status</th><th /></tr></thead>
          <tbody>
            {fees.map((f) => (
              <tr key={f._id}>
                <td>
                  {f.title}
                  {f.examination && <div className="muted small">{f.examination.name}</div>}
                  {f.requiredDocuments?.length > 0 && <div className="muted small">Documents: {f.requiredDocuments.join(', ')}</div>}
                </td>
                <td>{f.semester?.name}</td>
                <td>{fmtDate(f.dueDate)}{f.lateDueDate && <div className="muted small">late until {fmtDate(f.lateDueDate)} (+{money(f.lateFee, cur)})</div>}</td>
                <td>
                  {f.price ? money(f.price.total, cur) : '—'}
                  {f.price?.phase === 'late' && <div className="muted small">includes late fee {money(f.price.lateFee, cur)}</div>}
                </td>
                <td><Badge value={STATE[f.state]} text={f.state.replace('_', ' ')} /></td>
                <td>
                  {f.state === 'payable' && <button className="btn btn-small btn-primary" onClick={() => add(f._id)}>Add to cart</button>}
                  {f.state === 'in_cart' && <button className="btn btn-small" onClick={() => remove(f._id)}>Remove</button>}
                </td>
              </tr>
            ))}
            {!fees.length && <tr><td colSpan={6} className="muted">No fee notice has been published for you.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Fee cart</h3>
        {!cart.items.length && <p className="muted">Your cart is empty.</p>}
        {cart.items.map((i) => (
          <div className="row-between" key={i.notice}>
            <span>{i.title} {i.phase === 'late' && <Badge value="late" text="late fee applies" />}{!['normal', 'late'].includes(i.phase) && <Badge value="closed" text="cannot be paid" />}</span>
            <span>{money(i.total, cur)} <button className="btn btn-small" onClick={() => remove(i.notice)}>Remove</button></span>
          </div>
        ))}
        {cart.items.length > 0 && (
          <>
            <hr />
            <div className="row-between"><strong>Total payable</strong><strong>{money(cart.total, cur)}</strong></div>
            <button className="btn btn-primary" disabled={busy || cart.total <= 0} onClick={checkout}>{busy ? 'Opening payment page…' : 'Pay online'}</button>
            <p className="muted small">The final amount, including any late fee, is calculated again by the server when you pay. A payment counts as paid only after the gateway confirms it.</p>
          </>
        )}
      </div>

      <div className="card table-wrap">
        <h3>Payment history</h3>
        <table>
          <thead><tr><th>Date</th><th>Receipt</th><th>Items</th><th>Total</th><th>Status</th><th /></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p._id}>
                <td>{fmtDateTime(p.paidAt || p.createdAt)}</td>
                <td>{p.receiptNumber || '—'}</td>
                <td className="small">{p.items.map((i) => `${i.title}${i.lateFee ? ` (+${i.lateFee} late)` : ''}`).join(', ')}</td>
                <td>{money(p.totalAmount, p.currency)}</td>
                <td><Badge value={p.status} /></td>
                <td>{(p.status === 'paid' || p.status === 'refunded') && <button className="btn btn-small" onClick={() => downloadSafe(`/payments/${p._id}/receipt`, `${p.receiptNumber || 'receipt'}.pdf`, fail)}>Receipt</button>}</td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={6} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
