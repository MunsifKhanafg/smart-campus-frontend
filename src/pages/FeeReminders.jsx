import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime } from '../components/ui.jsx';

const TRIGGER = {
  due_near: 'Deadline is close',
  due_day: 'Last day to pay without late fee',
  late_near: 'Late deadline is close',
  late_day: 'Last day to pay with late fee',
  manual: 'Created by hand',
};
const TYPE = { examination: 'Exam fee', practical: 'Practical fee', promotion: 'Promotion fee', other: 'Other fee' };

// Lists of students who have not paid a fee yet. The server builds them by itself when a deadline (normal or late) is near or is today,
// and notifies the HOD of the department and the finance officers. A student whose bank / wallet transfer is waiting for the finance
// office is marked, so nobody chases a student who has already paid. The list can also be created by hand at any time.
export default function FeeReminders() {
  const role = useSelector((s) => s.auth.user.role);
  const canCreate = ['finance_officer', 'hod'].includes(role);
  const [msg, ok, fail] = useFlash();
  const [items, setItems] = useState([]);
  const [feeType, setFeeType] = useState('');
  const [open, setOpen] = useState(null); // the full list that is open
  const [notices, setNotices] = useState([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get('/fees/reminders', { params: feeType ? { feeType } : {} }).then((r) => setItems(r.data.data)).catch(fail);
  }, [feeType, fail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canCreate) return;
    api.get('/fees/notices', { params: { status: 'published' } })
      .then((r) => setNotices(r.data.data.filter((n) => ['examination', 'practical', 'promotion'].includes(n.feeType))))
      .catch(() => {});
  }, [canCreate]);

  const view = async (id) => {
    try { setOpen((await api.get(`/fees/reminders/${id}`)).data.data); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { fail(err); }
  };

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/fees/reminders', { notice });
      ok(data.message);
      setNotice('');
      setOpen(data.data);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const copyList = () => {
    const text = open.students.map((s) => `${s.rollNumber}\t${s.name}\t${s.email}${s.bankPending ? '\t(transfer waiting)' : ''}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => ok('The list was copied. Paste it into a message or a spreadsheet.')).catch(() => fail('Copy is not available in this browser'));
  };

  return (
    <>
      <h1>Unpaid Student Lists</h1>
      <p className="muted">Examination, practical and promotion fees. The list is created automatically near a deadline and on the deadline day, and the HOD and the finance office are notified.</p>
      <Alert msg={msg} />

      {canCreate && (
        <form className="card inline-form" onSubmit={create}>
          <div>
            <label>Create the list now for a fee</label>
            <select required value={notice} onChange={(e) => setNotice(e.target.value)}>
              <option value="">Choose a published fee...</option>
              {notices.map((n) => <option key={n._id} value={n._id}>{n.department?.code} · {n.semester?.name} · {n.batchTitle || n.title}</option>)}
            </select>
          </div>
          <button className="btn btn-primary inline" disabled={busy || !notice}>{busy ? 'Creating…' : 'Create list'}</button>
        </form>
      )}

      {open && (
        <div className="card table-wrap">
          <div className="row-between">
            <div>
              <h3 style={{ margin: 0 }}>{open.title}</h3>
              <div className="muted small">
                {open.department?.name} · {open.semester?.name} · {TRIGGER[open.trigger]} ({fmtDate(open.deadline)}) · created {fmtDateTime(open.createdAt)}
              </div>
              <p style={{ margin: '.4rem 0' }}><b>{open.unpaidCount}</b> of {open.totalStudents} students have not paid.</p>
            </div>
            <div className="actions">
              <button className="btn btn-small" onClick={copyList}>Copy list</button>
              <button className="btn btn-small" onClick={() => window.print()}>Print</button>
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Roll number</th><th>Name</th><th>Email</th><th /></tr></thead>
            <tbody>
              {open.students.map((s, i) => (
                <tr key={String(s.student)}>
                  <td>{i + 1}</td><td>{s.rollNumber}</td><td>{s.name}</td><td className="small">{s.email}</td>
                  <td>{s.bankPending && <Badge value="pending" text="transfer waiting for the finance office" />}</td>
                </tr>
              ))}
              {!open.students.length && <tr><td colSpan={5} className="muted">Everybody has paid.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="card filters">
        <div>
          <label>Fee type</label>
          <select value={feeType} onChange={(e) => setFeeType(e.target.value)}>
            <option value="">All</option>
            <option value="examination">Exam fee</option>
            <option value="practical">Practical fee</option>
            <option value="promotion">Promotion fee</option>
          </select>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Created</th><th>Fee</th><th>Department</th><th>Semester</th><th>Why now</th><th>Not paid</th><th /></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r._id}>
                <td className="small">{fmtDateTime(r.createdAt)}</td>
                <td>{r.title}<div className="muted small">{TYPE[r.feeType] || r.feeType}</div></td>
                <td>{r.department?.code}</td>
                <td>{r.semester?.name}</td>
                <td className="small">{TRIGGER[r.trigger]}<div className="muted">deadline {fmtDate(r.deadline)}</div></td>
                <td><b>{r.unpaidCount}</b> <span className="muted small">of {r.totalStudents}</span></td>
                <td><button className="btn btn-small" onClick={() => view(r._id)}>Open list</button></td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={7} className="muted">No list yet. The server creates one when a published fee deadline is near.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
