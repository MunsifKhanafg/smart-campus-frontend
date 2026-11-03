import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, FileLink, fmtDateTime, label } from '../components/ui.jsx';

const CATEGORIES = [
  'teacher_change_request', 'teacher_complaint', 'attendance_correction', 'result_correction',
  'facility_complaint', 'fee_complaint', 'record_correction', 'other',
];
const RECIPIENTS = [['hod', 'Head of Department'], ['university_head', 'Principal / University Head'], ['finance_officer', 'Finance Office']];
const EMPTY = { category: 'other', recipient: 'hod', subject: '', description: '', relatedCourse: '' };

// Student: submit and track complaints or requests. Staff (HOD, head, finance): only the ones addressed to their office.
// A complaint never changes a teacher assignment or an academic record by itself.
export default function Complaints() {
  const role = useSelector((s) => s.auth.user.role);
  const isStudent = role === 'student';
  const [msg, ok, fail] = useFlash();
  const [list, setList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState(null);
  const [reply, setReply] = useState(null); // { complaint, message, status, resolution }
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    const req = isStudent ? api.get('/complaints/mine') : api.get('/complaints', { params: filter ? { status: filter } : {} });
    req.then((r) => setList(r.data.data)).catch(fail);
  }, [isStudent, filter, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isStudent) api.get('/enrollments/my-courses').then((r) => setCourses(r.data.data)).catch(() => {});
  }, [isStudent]);

  const submit = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (files?.length) [...files].forEach((f) => fd.append('files', f));
    try {
      await api.post('/complaints', fd);
      ok('Complaint submitted. You can follow its status below.');
      setForm(null);
      setFiles(null);
      load();
    } catch (err) { fail(err); }
  };

  const send = async (e) => {
    e.preventDefault();
    const body = { message: reply.message, status: reply.status };
    if (reply.status === 'resolved') body.resolution = reply.resolution;
    try {
      await api.post(`/complaints/${reply.complaint._id}/respond`, body);
      ok('Response saved. The student has been notified.');
      setReply(null);
      load();
    } catch (err) { fail(err); }
  };

  return (
    <>
      <div className="row-between">
        <h1>{isStudent ? 'My Complaints & Requests' : 'Student Complaints & Requests'}</h1>
        {isStudent && <button className="btn btn-primary" onClick={() => setForm(EMPTY)}>+ New complaint</button>}
      </div>
      <Alert msg={msg} />

      {form && isStudent && (
        <form className="card" onSubmit={submit}>
          <h3>New complaint or request</h3>
          <div className="form-grid">
            <div>
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
              </select>
            </div>
            <div>
              <label>Send to</label>
              <select value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })}>
                {RECIPIENTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Related course (optional)</label>
              <select value={form.relatedCourse} onChange={(e) => setForm({ ...form, relatedCourse: e.target.value })}>
                <option value="">None</option>
                {courses.map((c) => <option key={c.course._id} value={c.course._id}>{c.course.code} — {c.course.title}</option>)}
              </select>
            </div>
          </div>
          <label>Subject</label>
          <input required minLength={3} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <label>Description (at least 10 characters)</label>
          <textarea required minLength={10} rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Supporting documents (optional, up to 3 files)</label>
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          <div className="actions">
            <button className="btn btn-primary">Submit</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setForm(null)}>Cancel</button>
          </div>
          <p className="muted small">Only the office you choose can read this complaint. Teachers cannot see complaints about them.</p>
        </form>
      )}

      {!isStudent && (
        <div className="card filters">
          <div>
            <label>Status</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {reply && (
        <form className="card" onSubmit={send}>
          <h3>Respond: {reply.complaint.subject}</h3>
          <div className="form-grid">
            <div>
              <label>New status</label>
              <select value={reply.status} onChange={(e) => setReply({ ...reply, status: e.target.value })}>
                <option value="in_review">In review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <label>Message to the student</label>
          <textarea required rows={3} value={reply.message} onChange={(e) => setReply({ ...reply, message: e.target.value })} />
          {reply.status === 'resolved' && (
            <>
              <label>Resolution details</label>
              <textarea required rows={2} value={reply.resolution} onChange={(e) => setReply({ ...reply, resolution: e.target.value })} />
            </>
          )}
          <div className="actions">
            <button className="btn btn-primary">Send response</button>
            <button type="button" className="btn btn-ghost mt" onClick={() => setReply(null)}>Cancel</button>
          </div>
        </form>
      )}

      {list.map((c) => {
        const closed = ['resolved', 'rejected'].includes(c.status);
        return (
          <div className="card" key={c._id}>
            <div className="row-between">
              <h3 style={{ margin: 0 }}>{c.subject}</h3>
              <Badge value={c.status} text={label(c.status)} />
            </div>
            <div className="muted small">
              {label(c.category)} · to {label(c.recipient)} · {fmtDateTime(c.createdAt)}
              {!isStudent && ` · ${c.studentName} (${c.rollNumber})`}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
            {c.attachments.length > 0 && (
              <div>{c.attachments.map((a) => <FileLink key={a.storedName} path={`/complaints/${c._id}/files/${a.storedName}`} name={a.originalName} onError={fail} />)}</div>
            )}
            {c.responses.map((r, i) => (
              <div className="sub-card" key={i}>
                <div className="muted small">{label(r.byRole)} · {fmtDateTime(r.at)} · <Badge value={r.status} text={label(r.status)} /></div>
                <div>{r.message}</div>
              </div>
            ))}
            {c.resolution && <div className="alert alert-success">Resolution: {c.resolution}</div>}
            {!isStudent && !closed && (
              <button className="btn btn-small" onClick={() => setReply({ complaint: c, message: '', status: 'in_review', resolution: '' })}>Respond</button>
            )}
          </div>
        );
      })}
      {!list.length && <div className="card muted">No complaints.</div>}
    </>
  );
}
