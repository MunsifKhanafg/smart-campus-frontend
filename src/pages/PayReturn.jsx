import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';

// Stripe sends the student back here. The server asks Stripe whether the payment is REALLY paid
// (the webhook may arrive a little later, so we check a few times).
export default function PayReturn() {
  const [params] = useSearchParams();
  const id = params.get('payment');
  const [state, setState] = useState({ status: 'checking', text: 'Confirming your payment with the gateway…' });

  useEffect(() => {
    if (!id) { setState({ status: 'error', text: 'Payment reference is missing.' }); return undefined; }
    let tries = 0;
    let timer;
    const check = async () => {
      tries += 1;
      try {
        const { data } = await api.post(`/payments/${id}/verify`);
        if (data.data.status === 'paid') return setState({ status: 'paid', text: `Payment confirmed. Receipt ${data.data.receiptNumber}.` });
        if (tries >= 6) return setState({ status: 'pending', text: 'The gateway has not confirmed the payment yet. Check Fees and Payments again in a minute.' });
        timer = setTimeout(check, 2500);
      } catch (err) {
        setState({ status: 'error', text: errorMessage(err) });
      }
    };
    check();
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <div className="auth-page">
      <div className="card pay-box">
        <h2>Payment</h2>
        <div className={`alert alert-${state.status === 'paid' ? 'success' : state.status === 'error' ? 'error' : 'info'}`}>{state.text}</div>
        <Link className="btn btn-primary" to="/fees">Go to Fees and Payments</Link>
      </div>
    </div>
  );
}
