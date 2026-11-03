import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, toInputDate, money } from '../components/ui.jsx';

const EMPTY = {
  semester: '', examination: '', title: '', feeType: 'examination', amount: '', startDate: '', dueDate: '',
  lateFee: 0, lateDueDate: '', requirements: '', requiredDocuments: '',
};

// Fee notices. The Finance Officer (all departments) and an HOD (own department) create and publish them.
// The University Head can only look. Students see them under Fees and Payments once published.
export default function FeeNotices() {
  const role = useSelector((s) => s.auth.user.role);
  const canEdit = ['finance_officer', 'hod'].includes(role);
  const [msg, ok, fail] = useFlash();
  const [notices, setNotices] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [exams, setExams] = useState([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(null); // null | EMPTY | { _id, ... }
  const [paid, setPaid] = useState(null);

  const load = useCallback(() => {
    api.get('/fees/notices', { params: status ? { status } : {} }).then((r) => setNotices(r.data.data)).catch(fail);
  }, [status, fail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    api.get('/semesters').then((r) => setSemesters(r.data.data.filter((s) => !['completed', 'archived'].includes(s.status)))).catch(fail);
  }, [canEdit, fail]);

  // Examination sessions of the chosen semester (the finance officer has no access to this list, so it stays empty for them).
  useEffect(() => {
    if (role !== 'hod' || !form?.semester) { setExams([]); return; }
    api.get('/examinations').then((r) => setExams(r.data.data.filter((x) => x.semester?._id === form.semester))).catch(() => setExams([]));
  }, [role, form?.semester]);

  const save = async (e) => {
    e.preventDefault();
    const body = {
      title: form.title,
      feeType: form.feeType,
      amount: Number(form.amount),
      startDate: form.startDate,
      dueDate: form.dueDate,
      lateFee: Number(form.lateFee || 0),
      lateDueDate: form.lateDueDate || null,
      requirements: form.requirements || undefined,
      requiredDocuments: form.requiredDocuments.split(',').map((x) => x.trim()).filter(Boolean),
    };
    try {
      if (form._id) {
        await api.put(`/fees/notices/${form._id}`, body);
      } else {
        const sem = semesters.find((s) => s._id === form.semester);
        await api.post('/fees/notices', {
          ...body,
          semester: form.semester,
          department: role === 'finance_officer' ? sem?.department?._id : undefined, // an HOD is locked to their department by the server
          examination: form.examination || null,
        });
      }
      ok('Fee notice saved as draft. Publish it when it is ready.');
      setForm(null);
      load();
    } catch (err) { fail(err); }
  };

  const act = async (n, action) => {
    const text = { publish: 'Publish this notice? Students will be notified.', close: 'Close this notice? Nobody can pay it afterwards.' }[action];
    if (!window.confirm(text)) return;
    try { await api.post(`/fees/notices/${n._id}/${action}`); ok(`Notice ${action === 'publish' ? 'published' : 'closed'}`); load(); } catch (err) { fail(err); }
  };

  const showPaid = async (n) => {
    try { setPaid((await api.get('/fees/status', { params: { notice: n._id } })).data.data); } catch (err) { fail(err); }
  };

  const edit = (n) => setForm({
    _id: n._id, title: n.title, feeType: n.feeType, amount: n.amount, startDate: toInputDate(n.startDate), dueDate: toInputDate(n.dueDate),
    lateFee: n.lateFee, lateDueDate: toInputDate(n.lateDueDate), requirements: n.requirements || '', requiredDocuments: (n.requiredDocuments || []).join(', '),
    semester: n.semester?._id, examination: '',
  });

  return (
    <>
      <div className="row-between">
        <h1>Fee Notices</h1>
        {canEdit && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}>+ New fee notice</button>}
      </div>
      <Alert msg={msg} />

      {form && canEdit && (
        <form className="card" onSubmit={save}>
          <h3>{form._id ? 'Edit fee notice' : 'New fee notice'}</h3>
          <div className="form-grid">
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div>
              <label>Semester</label>
              <select required disabled={!!form._id} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value, examination: '' })}>
                <option value="">Select...</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.department?.code} · {s.name} ({s.academicYear})</option>)}
              </select>
            </div>
            {role === 'hod' && !form._id && (
              <div>
                <label>Examination (optional)</label>
                <select value={form.examination} onChange={(e) => setForm({ ...form, examination: e.target.value })}>
                  <option value="">Not linked</option>
                  {exams.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label>Fee type</label>
              <select value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })}>
                <option value="examination">Examination fee</option>
                <option value="promotion">Semester promotion fee</option>
                <option value="other">Other charge</option>
              </select>
            </div>
            <div><label>Normal fee amount</label><input type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><label>Collection starts</label><input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label>Normal payment deadline</label><input type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div><label>Late fee amount</label><input type="number" min={0} value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} /></div>
            <div><label>Late payment deadline</label><input type="date" value={form.lateDueDate} onChange={(e) => setForm({ ...form, lateDueDate: e.target.value })} /></div>
          </div>
          <label>Examination admission requirements</label>
          <textarea rows={2} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
          <label>Required documents (comma separated)</label>
          <input placeholder="transcript, photo" value={form.requiredDocuments} onChange={(e) => setForm({ ...form, requiredDocuments: e.target.value })} />
          <p className="muted small">A student who pays after the normal deadline but before the late deadline pays the amount plus the late fee. The server calculates this when they pay.</p>
          <div className="actions">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="card filters">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Fee</th><th>Department</th><th>Semester</th><th>Amount</th><th>Deadlines</th><th>Status</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {notices.map((n) => (
              <tr key={n._id}>
                <td>{n.title}<div className="muted small">{n.feeType}{n.examination ? ` · ${n.examination.name}` : ''}</div></td>
                <td>{n.department?.code}</td>
                <td>{n.semester?.name}</td>
                <td>{money(n.amount)}{n.lateFee > 0 && <div className="muted small">late +{money(n.lateFee)}</div>}</td>
                <td className="small">{fmtDate(n.startDate)} → {fmtDate(n.dueDate)}{n.lateDueDate && <div>late until {fmtDate(n.lateDueDate)}</div>}</td>
                <td><Badge value={n.status} /></td>
                <td className="actions">
                  {n.status !== 'draft' && <button className="btn btn-small" onClick={() => showPaid(n)}>Who paid</button>}
                  {canEdit && n.status !== 'closed' && <button className="btn btn-small" onClick={() => edit(n)}>Edit</button>}
                  {canEdit && n.status === 'draft' && <button className="btn btn-small btn-primary" onClick={() => act(n, 'publish')}>Publish</button>}
                  {canEdit && n.status === 'published' && <button className="btn btn-small btn-danger" onClick={() => act(n, 'close')}>Close</button>}
                </td>
              </tr>
            ))}
            {!notices.length && <tr><td colSpan={7} className="muted">No fee notices.</td></tr>}
          </tbody>
        </table>
      </div>

      {paid && (
        <div className="card table-wrap">
          <div className="row-between">
            <h3>{paid.notice.title}: {paid.paidCount} paid, {paid.unpaidCount} not paid</h3>
            <button className="btn btn-ghost" onClick={() => setPaid(null)}>Close</button>
          </div>
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Status</th><th>Amount</th><th>Receipt</th><th>Date</th></tr></thead>
            <tbody>
              {paid.rows.map((r) => (
                <tr key={r.student}>
                  <td>{r.rollNumber}</td><td>{r.name}</td>
                  <td><Badge value={r.paid ? 'paid' : 'pending'} text={r.paid ? 'paid' : 'not paid'} /></td>
                  <td>{r.amount != null ? money(r.amount) : '—'}</td><td>{r.receiptNumber || '—'}</td><td>{fmtDate(r.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
