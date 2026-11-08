import { Fragment, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, fmtDate, fmtDateTime, FileLink, label } from '../components/ui.jsx';
import './admission.css';

const STATUSES = ['submitted', 'under_review', 'needs_info', 'accepted', 'rejected'];
const REVIEW_OPTIONS = [['under_review', 'Under review'], ['needs_info', 'Needs more information'], ['accepted', 'Accept'], ['rejected', 'Reject']];

// New-student applications. The list IS the merit list: ranked by percentage inside each department, programme and intake.
// The University Head sees every department, an HOD only their own.
export default function Applications() {
  const user = useSelector((s) => s.auth.user);
  const isHead = user.role === 'university_head';
  const [msg, ok, fail, clear] = useFlash();
  const [data, setData] = useState({ summary: {}, applications: [] });
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ department: '', status: '', search: '', sort: 'merit' });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [review, setReview] = useState({ status: 'under_review', remarks: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    api.get('/applications', { params }).then((r) => setData(r.data.data)).catch(fail);
  }, [filters, fail]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (isHead) api.get('/departments').then((r) => setDepartments(r.data.data)).catch(() => {}); }, [isHead]);

  const open = async (id) => {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    try {
      const { data: res } = await api.get(`/applications/${id}`);
      setOpenId(id);
      setDetail(res.data);
      setReview({ status: res.data.status === 'submitted' ? 'under_review' : res.data.status, remarks: '' });
      clear();
    } catch (err) { fail(err); }
  };

  const saveReview = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: res } = await api.post(`/applications/${openId}/review`, review);
      setDetail(res.data);
      ok('Application updated. The applicant can see the new status and your message on the Track page.');
      load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const s = data.summary;
  let lastGroup = null;

  return (
    <div>
      <h1>New Applications</h1>
      <p className="muted">Students who applied through the public Apply page. Ranks are by percentage inside each department, programme and intake (equal percentages: the earlier application ranks higher).</p>
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
          <div>
            <label>Order</label>
            <select value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="merit">Merit list (rank)</option>
              <option value="date">Newest first</option>
            </select>
          </div>
        </div>
        <button type="button" className="btn btn-small" onClick={() => window.print()}>Print this list</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Rank</th><th>Application no.</th><th>Name</th><th>City</th><th>Marks</th><th>%</th><th>Applied</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.applications.map((a) => {
              const group = `${a.department?.name}|${a.programName}|${a.intake}`;
              const header = filters.sort === 'merit' && group !== lastGroup;
              lastGroup = group;
              return (
                <Fragment key={a._id}>
                  {header && <tr className="ap-group"><td colSpan={9}>{a.department?.name}{a.programName ? ` · ${a.programName}` : ''}{a.intake ? ` · ${a.intake}` : ''}</td></tr>}
                  <tr>
                    <td>{a.rank ? <span className="ap-rank">#{a.rank}</span> : <span className="muted">—</span>}</td>
                    <td>{a.applicationNumber}</td>
                    <td>{a.applicant.fullName}<div className="muted small">{a.applicant.email}</div></td>
                    <td>{a.applicant.city}</td>
                    <td>{a.education.obtainedMarks}/{a.education.totalMarks}</td>
                    <td><b>{a.education.percentage}%</b></td>
                    <td>{fmtDate(a.createdAt)}</td>
                    <td><Badge value={a.status} /></td>
                    <td><button className="btn btn-small" onClick={() => open(a._id)}>{openId === a._id ? 'Close' : 'Open'}</button></td>
                  </tr>
                  {openId === a._id && detail && (
                    <tr>
                      <td colSpan={9}>
                        <div className="ap-detail">
                          <dl>
                            <dt>Applicant</dt><dd>{detail.applicant.fullName}, son/daughter of {detail.applicant.fatherName} ({detail.applicant.gender})</dd>
                            <dt>Date of birth</dt><dd>{fmtDate(detail.applicant.dateOfBirth)}</dd>
                            <dt>CNIC / B-Form</dt><dd>{detail.applicant.cnic || '—'}</dd>
                            <dt>Contact</dt><dd>{detail.applicant.phone} · {detail.applicant.email}</dd>
                            <dt>Address</dt><dd>{detail.applicant.address}, {detail.applicant.city}</dd>
                            <dt>Last qualification</dt><dd>{label(detail.education.lastQualification)}, {detail.education.institution}{detail.education.board ? ` (${detail.education.board})` : ''}, {detail.education.passingYear}</dd>
                            <dt>Marks</dt><dd>{detail.education.obtainedMarks} of {detail.education.totalMarks} = <b>{detail.education.percentage}%</b></dd>
                            {detail.statement && (<><dt>Note</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{detail.statement}</dd></>)}
                            <dt>Documents</dt>
                            <dd>
                              {detail.documents.length ? detail.documents.map((d) => (
                                <div key={d.storedName}>{d.label}: <FileLink path={`/applications/${detail._id}/files/${d.storedName}`} name={d.originalName} onError={fail} /></div>
                              )) : '—'}
                            </dd>
                            <dt>History</dt>
                            <dd>
                              {detail.history.map((h, i) => (
                                <div key={i}><Badge value={h.status} /> <span className="muted small">{fmtDateTime(h.at)}{h.by ? ` · ${h.by.name}` : ''}</span>{h.remarks ? ` · ${h.remarks}` : ''}</div>
                              ))}
                            </dd>
                          </dl>

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
                            <p className="muted small">Accepting does not create a student account. The department does that when the student joins.</p>
                            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save decision'}</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!data.applications.length && <tr><td colSpan={9} className="muted">No applications yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
