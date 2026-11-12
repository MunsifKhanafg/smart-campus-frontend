import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useConfirm } from '../components/ConfirmModal.jsx';
import { useFlash, Alert, Badge, Tabs } from '../components/ui.jsx';

// Student leave.
//   student        asks for leave (from, to, type, reason), sees the answer, can cancel a waiting or not-yet-started leave
//   HOD            sees the requests of their own department and approves or rejects them (with an optional note)
//   University Head sees every request of every department (read only)
// Approved days are shown as "Leave", not "Absent", in the attendance sheets (done by the server).

const TYPES = [['sick', 'Sick'], ['family', 'Family'], ['other', 'Other']];
const todayKey = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000) + 1;
const typeText = (t) => TYPES.find(([k]) => k === t)?.[1] || t;

export default function StudentLeave() {
  const { user } = useSelector((s) => s.auth);
  const confirm = useConfirm();
  const [msg, ok, fail, clear] = useFlash();
  const isStudent = user.role === 'student';
  const isHod = user.role === 'hod';
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(isHod ? 'pending' : '');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ fromDate: todayKey(), toDate: todayKey(), type: 'sick', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = {};
    if (status) params.status = status;
    if (department) params.department = department;
    setLoading(true);
    api.get('/student-leaves', { params }).then((r) => setLeaves(r.data.data)).catch(fail).finally(() => setLoading(false));
  }, [status, department, fail]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (user.role !== 'university_head') return;
    api.get('/departments').then((r) => { const d = r.data.data; setDepartments(Array.isArray(d) ? d : d?.departments || []); }).catch(() => {});
  }, [user.role]);

  const submit = async (e) => {
    e.preventDefault();
    clear();
    setBusy(true);
    try {
      await api.post('/student-leaves', form);
      ok('Leave requested. You will be told when it is decided.');
      setForm({ fromDate: todayKey(), toDate: todayKey(), type: 'sick', reason: '' });
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const cancel = async (l) => {
    const yes = await confirm({ tone: 'danger', title: 'Cancel this leave?', message: `${l.fromDate} to ${l.toDate}`, confirmText: 'Cancel leave', cancelText: 'Keep it' });
    if (!yes) return;
    try { await api.delete(`/student-leaves/${l._id}`); ok('Leave cancelled'); load(); } catch (err) { fail(err); }
  };

  const decide = async (l, decision) => {
    const approve = decision === 'approved';
    const note = await confirm.prompt({
      tone: approve ? 'primary' : 'danger',
      title: `${approve ? 'Approve' : 'Reject'} leave of ${l.student?.name}?`,
      message: `${l.fromDate} to ${l.toDate} (${daysBetween(l.fromDate, l.toDate)} day${daysBetween(l.fromDate, l.toDate) > 1 ? 's' : ''}) · ${typeText(l.type)}\n${l.reason}`,
      label: 'Note for the student (optional)',
      placeholder: approve ? 'e.g. Get well soon' : 'e.g. Please meet me first',
      multiline: true,
      required: false,
      confirmText: approve ? 'Approve' : 'Reject',
    });
    if (note === null) return;
    try { const r = await api.patch(`/student-leaves/${l._id}/review`, { status: decision, note }); ok(r.data.message); load(); } catch (err) { fail(err); }
  };

  const today = todayKey();
  const pendingCount = useMemo(() => leaves.filter((l) => l.status === 'pending').length, [leaves]);

  return (
    <>
      <h1>{isStudent ? 'My Leave' : isHod ? 'Student Leave Requests' : 'All Student Leave Requests'}</h1>
      <p className="muted">
        {isStudent && 'Ask for leave here. Your HOD decides, and an approved leave is shown as Leave, not Absent, in attendance.'}
        {isHod && 'Requests of the students of your department. Approved days are marked Leave in attendance automatically.'}
        {user.role === 'university_head' && 'Every department. The HOD of each department decides the requests.'}
      </p>
      <Alert msg={msg} />

      {isStudent && (
        <form className="card lv-form" onSubmit={submit}>
          <h3>New leave request</h3>
          <div className="form-grid">
            <div><label>From</label><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate < e.target.value ? e.target.value : form.toDate })} /></div>
            <div><label>To</label><input type="date" required min={form.fromDate} value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></div>
            <div>
              <label>Leave type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="lv-days"><label>Days</label><div className="lv-days-box">{form.toDate >= form.fromDate ? daysBetween(form.fromDate, form.toDate) : '—'}</div></div>
          </div>
          <label>Reason</label>
          <textarea required rows={3} minLength={3} maxLength={600} value={form.reason} placeholder="Briefly explain why you need leave" onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="btn btn-primary mt" disabled={busy}>{busy ? 'Sending…' : 'Submit request'}</button>
        </form>
      )}

      <div className="card filters lv-filters">
        {user.role === 'university_head' && (
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
        <Tabs
          tabs={[['', 'All'], ['pending', isHod && pendingCount ? `Waiting (${pendingCount})` : 'Waiting'], ['approved', 'Approved'], ['rejected', 'Rejected'], ...(isStudent ? [['cancelled', 'Cancelled']] : [])]}
          active={status}
          onChange={setStatus}
        />
      </div>

      <div className="lv-list">
        {loading && <div className="card muted">Loading…</div>}
        {!loading && !leaves.length && <div className="card muted">No leave requests here.</div>}
        {leaves.map((l) => (
          <article key={l._id} className={`card lv-card lv-${l.status}`}>
            <div className="lv-top">
              <div>
                {!isStudent && <b className="lv-name">{l.student?.name}{l.rollNumber ? ` · ${l.rollNumber}` : ''}</b>}
                <div className="lv-dates">{l.fromDate} → {l.toDate} <span className="muted">({daysBetween(l.fromDate, l.toDate)} day{daysBetween(l.fromDate, l.toDate) > 1 ? 's' : ''})</span></div>
                <div className="muted small">{typeText(l.type)}{!isStudent && l.department?.code ? ` · ${l.department.code}` : ''}</div>
              </div>
              <Badge value={l.status} text={l.status === 'pending' ? 'waiting' : l.status} />
            </div>
            <p className="lv-reason">{l.reason}</p>
            {l.reviewedBy && (
              <p className="lv-note small">
                {l.status === 'approved' ? 'Approved' : 'Rejected'} by <b>{l.reviewedBy.name}</b>
                {l.reviewNote ? <> — “{l.reviewNote}”</> : null}
              </p>
            )}
            <div className="actions lv-actions">
              {isHod && l.status === 'pending' && (
                <>
                  <button className="btn btn-primary btn-small" onClick={() => decide(l, 'approved')}>Approve</button>
                  <button className="btn btn-danger btn-small" onClick={() => decide(l, 'rejected')}>Reject</button>
                </>
              )}
              {isStudent && (l.status === 'pending' || (l.status === 'approved' && l.fromDate > today)) && (
                <button className="btn btn-small" onClick={() => cancel(l)}>Cancel</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
