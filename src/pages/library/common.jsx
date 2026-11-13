import { createContext, useContext, useState } from 'react';
import api from '../../api/axios.js';
import { money as fmtMoney } from '../../components/ui.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';

// Small pieces shared by the library screens (Library.jsx and the tabs next to this file).

// The currency of the college (University Settings > fee policy). Loaded once by Library.jsx / MyLibrary.jsx.
export const CurrencyContext = createContext('');
export const useMoney = () => {
  const cur = useContext(CurrencyContext);
  return (n) => fmtMoney(n, cur);
};

export function Pager({ page, pages, total, onPage }) {
  if (!total) return null;
  return (
    <div className="lib-pager lib-noprint">
      <span className="muted small">{total} record{total === 1 ? '' : 's'} · page {page} of {pages}</span>
      <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Previous</button>
      <button type="button" className="btn btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </div>
  );
}

// A dashboard tile in the style of the other dashboards (.tile).
export function Stat({ icon, value, text, tone = '', onClick }) {
  const inner = <><div className="ico">{icon}</div><div><b>{value}</b><span>{text}</span></div></>;
  return onClick
    ? <button type="button" className={`tile ${tone}`} style={{ textAlign: 'left', cursor: 'pointer' }} onClick={onClick}>{inner}</button>
    : <div className={`tile ${tone}`}>{inner}</div>;
}

const STATE_TEXT = { issued: 'Issued', due_soon: 'Due soon', overdue: 'Overdue', returned: 'Returned', lost: 'Lost' };
// How a loan stands today: overdue and due-soon use the project's red / amber text, the others a normal badge.
export function LoanState({ loan }) {
  const s = loan.state;
  const extra = s === 'overdue' ? ` · ${loan.overdueDays} day${loan.overdueDays === 1 ? '' : 's'}` : s === 'due_soon' ? ` · ${loan.daysLeft} day${loan.daysLeft === 1 ? '' : 's'} left` : '';
  if (s === 'overdue' || s === 'due_soon') return <span className={`lib-state-${s}`}>{STATE_TEXT[s]}{extra}</span>;
  const badge = s === 'returned' ? 'approved' : s === 'lost' ? 'rejected' : 'active';
  return <span className={`badge ${badge}`}>{STATE_TEXT[s] || s}</span>;
}

// The money side of one loan, in a few short lines
export function Charges({ loan }) {
  const m = useMoney();
  if (!loan.charged && !loan.pending) return <span className="muted">—</span>;
  return (
    <div>
      {loan.fine > 0 && <div className="small">Late fine {m(loan.fine)}</div>}
      {loan.penalty > 0 && <div className="small">Lost / damaged {m(loan.penalty)}</div>}
      {loan.paid > 0 && <div className="small muted">Paid {m(loan.paid)}</div>}
      {loan.waived > 0 && <div className="small muted">Waived {m(loan.waived)}</div>}
      {loan.pending > 0 && <b>To pay {m(loan.pending)}</b>}
    </div>
  );
}

