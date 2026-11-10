import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, FileLink, fmtDate, fmtDateTime, label } from '../components/ui.jsx';
import './admission.css';

const STATUSES = ['submitted', 'under_review', 'needs_info', 'accepted', 'rejected'];
const REVIEW_OPTIONS = [['under_review', 'Under review'], ['needs_info', 'Needs more documents'], ['accepted', 'Accept'], ['rejected', 'Reject']];

// New-student applications from the public Apply page.
// University Head: every department. HOD: applicants whose first choice is their own department.
// The list is ordered by merit score; the rank is inside the department among everybody who is not rejected.
// HOD: an accepted applicant can be turned into a student account.
export default function Applications() {
  const user = useSelector((s) => s.auth.user);
  const isHead = user.role === 'university_head';
  const isHod = user.role === 'hod';
  const [msg, ok, fail, clear] = useFlash();
  const [data, setData] = useState({ summary: {}, rows: [] });
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [filters, setFilters] = useState({ department: '', status: '', search: '' });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [review, setReview] = useState({ status: 'under_review', remarks: '' });
  const [enroll, setEnroll] = useState(null); // { rollNumber, password, semester, section }
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/applications', { params })
      .then((r) => setData({ summary: r.data.data.summary || {}, rows: r.data.data.rows || [] }))
      .catch(fail);
  }, [filters, fail]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  useEffect(() => { if (isHead) api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {}); }, [isHead]);
  useEffect(() => {
    if (isHod) api.get('/semesters').then((r) => setSemesters(r.data.data.filter((s) => !['completed', 'archived'].includes(s.status)))).catch(() => {});
  }, [isHod]);

  const open = async (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    try {
      const { data: res } = await api.get(`/applications/${id}`);
      setOpenId(id);
      setDetail(res.data);
      setReview({ status: res.data.status === 'submitted' ? 'under_review' : res.data.status, remarks: '' });
      setEnroll(null);
      clear();
    } catch (err) { fail(err); }
  };

  const saveReview = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: res } = await api.post(`/applications/${openId}/review`, { status: review.status, remarks: review.remarks || undefined });
      setDetail((d) => ({ ...d, ...res.data }));
      ok('Decision saved. The applicant sees it on the Track page.');
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const createStudent = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { rollNumber: enroll.rollNumber, password: enroll.password };
      if (enroll.semester) body.semester = enroll.semester;
      if (enroll.section) body.section = enroll.section;
      const { data: res } = await api.post(`/applications/${openId}/enroll`, body);
      ok(`Student account created (roll number ${res.data.rollNumber}). Give the first password to the student in person.`);
      setEnroll(null);
      const { data: fresh } = await api.get(`/applications/${openId}`);
      setDetail(fresh.data);
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const s = data.summary;
  const groups = [...new Set(data.rows.map((r) => r.department?._id))];
  const mySems = semesters.filter((x) => !detail || String(x.department?._id) === String(detail.department?._id));

  return (
    <div>
      <h1>New Applications</h1>
      <p className="muted">Students who applied through the public Apply page. The rank is inside the department, by merit score, among everybody who has not been rejected.</p>
      <Alert msg={msg} />

      <div className="ap-summary">
        <div><b>{s.total ?? 0}</b><small>All applications</small></div>
        {STATUSES.map((k) => <div key={k}><b>{s[k] ?? 0}</b><small>{label(k)}</small></div>)}
      </div>

      <div className="card filters">
        <div className="form-grid">
          {isHead && (
            <div>
              <label>Department</label>
              <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label>Status</label>
            <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">All</option>
              {STATUSES.map((k) => <option key={k} value={k}>{label(k)}</option>)}
            </select>
          </div>
          <div><label>Search (name, number, email, CNIC)</label><input value={filters.search} onChange={(e) => set('search', e.target.value)} /></div>
        </div>
        <button type="button" className="btn btn-small" onClick={() => window.print()}>Print this list</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Application no.</th><th>Name</th><th>Programme</th><th>Merit</th><th>Applied</th><th>Status</th><th /></tr></thead>
          <tbody>
            {groups.map((deptId) => {
              const list = data.rows.filter((r) => r.department?._id === deptId);
              return (
                <Fragment key={deptId}>
                  <tr className="ap-group"><td colSpan={8}>{list[0].department?.name} · {list.length}</td></tr>
                  {list.map((a) => (
                    <Fragment key={a._id}>
                      <tr>
                        <td>{a.rank ? <span className="ap-rank">#{a.rank}</span> : <span className="muted">—</span>}</td>
                        <td>{a.applicationNumber}</td>
                        <td>{a.name}<div className="muted small">{a.email}</div></td>
                        <td>{a.program || '—'}</td>
                        <td><b>{a.meritScore}</b>{a.merit?.called && <div><span className="adm-chip">Interview call</span></div>}</td>
                        <td className="small">{fmtDate(a.createdAt)}</td>
                        <td><Badge value={a.status} text={label(a.status)} /></td>
                        <td><button className="btn btn-small" onClick={() => open(a._id)}>{openId === a._id ? 'Close' : 'Open'}</button></td>
                      </tr>
                      {openId === a._id && detail && (
                        <tr>
                          <td colSpan={8}>
                            <div className="ap-detail">
                              <dl>
                                <dt>Choice</dt><dd>{detail.department?.name}{detail.program ? ` · ${detail.program}` : ''}{detail.secondDepartment ? ` (second choice: ${detail.secondDepartment.name})` : ''}</dd>
                                <dt>Merit score</dt>
                                <dd><b>{detail.meritScore}</b> (matric {detail.matricMarks}/{detail.matricTotal}, intermediate {detail.interMarks}/{detail.interTotal}{detail.testTotal ? `, entry test ${detail.testMarks}/${detail.testTotal}` : ''})</dd>
                                <dt>Applicant</dt><dd>{detail.name}, son/daughter of {detail.fatherName} ({label(detail.gender)}), born {fmtDate(detail.dateOfBirth)}</dd>
                                <dt>CNIC / B-Form</dt><dd>{detail.nationalId}</dd>
                                <dt>Contact</dt><dd>{detail.phone} · {detail.email}</dd>
                                <dt>Address</dt><dd>{detail.address}{detail.city ? `, ${detail.city}` : ''}</dd>
                                <dt>Documents</dt>
                                <dd>
                                  {detail.documents?.length ? detail.documents.map((d) => (
                                    <div key={d.file.storedName}>{d.label}: <FileLink path={`/applications/${detail._id}/files/${d.file.storedName}`} name={d.file.originalName} onError={fail} /></div>
                                  )) : '—'}
                                </dd>
                                <dt>History</dt>
                                <dd>
                                  {detail.history?.map((h, i) => (
                                    <div key={i} className="small"><Badge value={h.status} text={label(h.status)} /> {fmtDateTime(h.at)} · {h.by}{h.note ? ` — ${h.note}` : ''}</div>
                                  ))}
                                </dd>
                              </dl>

                              {!detail.enrolledUser && (
                                <form onSubmit={saveReview}>
                                  <div className="form-grid">
                                    <div>
                                      <label>Decision</label>
                                      <select value={review.status} onChange={(e) => setReview({ ...review, status: e.target.value })}>
                                        {REVIEW_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <label>Message to the applicant {['needs_info', 'rejected'].includes(review.status) ? '(required)' : '(optional)'}</label>
                                      <input maxLength={1000} value={review.remarks} onChange={(e) => setReview({ ...review, remarks: e.target.value })} />
                                    </div>
                                  </div>
                                  <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save decision'}</button>
                                </form>
                              )}

                              {isHod && detail.status === 'accepted' && !detail.enrolledUser && (
                                <div style={{ marginTop: '.8rem' }}>
                                  {!enroll ? (
                                    <button className="btn" onClick={() => setEnroll({ rollNumber: '', password: '', semester: '', section: 'A' })}>Create student account…</button>
                                  ) : (
                                    <form onSubmit={createStudent}>
                                      <p className="muted small">The student logs in with {detail.email}. You choose the first password and give it to them in person. They must change it at the first login.</p>
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
                                        <button className="btn btn-primary" disabled={busy}>Create account</button>
                                        <button type="button" className="btn btn-ghost mt" onClick={() => setEnroll(null)}>Cancel</button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                              )}
                              {detail.enrolledUser && <p className="muted small">This applicant is now a student.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </Fragment>
              );
            })}
            {!data.rows.length && <tr><td colSpan={8} className="muted">No applications yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
