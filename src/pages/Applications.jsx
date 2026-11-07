import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, FileLink, fmtDate, fmtDateTime, label } from '../components/ui.jsx';
import '../pages/admission.css';

// New-student applications from the public Apply page.
// University Head: every department. HOD: applicants whose first choice is their own department.
// Review a file, ask for more documents, accept or reject, and (HOD) create the student account of an accepted applicant.
export default function Applications() {
  const role = useSelector((s) => s.auth.user.role);
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [data, setData] = useState(null);
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [filter, setFilter] = useState({ status: '', department: '', search: '' });
  const [open, setOpen] = useState(null); // full application being viewed
  const [decision, setDecision] = useState({ status: 'under_review', remarks: '' });
  const [enroll, setEnroll] = useState(null); // { rollNumber, password, semester, section }

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/applications', { params }).then((r) => setData(r.data.data)).catch(fail);
  }, [filter, fail]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  useEffect(() => {
    if (!isHod) api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
    else api.get('/semesters').then((r) => setSemesters(r.data.data.filter((s) => !['completed', 'archived'].includes(s.status)))).catch(() => {});
  }, [isHod]);

  const view = async (id) => {
    try {
      const { data: res } = await api.get(`/applications/${id}`);
      setOpen(res.data);
      setDecision({ status: res.data.status === 'submitted' ? 'under_review' : res.data.status, remarks: '' });
      setEnroll(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { fail(err); }
  };

  const saveDecision = async (e) => {
    e.preventDefault();
    try {
      const { data: res } = await api.post(`/applications/${open._id}/review`, { status: decision.status, remarks: decision.remarks || undefined });
      ok('Decision saved. The applicant sees it when they track their application.');
      setOpen(res.data);
      load();
    } catch (err) { fail(err); }
  };

  const createStudent = async (e) => {
    e.preventDefault();
    try {
      const body = { rollNumber: enroll.rollNumber, password: enroll.password };
      if (enroll.semester) body.semester = enroll.semester;
      if (enroll.section) body.section = enroll.section;
      const { data: res } = await api.post(`/applications/${open._id}/enroll`, body);
      ok(`Student account created for ${open.name} (roll number ${res.data.rollNumber}). Give the first password to the student in person.`);
      setEnroll(null);
      view(open._id);
      load();
    } catch (err) { fail(err); }
  };

  const s = data?.summary;
  const rows = data?.rows || [];
  const groups = [...new Set(rows.map((r) => r.department?._id))].map((id) => rows.filter((r) => r.department?._id === id));
  const mySems = semesters.filter((x) => !open || String(x.department?._id) === String(open.department?._id));
  const finished = open && (open.enrolledUser || ['rejected'].includes(open.status));

  return (
    <>
      <h1>New Student Applications</h1>
      <Alert msg={msg} />

      {s && (
        <div className="ap-summary">
          <div><b>{s.total}</b><small>All</small></div>
          <div><b>{s.submitted}</b><small>New</small></div>
          <div><b>{s.under_review}</b><small>Under review</small></div>
          <div><b>{s.needs_info}</b><small>Waiting for documents</small></div>
          <div><b>{s.accepted}</b><small>Accepted</small></div>
          <div><b>{s.rejected}</b><small>Rejected</small></div>
        </div>
      )}

      {open && (
        <div className="card ap-detail">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>{open.name} <span className="muted small">{open.applicationNumber}</span></h3>
            <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
          </div>
          <dl className="mt">
            <dt>Status</dt><dd><Badge value={open.status} text={label(open.status)} />{open.enrolledUser && ' · student account created'}</dd>
            <dt>Choice</dt><dd>{open.department?.name}{open.program ? ` · ${open.program}` : ''}{open.secondDepartment ? ` (second: ${open.secondDepartment.name})` : ''}</dd>
            <dt>Merit score</dt><dd><b>{open.meritScore}</b> (matric {open.matricMarks}/{open.matricTotal}, inter {open.interMarks}/{open.interTotal}{open.testTotal ? `, test ${open.testMarks}/${open.testTotal}` : ''})</dd>
            <dt>Father</dt><dd>{open.fatherName}</dd>
            <dt>Gender / born</dt><dd>{label(open.gender)} · {fmtDate(open.dateOfBirth)}</dd>
            <dt>CNIC / B-Form</dt><dd>{open.nationalId}</dd>
            <dt>Contact</dt><dd>{open.email} · {open.phone}</dd>
            <dt>Address</dt><dd>{open.address}{open.city ? `, ${open.city}` : ''}</dd>
            <dt>Documents</dt>
            <dd>
              {open.documents.map((d) => <div key={d.file.storedName}><FileLink path={`/applications/${open._id}/files/${d.file.storedName}`} name={`${d.label} (${d.file.originalName})`} onError={fail} /></div>)}
              {!open.documents.length && '—'}
            </dd>
            <dt>History</dt>
            <dd>{open.history.map((h, i) => <div key={i} className="small">{fmtDateTime(h.at)} · <b>{label(h.status)}</b> · {h.by}{h.note ? ` — ${h.note}` : ''}</div>)}</dd>
          </dl>

          {!open.enrolledUser && (
            <form onSubmit={saveDecision}>
              <h4>Decision</h4>
              <div className="form-grid">
                <div>
                  <label>Set status</label>
                  <select value={decision.status} onChange={(e) => setDecision({ ...decision, status: e.target.value })}>
                    <option value="under_review">Under review</option>
                    <option value="needs_info">Needs more documents</option>
                    <option value="accepted">Accept</option>
                    <option value="rejected">Reject</option>
                  </select>
                </div>
              </div>
              <label>Message to the applicant {['needs_info', 'rejected'].includes(decision.status) ? '(required)' : '(optional)'}</label>
              <textarea rows={2} maxLength={1000} value={decision.remarks} onChange={(e) => setDecision({ ...decision, remarks: e.target.value })} />
              <button className="btn btn-primary">Save decision</button>
            </form>
          )}

          {isHod && open.status === 'accepted' && !open.enrolledUser && (
            <div className="mt">
              {!enroll
                ? <button className="btn" onClick={() => setEnroll({ rollNumber: '', password: '', semester: '', section: 'A' })}>Create student account…</button>
                : (
                  <form onSubmit={createStudent}>
                    <h4>Create the student account</h4>
                    <p className="muted small">The student logs in with {open.email}. You choose the first password and give it to them in person. They must change it at the first login.</p>
                    <div className="form-grid">
                      <div><label>Roll number</label><input required minLength={2} value={enroll.rollNumber} onChange={(e) => setEnroll({ ...enroll, rollNumber: e.target.value })} /></div>
                      <div><label>First password (min 8)</label><input required minLength={8} value={enroll.password} onChange={(e) => setEnroll({ ...enroll, password: e.target.value })} /></div>
                      <div>
                        <label>Semester (optional)</label>
                        <select value={enroll.semester} onChange={(e) => setEnroll({ ...enroll, semester: e.target.value })}>
                          <option value="">Place later</option>
                          {mySems.map((x) => <option key={x._id} value={x._id}>{x.name} ({x.academicYear})</option>)}
                        </select>
                      </div>
                      <div><label>Section</label><input maxLength={10} value={enroll.section} onChange={(e) => setEnroll({ ...enroll, section: e.target.value.toUpperCase() })} /></div>
                    </div>
                    <div className="actions">
                      <button className="btn btn-primary">Create account</button>
                      <button type="button" className="btn btn-ghost mt" onClick={() => setEnroll(null)}>Cancel</button>
                    </div>
                  </form>
                )}
            </div>
          )}
          {finished && <p className="muted small mt">{open.enrolledUser ? 'This applicant is now a student.' : 'This application was rejected.'}</p>}
        </div>
      )}

      <div className="card filters">
        <input placeholder="Search name, application number, email or CNIC..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All statuses</option>
          <option value="submitted">New</option>
          <option value="under_review">Under review</option>
          <option value="needs_info">Needs documents</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        {!isHod && (
          <select value={filter.department} onChange={(e) => setFilter({ ...filter, department: e.target.value })}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Application</th><th>Applicant</th><th>Programme</th><th>Merit</th><th>Applied</th><th>Status</th><th /></tr></thead>
          <tbody>
            {groups.map((list) => (
              <FragmentGroup key={list[0].department?._id} name={list[0].department?.name} count={list.length}>
                {list.map((a) => (
                  <tr key={a._id}>
                    <td className="ap-rank">{a.rank ?? '—'}</td>
                    <td>{a.applicationNumber}</td>
                    <td>{a.name}<div className="muted small">{a.email}</div></td>
                    <td>{a.program || '—'}</td>
                    <td><b>{a.meritScore}</b></td>
                    <td className="small">{fmtDate(a.createdAt)}</td>
                    <td><Badge value={a.status} text={label(a.status)} /></td>
                    <td><button className="btn btn-small" onClick={() => view(a._id)}>Open</button></td>
                  </tr>
                ))}
              </FragmentGroup>
            ))}
            {data && !rows.length && <tr><td colSpan={8} className="muted">No applications found.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">Rank is inside the department, among every applicant who has not been rejected. The merit score is calculated by the server from the marks entered on the form.</p>
    </>
  );
}

function FragmentGroup({ name, count, children }) {
  return (
    <>
      <tr className="ap-group"><td colSpan={8}>{name} · {count}</td></tr>
      {children}
    </>
  );
}