// The buttons of one loan at the desk: return, renew, mark lost, take a payment, waive. Only the library controller gets them (run=true).
// Each one calls the same API as the desk and then asks the page to reload (onDone).
export function LoanActions({ loan, run, onDone, ok, fail }) {
  const confirm = useConfirm();
  const m = useMoney();
  const [mode, setMode] = useState(null);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  if (!run) return null;

  const open = loan.status === 'issued';
  const close = () => { setMode(null); setF({}); };
  const call = async (fn) => {
    setBusy(true);
    try { const r = await fn(); ok(r.data.message); close(); onDone?.(); } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const doReturn = (e) => { e.preventDefault(); call(() => api.post('/library/return', { loanId: loan._id, condition: f.condition || 'good', damageFee: Number(f.damageFee) || 0, note: f.note || '' })); };
  const doRenew = () => call(() => api.post('/library/renew', { loanId: loan._id }));
  const doLost = async (e) => {
    e.preventDefault();
    const yes = await confirm({ tone: 'danger', title: 'Record this book as lost?', message: `"${loan.book?.title}" will be marked lost and the student is charged. A complaint is sent to the department.`, confirmText: 'Mark as lost' });
    if (!yes) return;
    call(() => api.post('/library/lost', { loanId: loan._id, ...(f.amount !== undefined && f.amount !== '' ? { amount: Number(f.amount) } : {}), note: f.note || '' }));
  };
  const doMoney = (e) => { e.preventDefault(); call(() => api.post('/library/payments', { loanId: loan._id, kind: mode, amount: Number(f.amount), note: f.note || '' })); };

  return (
    <div>
      <div className="actions">
        {open && <button type="button" className="btn btn-small btn-primary" disabled={busy} onClick={() => { setMode('return'); setF({ condition: 'good' }); }}>Return</button>}
        {open && <button type="button" className="btn btn-small" disabled={busy} onClick={doRenew}>Renew</button>}
        {open && <button type="button" className="btn btn-small btn-danger" disabled={busy} onClick={() => { setMode('lost'); setF({}); }}>Lost</button>}
        {loan.pending > 0 && <button type="button" className="btn btn-small" disabled={busy} onClick={() => { setMode('payment'); setF({ amount: loan.pending }); }}>Take payment</button>}
        {loan.pending > 0 && <button type="button" className="btn btn-small" disabled={busy} onClick={() => { setMode('waiver'); setF({ amount: loan.pending }); }}>Waive</button>}
      </div>

      {mode === 'return' && (
        <form className="sub-card" onSubmit={doReturn}>
          <div className="form-grid">
            <div><label>Condition</label><select value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value })}><option value="good">Good</option><option value="damaged">Damaged</option></select></div>
            {f.condition === 'damaged' && <div><label>Damage charge</label><input type="number" min={0} step="any" value={f.damageFee ?? ''} onChange={(e) => setF({ ...f, damageFee: e.target.value })} /></div>}
          </div>
          <label>Note (optional)</label><input maxLength={300} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <div className="actions"><button className="btn btn-small btn-primary" disabled={busy}>Confirm return</button><button type="button" className="btn btn-small btn-ghost" onClick={close}>Cancel</button></div>
        </form>
      )}
      {mode === 'lost' && (
        <form className="sub-card" onSubmit={doLost}>
          <label>Charge to the student (empty = book price × the lost-book rule)</label>
          <input type="number" min={0} step="any" value={f.amount ?? ''} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <label>Note (optional)</label><input maxLength={300} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <div className="actions"><button className="btn btn-small btn-danger" disabled={busy}>Record as lost</button><button type="button" className="btn btn-small btn-ghost" onClick={close}>Cancel</button></div>
        </form>
      )}
      {(mode === 'payment' || mode === 'waiver') && (
        <form className="sub-card" onSubmit={doMoney}>
          <label>{mode === 'payment' ? 'Money received at the desk' : 'Amount to forgive'} (to pay now: {m(loan.pending)})</label>
          <input type="number" required min={0.01} step="any" value={f.amount ?? ''} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <label>Note {mode === 'waiver' ? '(why it is forgiven)' : '(optional)'}</label><input maxLength={300} required={mode === 'waiver'} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <div className="actions"><button className="btn btn-small btn-primary" disabled={busy}>{mode === 'payment' ? 'Record payment' : 'Waive'}</button><button type="button" className="btn btn-small btn-ghost" onClick={close}>Cancel</button></div>
        </form>
      )}
    </div>
  );
}

// "Name · ROLL" under a student's name
export const who = (l) => (l.student?.name ? `${l.student.name}${l.rollNumber ? ` · ${l.rollNumber}` : ''}` : l.rollNumber || '—');

// Only the filled values of a filter object (for query strings).
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));
