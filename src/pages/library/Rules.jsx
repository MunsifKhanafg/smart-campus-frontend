import { useEffect, useState } from 'react';
import api from '../../api/axios.js';

const num = (v) => Number(v);

// The library rules: loan days, fines, reminders (SMS) and their repeat interval, complaints, reservations. Everything automatic reads these.
// The library controller and the principal can both change them (the server writes every change to the activity log).
export default function Rules({ ok, fail }) {
  const [f, setF] = useState(null);
  const [info, setInfo] = useState({ providerConfigured: true, currency: '' });

  useEffect(() => {
    api.get('/library/rules').then((r) => {
      const { providerConfigured, currency, ...rules } = r.data.data;
      setInfo({ providerConfigured, currency });
      setF({ ...rules, reminderBeforeDays: rules.reminderBeforeDays.join(', '), categories: rules.categories.join(', '), maxFinePerBook: rules.maxFinePerBook ?? '' });
    }).catch(fail);
  }, [fail]);

  if (!f) return <div className="card muted">Loading...</div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const flag = (k) => (e) => setF({ ...f, [k]: e.target.checked });
  const list = (s) => String(s).split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

  const save = async (e) => {
    e.preventDefault();
    const body = {
      loanDays: num(f.loanDays), maxBooksPerStudent: num(f.maxBooksPerStudent), maxRenewals: num(f.maxRenewals), renewDays: num(f.renewDays),
      blockIssueIfOverdue: f.blockIssueIfOverdue, blockIssueIfFineUnpaid: f.blockIssueIfFineUnpaid,
      finePerDay: num(f.finePerDay), graceDays: num(f.graceDays), maxFinePerBook: f.maxFinePerBook === '' ? null : num(f.maxFinePerBook),
      lostPenaltyMultiplier: num(f.lostPenaltyMultiplier), lostProcessingFee: num(f.lostProcessingFee),
      smsEnabled: f.smsEnabled, reminderBeforeDays: list(f.reminderBeforeDays).map(num), remindOnDueDay: f.remindOnDueDay,
      overdueReminderEveryDays: num(f.overdueReminderEveryDays), maxOverdueReminders: num(f.maxOverdueReminders),
      complaintAfterOverdueDays: num(f.complaintAfterOverdueDays), principalAfterOverdueDays: num(f.principalAfterOverdueDays),
      reservationHoldDays: num(f.reservationHoldDays), maxReservationsPerStudent: num(f.maxReservationsPerStudent),
      categories: list(f.categories),
    };
    try { const { data } = await api.put('/library/rules', body); ok(data.message); } catch (err) { fail(err); }
  };

  const cur = info.currency;
  return (
    <form onSubmit={save}>
      <div className="card">
        <h3>Borrowing</h3>
        <div className="form-grid">
          <div><label>Loan period (days)</label><input type="number" min={1} max={120} required value={f.loanDays} onChange={set('loanDays')} /></div>
          <div><label>Books one student may hold</label><input type="number" min={1} max={30} required value={f.maxBooksPerStudent} onChange={set('maxBooksPerStudent')} /></div>
          <div><label>Renewals allowed (0 = none)</label><input type="number" min={0} max={10} required value={f.maxRenewals} onChange={set('maxRenewals')} /></div>
          <div><label>Days added by a renewal</label><input type="number" min={1} max={60} required value={f.renewDays} onChange={set('renewDays')} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.blockIssueIfOverdue} onChange={flag('blockIssueIfOverdue')} /> No new book while the student has an overdue book</label>
        <label className="check"><input type="checkbox" checked={f.blockIssueIfFineUnpaid} onChange={flag('blockIssueIfFineUnpaid')} /> No new book while the student has an unpaid fine</label>
      </div>

      <div className="card">
        <h3>Fines {cur && <span className="muted small">({cur})</span>}</h3>
        <div className="form-grid">
          <div><label>Fine per book per day</label><input type="number" min={0} step="any" required value={f.finePerDay} onChange={set('finePerDay')} /></div>
          <div><label>Grace days (no fine at first)</label><input type="number" min={0} max={30} required value={f.graceDays} onChange={set('graceDays')} /></div>
          <div><label>Largest fine for one book (empty = no limit)</label><input type="number" min={0} step="any" value={f.maxFinePerBook} onChange={set('maxFinePerBook')} /></div>
          <div><label>Lost book costs price ×</label><input type="number" min={0} max={10} step="any" required value={f.lostPenaltyMultiplier} onChange={set('lostPenaltyMultiplier')} /></div>
          <div><label>Lost book processing fee</label><input type="number" min={0} step="any" required value={f.lostProcessingFee} onChange={set('lostProcessingFee')} /></div>
        </div>
        <p className="muted small">A new fine rule applies to books issued from now on. Books that are already out keep the rule they were issued with.</p>
      </div>

      <div className="card">
        <h3>SMS and reminders</h3>
        {!info.providerConfigured && <div className="alert alert-info">The SMS provider is not set up on the server yet (<code>server/.env</code>), so only in-app notifications are sent. Everything below is ready for when it is.</div>}
        <label className="check"><input type="checkbox" checked={f.smsEnabled} onChange={flag('smsEnabled')} /> Send SMS to the phone number saved in the student's record (issue, reminders, return)</label>
        <div className="form-grid">
          <div><label>Remind this many days before the return date</label><input value={f.reminderBeforeDays} onChange={set('reminderBeforeDays')} placeholder="3, 1" /></div>
          <div><label>After the return date, repeat every (days)</label><input type="number" min={1} max={30} required value={f.overdueReminderEveryDays} onChange={set('overdueReminderEveryDays')} /></div>
          <div><label>Most overdue reminders (0 = until returned)</label><input type="number" min={0} max={100} required value={f.maxOverdueReminders} onChange={set('maxOverdueReminders')} /></div>
        </div>
        <label className="check"><input type="checkbox" checked={f.remindOnDueDay} onChange={flag('remindOnDueDay')} /> Also remind on the return date itself</label>
        <p className="muted small">Reminders stop by themselves the moment the book is received at the desk.</p>
      </div>

      <div className="card">
        <h3>Complaints</h3>
        <div className="form-grid">
          <div><label>File a complaint to the department after (days overdue)</label><input type="number" min={1} max={365} required value={f.complaintAfterOverdueDays} onChange={set('complaintAfterOverdueDays')} /></div>
          <div><label>Inform the principal after (days overdue)</label><input type="number" min={1} max={730} required value={f.principalAfterOverdueDays} onChange={set('principalAfterOverdueDays')} /></div>
        </div>
      </div>

      <div className="card">
        <h3>Reservations and categories</h3>
        <div className="form-grid">
          <div><label>A returned book is held for the first student (days)</label><input type="number" min={1} max={30} required value={f.reservationHoldDays} onChange={set('reservationHoldDays')} /></div>
          <div><label>Reservations one student may have</label><input type="number" min={1} max={20} required value={f.maxReservationsPerStudent} onChange={set('maxReservationsPerStudent')} /></div>
        </div>
        <label>Book categories (comma separated)</label>
        <textarea rows={2} value={f.categories} onChange={set('categories')} placeholder="Computer Science, Mathematics, English Literature" />
      </div>

      <div className="actions"><button className="btn btn-primary">Save rules</button></div>
    </form>
  );
}
