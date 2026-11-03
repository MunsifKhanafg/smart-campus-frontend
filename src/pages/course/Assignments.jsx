import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge, FileLink, fmtDateTime, toInputDateTime } from '../../components/ui.jsx';

const EMPTY = { type: 'assignment', title: '', description: '', instructions: '', releaseDate: '', deadline: '', maxMarks: 10, allowLateSubmission: false };
const iso = (v) => (v ? new Date(v).toISOString() : v);

export default function Assignments({ courseId, role }) {
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const [msg, ok, fail] = useFlash();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [files, setFiles] = useState({});
  const [review, setReview] = useState(null); // { assignment, rows }
  const [grades, setGrades] = useState({});
  const [submit, setSubmit] = useState({}); // student: assignmentId -> { text, files }

  const load = useCallback(
    () => api.get('/assignments', { params: { course: courseId } }).then((r) => setList(r.data.data)).catch(fail),
    [courseId, fail]
  );
  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, maxMarks: Number(form.maxMarks), releaseDate: iso(form.releaseDate), deadline: iso(form.deadline) };
    try {
      if (editId) {
        const { type, ...editable } = body; // type is not editable after creation
        await api.put(`/assignments/${editId}`, editable);
      } else {
        await api.post('/assignments', { ...body, course: courseId });
      }
      ok('Saved');
      setForm(EMPTY);
      setEditId(null);
      load();
    } catch (err) { fail(err); }
  };

  const edit = (a) => {
    setEditId(a._id);
    setForm({
      type: a.type, title: a.title, description: a.description || '', instructions: a.instructions || '',
      releaseDate: toInputDateTime(a.releaseDate), deadline: toInputDateTime(a.deadline), maxMarks: a.maxMarks, allowLateSubmission: !!a.allowLateSubmission,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api.delete(`/assignments/${a._id}`); ok('Deleted'); load(); } catch (err) { fail(err); }
  };

  const attach = async (a) => {
    const f = files[a._id];
    if (!f?.length) return fail('Choose at least one file first');
    const fd = new FormData();
    [...f].forEach((x) => fd.append('files', x));
    try { await api.post(`/assignments/${a._id}/attachments`, fd); ok('Files attached'); setFiles({ ...files, [a._id]: null }); load(); } catch (err) { fail(err); }
  };

  const openReview = async (a) => {
    try {
      const { data } = await api.get(`/assignments/${a._id}/submissions`);
      setReview(data.data);
      setGrades({});
    } catch (err) { fail(err); }
  };

  const grade = async (row) => {
    const g = grades[row.submission._id] || {};
    const marks = g.marks ?? row.submission.marks;
    if (marks === undefined || marks === null || marks === '') return fail('Enter marks first');
    try {
      await api.patch(`/assignments/submissions/${row.submission._id}/grade`, { marks: Number(marks), feedback: g.feedback ?? row.submission.feedback ?? '' });
      ok('Marks saved');
      openReview(review.assignment);
    } catch (err) { fail(err); }
  };

  const sendWork = async (a) => {
    const s = submit[a._id] || {};
    const fd = new FormData();
    if (s.text) fd.append('text', s.text);
    [...(s.files || [])].forEach((f) => fd.append('files', f));
    try {
      await api.post(`/assignments/${a._id}/submit`, fd);
      ok('Submitted');
      setSubmit({ ...submit, [a._id]: {} });
      load();
    } catch (err) { fail(err); }
  };

  const phaseOf = (a) => (isStudent ? a.status : a.phase);

  return (
    <>
      <Alert msg={msg} />
      {isTeacher && (
        <form className="card" onSubmit={save}>
          <h3>{editId ? 'Edit' : 'New assignment or presentation'}</h3>
          <div className="form-grid">
            <div>
              <label>Type</label>
              <select disabled={!!editId} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="assignment">Assignment</option>
                <option value="presentation">Presentation</option>
              </select>
            </div>
            <div><label>Title</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label>Release</label><input type="datetime-local" required value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} /></div>
            <div><label>Deadline</label><input type="datetime-local" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
            <div><label>Maximum marks</label><input type="number" min={1} required value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></div>
          </div>
          <label>Description</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Required documents / instructions</label>
          <textarea rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
          <label className="check"><input type="checkbox" checked={form.allowLateSubmission} onChange={(e) => setForm({ ...form, allowLateSubmission: e.target.checked })} />Accept late submissions (marked as late)</label>
          <div className="actions">
            <button className="btn btn-primary">{editId ? 'Save changes' : 'Create'}</button>
            {editId && <button type="button" className="btn btn-ghost mt" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</button>}
          </div>
        </form>
      )}

      {!list.length && <div className="card muted">Nothing here yet.</div>}
      {list.map((a) => (
        <div className="sub-card" key={a._id}>
          <div className="row-between">
            <h4>{a.title} <span className="muted small">({a.type})</span></h4>
            <Badge value={phaseOf(a)} />
          </div>
          <div className="muted small">Opens {fmtDateTime(a.releaseDate)} · Due {fmtDateTime(a.deadline)} · {a.maxMarks} marks</div>
          {a.description && <p>{a.description}</p>}
          {a.instructions && <p className="small"><strong>Instructions:</strong> {a.instructions}</p>}
          {a.attachments?.map((f) => <FileLink key={f.storedName} path={`/assignments/${a._id}/attachments/${f.storedName}`} name={f.originalName} onError={fail} />)}

          {!isStudent && (
            <div className="small muted">Submitted {a.submitted} · Marked {a.graded} · Late {a.late}</div>
          )}
          {isTeacher && (
            <div className="inline-form mt">
              <div><input type="file" multiple onChange={(e) => setFiles({ ...files, [a._id]: e.target.files })} /></div>
              <button className="btn btn-small" onClick={() => attach(a)}>Attach</button>
              <button className="btn btn-small" onClick={() => openReview(a)}>Submissions</button>
              <button className="btn btn-small" onClick={() => edit(a)}>Edit</button>
              <button className="btn btn-small btn-danger" onClick={() => remove(a)}>Delete</button>
            </div>
          )}
          {!isTeacher && !isStudent && <button className="btn btn-small mt" onClick={() => openReview(a)}>View submissions</button>}

          {isStudent && a.status !== 'upcoming' && (
            <div className="mt">
              {a.submission && (
                <div className="small">
                  Submitted {fmtDateTime(a.submission.submittedAt)} {a.submission.isLate && <Badge value="late" />}
                  {a.submission.files?.map((f) => <span key={f.storedName}> · <FileLink path={`/assignments/submissions/${a.submission._id}/files/${f.storedName}`} name={f.originalName} onError={fail} /></span>)}
                  {a.submission.gradedAt && <div><strong>Marks: {a.submission.marks} / {a.maxMarks}</strong>{a.submission.feedback ? ` — ${a.submission.feedback}` : ''}</div>}
                </div>
              )}
              {!a.submission?.gradedAt && (a.status === 'active' || a.status === 'completed' || (a.status === 'expired' && a.allowLateSubmission)) && (
                <div className="mt">
                  <textarea rows={2} placeholder="Your answer (optional if you attach a file)" value={submit[a._id]?.text || ''} onChange={(e) => setSubmit({ ...submit, [a._id]: { ...submit[a._id], text: e.target.value } })} />
                  <input type="file" multiple onChange={(e) => setSubmit({ ...submit, [a._id]: { ...submit[a._id], files: e.target.files } })} />
                  <button className="btn btn-small btn-primary" onClick={() => sendWork(a)}>{a.submission ? 'Re-submit' : 'Submit'}</button>
                </div>
              )}
            </div>
          )}
          {isStudent && a.status === 'upcoming' && <p className="muted small">Details unlock on the release date.</p>}
        </div>
      ))}

      {review && (
        <div className="card">
          <div className="row-between">
            <h3>Submissions: {review.assignment.title}</h3>
            <button className="btn btn-ghost" onClick={() => setReview(null)}>Close</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Status</th><th>Work</th>{isTeacher && <th>Marks / {review.assignment.maxMarks}</th>}{isTeacher && <th>Feedback</th>}{isTeacher && <th />}</tr></thead>
              <tbody>
                {review.rows.map((r) => (
                  <tr key={r.student._id}>
                    <td>{r.student.rollNumber}</td>
                    <td>{r.student.name}</td>
                    <td><Badge value={r.status} /></td>
                    <td>
                      {r.submission?.text && <div className="small">{r.submission.text.slice(0, 120)}{r.submission.text.length > 120 ? '…' : ''}</div>}
                      {r.submission?.files.map((f) => <FileLink key={f.storedName} path={`/assignments/submissions/${r.submission._id}/files/${f.storedName}`} name={f.originalName} onError={fail} />)}
                    </td>
                    {isTeacher && (
                      <>
                        <td style={{ width: 90 }}>{r.submission && <input type="number" min={0} max={review.assignment.maxMarks} defaultValue={r.submission.marks ?? ''} onChange={(e) => setGrades({ ...grades, [r.submission._id]: { ...grades[r.submission._id], marks: e.target.value } })} />}</td>
                        <td>{r.submission && <input defaultValue={r.submission.feedback || ''} onChange={(e) => setGrades({ ...grades, [r.submission._id]: { ...grades[r.submission._id], feedback: e.target.value } })} />}</td>
                        <td>{r.submission && <button className="btn btn-small" onClick={() => grade(r)}>Save</button>}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
