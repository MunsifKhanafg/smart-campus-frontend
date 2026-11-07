import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api, { errorMessage } from '../api/axios.js';
import { fmtDate } from '../components/ui.jsx';
import { colorAt, colorFor, initials, attendanceColor } from '../components/palette.js';

const isOpen = (s) => ['upcoming', 'active'].includes(s.status);

// Attendance, step by step: semester -> subject -> students.
// The HOD sees their own department, the University Head can pick any department.
export default function Attendance() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // course id whose students are shown
  const [detail, setDetail] = useState(null);
  const [onlyLow, setOnlyLow] = useState(false);

  useEffect(() => {
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch((e) => setError(errorMessage(e)));
    if (isHead) api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
  }, [isHead]);

  // Open semesters first, then the finished ones. The same order is used for the colours.
  const visible = useMemo(() => {
    const list = semesters.filter((s) => !department || s.department?._id === department);
    return [...list.filter(isOpen), ...list.filter((s) => !isOpen(s))];
  }, [semesters, department]);

  useEffect(() => {
    if (semester && visible.some((s) => s._id === semester)) return;
    setSemester(visible[0]?._id || '');
  }, [visible, semester]);

  useEffect(() => {
    setData(null); setOpen(null); setDetail(null);
    if (!semester) return;
    const params = { semester };
    if (department) params.department = department;
    api.get('/attendance/department', { params })
      .then((r) => { setData(r.data.data); setError(''); })
      .catch((e) => setError(errorMessage(e)));
  }, [semester, department]);

  const toggle = async (courseId) => {
    if (open === courseId) { setOpen(null); return; }
    setOpen(courseId); setDetail(null); setOnlyLow(false);
    try { setDetail((await api.get(`/attendance/course/${courseId}/summary`)).data.data); } catch (e) { setError(errorMessage(e)); }
  };

  const semIndex = Math.max(0, visible.findIndex((s) => s._id === semester));
  const sem = visible[semIndex];
  const min = data?.minPercent ?? 75;
  const openRow = data?.rows.find((r) => r.course._id === open);
  const openIndex = Math.max(0, (data?.rows || []).findIndex((r) => r.course._id === open));

  const students = (detail?.rows || []).filter((s) => !onlyLow || s.belowLimit);
  const withData = (detail?.rows || []).filter((s) => s.percent !== null);

  return (
    <>
      <div className="row-between">
        <h1>Attendance</h1>
        {isHead && (
          <select style={{ width: 'auto' }} value={department} onChange={(e) => { setDepartment(e.target.value); setSemester(''); }}>
            <option value="">All departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        )}
      </div>
      <p className="muted">Choose a semester, then a subject, to see every student's attendance.</p>
      {error && <div className="alert alert-error">{error}</div>}

      {!visible.length && !error && <div className="card muted">No semesters found.</div>}

      {visible.length > 0 && (
        <>
          <h3 className="cx-title"><span className="num">1</span> Choose a semester</h3>
          <div className="cx-sems">
            {visible.map((s, i) => (
              <button key={s._id} type="button" style={colorAt(i)} className={`cx-sem ${s._id === semester ? 'on' : ''}`} onClick={() => setSemester(s._id)}>
                <b>{s.name}</b>
                <small>{isHead && s.department?.code ? `${s.department.code} · ` : ''}{s.academicYear} · Semester {s.number}</small>
                <small>{fmtDate(s.startDate)} to {fmtDate(s.endDate)}</small>
                <div className="cx-tags"><span className="cx-tag">{s.status}</span></div>
              </button>
            ))}
          </div>
        </>
      )}

      {sem && (
        <>
          <h3 className="cx-title"><span className="num">2</span> Subjects of {sem.name}</h3>
          {!data && !error && <p className="muted">Loading attendance...</p>}
          {data && !data.rows.length && <div className="card muted">No classes in this semester yet.</div>}

          <div className="cx-subjects">
            {data?.rows.map((r, i) => {
              const pct = r.averagePercent;
              const col = attendanceColor(pct, min);
              return (
                <div key={r.course._id} className={`cx-subj clickable ${open === r.course._id ? 'on' : ''}`} style={colorAt(semIndex + i)} onClick={() => toggle(r.course._id)}>
                  <div className="cx-subj-head">
                    <div className="grow">
                      <div className="code">{r.course.code}{r.course.section ? ` · Section ${r.course.section}` : ''}</div>
                      <h4>{r.course.title}</h4>
                    </div>
                  </div>
                  <div className="cx-subj-body">
                    <div className="cx-att-card" style={{ padding: 0 }}>
                      <div className="cx-ring" style={{ background: `conic-gradient(${col} ${pct ?? 0}%, #e5e7eb 0)` }}>
                        <span>{pct === null ? '—' : `${pct}%`}</span>
                      </div>
                      <div className="grow">
                        <div className="cx-class" style={r.teacher ? colorFor(r.teacher) : undefined}>
                          <span className={`cx-av ${r.teacher ? '' : 'empty'}`}>{r.teacher ? initials(r.teacher) : '?'}</span>
                          <div className="who">{r.teacher || <span style={{ color: '#b91c1c' }}>No teacher</span>}</div>
                        </div>
                        <div className="cx-meta">
                          <span className="cx-chip">{r.students} students</span>
                          {r.belowLimit > 0 ? <span className="cx-chip bad">{r.belowLimit} below {min}%</span> : pct !== null && <span className="cx-chip ok">All above {min}%</span>}
                          {pct === null && <span className="cx-chip">No attendance yet</span>}
                        </div>
                      </div>
                    </div>
                    <div className="cx-actions"><button type="button" className="btn btn-small btn-primary">{open === r.course._id ? 'Hide students' : 'View students'}</button></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {open && openRow && (
        <div className="cx-detail" style={{ borderTop: `5px solid ${colorAt(semIndex + openIndex)['--c1']}` }}>
          <div className="row-between">
            <div>
              <h3 style={{ margin: 0 }}>{openRow.course.code} — {openRow.course.title}</h3>
              <div className="cx-muted">{openRow.teacher || 'No teacher'} · {detail ? `${detail.sessions} class sessions held` : 'loading...'}</div>
            </div>
            <div className="actions">
              <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Only below {min}%</label>
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>

          {!detail ? <p className="muted">Loading...</p> : (
            <>
              <div className="cx-kpis">
                <div className="cx-kpi" style={colorAt(0)}><b>{detail.rows.length}</b><span>Students</span></div>
                <div className="cx-kpi" style={colorAt(2)}><b>{withData.length ? Math.round(withData.reduce((n, s) => n + s.percent, 0) / withData.length) : '—'}{withData.length ? '%' : ''}</b><span>Average attendance</span></div>
                <div className="cx-kpi" style={colorAt(6)}><b>{detail.rows.filter((s) => s.belowLimit).length}</b><span>Below {min}%</span></div>
                <div className="cx-kpi" style={colorAt(1)}><b>{detail.sessions}</b><span>Sessions held</span></div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th style={{ minWidth: 190 }}>Attendance</th></tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.student} className={s.belowLimit ? 'cx-row-absent' : ''}>
                        <td>{s.rollNumber}</td>
                        <td>{s.name}</td>
                        <td><span className="cx-chip ok">{s.present ?? 0}</span></td>
                        <td><span className="cx-chip bad" style={{ fontWeight: 400 }}>{s.absent ?? 0}</span></td>
                        <td><span className="cx-chip">{s.leave ?? 0}</span></td>
                        <td>
                          {s.percent === null ? <span className="muted">—</span> : (
                            <div className="row-between" style={{ gap: '.6rem', flexWrap: 'nowrap' }}>
                              <div className="cx-bar" style={{ flex: 1 }}><i className={s.belowLimit ? 'low' : s.percent < min + 10 ? 'mid' : ''} style={{ width: `${Math.min(100, s.percent)}%` }} /></div>
                              <b style={{ color: attendanceColor(s.percent, min), minWidth: 44, textAlign: 'right' }}>{s.percent}%</b>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!students.length && <tr><td colSpan={6} className="muted">{onlyLow ? `Nobody is below ${min}%.` : 'No enrolled students.'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
