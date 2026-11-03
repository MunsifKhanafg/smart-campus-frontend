import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useFlash, Alert, money } from '../components/ui.jsx';

// Development gateway simulator. It plays the role of "the payment gateway confirms the payment".
// It is switched off by the server in production, where the real gateway (Stripe) is used instead.
export default function PayMock() {
  const { id } = useParams();
  const nav = useNavigate();
  const [msg, ok, fail] = useFlash();
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get(`/payments/${id}`).then((r) => setPayment(r.data.data)).catch(fail); }, [id, fail]);

  const pay = async () => {
    setBusy(true);
    try {
      await api.post(`/payments/${id}/mock-confirm`);
      ok('Payment confirmed. Redirecting…');
      setTimeout(() => nav('/fees'), 1200);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card pay-box">
        <h2>Payment gateway (simulator)</h2>
        <Alert msg={msg} />
        {payment && (
          <>
            <p className="muted">This is a practice gateway for development. No real money is used.</p>
            {payment.items.map((i) => <div className="row-between" key={i.notice}><span>{i.title}</span><span>{money(i.total, payment.currency)}</span></div>)}
            <hr />
            <div className="row-between"><strong>Total</strong><strong>{money(payment.totalAmount, payment.currency)}</strong></div>
            {payment.status === 'paid' ? (
              <p className="alert alert-success">Already paid. Receipt {payment.receiptNumber}</p>
            ) : (
              <button className="btn btn-primary" disabled={busy} onClick={pay}>Pay {money(payment.totalAmount, payment.currency)}</button>
            )}
          </>
        )}
        <p><Link to="/fees">Back to fees</Link></p>
      </div>
    </div>
  );
}
