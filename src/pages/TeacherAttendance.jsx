import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Tabs, fmtDate } from '../components/ui.jsx';
import { colorAt, colorFor, initials, attendanceColor } from '../components/palette.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const STATUSES = [['present', 'Present', 'p'], ['absent', 'Absent', 'a'], ['leave', 'Leave', 'l']];
const isoToday = () => new Date().toISOString().slice(0, 10);
const todayName = () => DAYS[(new Date().getDay() + 6) % 7];
const shift = (iso, n) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// The teacher's attendance desk: choose one of MY classes, take attendance in a few taps,
// see who is falling behind, look back at earlier days, export or print the summary.
export default function TeacherAttendance() {
  const settings = useSelector((s) => s.settings);
  const [msg, ok, fail, clear] = useFlash();
  const [classes, setClasses] = useState(null);
  const [minPercent, setMin] = useState(75);
  const [slots, setSlots] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState('take');

  const [date, setDate] = useState(isoToday());
  const [sheet, setSheet] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadClasses = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([api.get('/attendance/mine'), api.get('/timetables/mine').catch(() => ({ data: { data: [] } }))]);
      setClasses(c.data.data.rows);
      setMin(c.data.data.minPercent);
      setSlots(t.data.data);
    } catch (e) { fail(e); }
  }, [fail]);
  useEffect(() => { loadClasses(); }, [loadClasses]);

  // The class that meets today is opened first.
  useEffect(() => {
    if (!classes || courseId) return;
    const meetsToday = classes.find((r) => slots.some((s) => s.day === todayName() && s.course?._id === r.course._id));
    setCourseId((meetsToday || classes[0])?.course._id || '');
  }, [classes, slots, courseId]);

  const loadSheet = useCallback(() => {
    if (!courseId) return;
    setSheet(null);
    api.get(`/attendance/course/${courseId}/sheet`, { params: { date } }).then((r) => { setSheet(r.data.data); setDirty(false); }).catch(fail);
  }, [courseId, date, fail]);
  const loadSummary = useCallback(() => {
    if (!courseId) return;
    api.get(`/attendance/course/${courseId}/summary`).then((r) => setSummary(r.data.data)).catch(fail);
  }, [courseId, fail]);
  const loadSessions = useCallback(() => {
    if (!courseId) return;
    api.get(`/attendance/course/${courseId}/sessions`).then((r) => setSessions(r.data.data)).catch(fail);
  }, [courseId, fail]);

  useEffect(() => { setSummary(null); setSessions(null); setSearch(''); setOnlyOpen(false); setOnlyLow(false); loadSummary(); loadSessions(); }, [courseId, loadSummary, loadSessions]);
  useEffect(() => { loadSheet(); }, [loadSheet]);

  const guard = () => !dirty || window.confirm('You have unsaved attendance. Leave without saving?');
  const pickClass = (id) => { if (id === courseId || !guard()) return; clear(); setCourseId(id); setTab('take'); setDate(isoToday()); };
  const goDate = (d) => { if (d > isoToday() || !guard()) return; clear(); setDate(d); };

  const pctOf = useMemo(() => new Map((summary?.rows || []).map((r) => [String(r.student), r])), [summary]);
  const mark = (id, status) => { setSheet((s) => ({ ...s, students: s.students.map((x) => (x.student === id ? { ...x, status } : x)) })); setDirty(true); };
  const markAll = (status) => { setSheet((s) => ({ ...s, students: s.students.map((x) => ({ ...x, status })) })); setDirty(true); };
  const reset = () => { loadSheet(); };

  const save = async () => {
    if (sheet.students.some((s) => !s.status)) return fail('Mark every student before saving. Use "Everyone present" and then change the absentees.');
    setSaving(true);
    try {
      await api.put(`/attendance/course/${courseId}`, { date, records: sheet.students.map((s) => ({ student: s.student, status: s.status })) });
      ok(`Attendance for ${longDate(date)} saved`);
      setDirty(false);
      loadSheet(); loadSummary(); loadSessions(); loadClasses();
    } catch (err) { fail(err); } finally { setSaving(false); }
  };

  const cls = classes?.find((r) => r.course._id === courseId);
  const idx = Math.max(0, (classes || []).findIndex((r) => r.course._id === courseId));
  const todaySlot = (id) => slots.find((s) => s.day === todayName() && s.course?._id === id);

  const counts = (sheet?.students || []).reduce((n, s) => { n[s.status || 'none'] = (n[s.status || 'none'] || 0) + 1; return n; }, {});
  const shown = (sheet?.students || []).filter((s) => {
    const q = search.trim().toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || s.rollNumber.toLowerCase().includes(q)) && (!onlyOpen || !s.status);
  });
  const sumRows = (summary?.rows || []).filter((r) => {
    const q = search.trim().toLowerCase();
    return (!q || r.name.toLowerCase().includes(q) || r.rollNumber.toLowerCase().includes(q)) && (!onlyLow || r.belowLimit);
  });
  const withData = (summary?.rows || []).filter((r) => r.percent !== null);
  const avg = withData.length ? Math.round(withData.reduce((n, r) => n + r.percent, 0) / withData.length) : null;

  const exportCsv = () => {
    const rows = [['Roll', 'Name', 'Present', 'Absent', 'Leave', 'Attendance %']].concat(
      (summary?.rows || []).map((r) => [r.rollNumber, r.name, r.present, r.absent, r.leave, r.percent ?? ''])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `attendance-${cls?.course.code || 'class'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!classes) return <><h1>Attendance</h1><Alert msg={msg} />{!msg.text && <p className="muted">Loading your classes...</p>}</>;

  return (
    <>
      <div className="no-print">
        <h1>Attendance</h1>
        <p className="muted">Choose one of your classes, then take attendance in a few taps. Students below {minPercent}% are flagged.</p>
        <Alert msg={msg} />
      </div>
      {!classes.length && <div className="card muted no-print">No classes have been assigned to you yet.</div>}

      {/* ---------- my classes ---------- */}
      <div className="cx-subjects no-print">
        {classes.map((r, i) => {
          const slot = todaySlot(r.course._id);
          const col = attendanceColor(r.averagePercent, minPercent);
          return (
            <div key={r.course._id} className={`cx-subj clickable ${r.course._id === courseId ? 'on' : ''}`} style={colorAt(i)} onClick={() => pickClass(r.course._id)}>
              <div className="cx-subj-head">
                <div className="grow">
                  <div className="code">{r.course.code} · Section {r.course.section}</div>
                  <h4>{r.course.title}</h4>
                </div>
                <span className="cx-credit">{r.course.creditHours} cr</span>
              </div>
              <div className="cx-subj-body">
                <div className="cx-muted small">{r.semester?.name}</div>
                <div className="cx-att-card" style={{ padding: 0 }}>
                  <div className="cx-ring" style={{ background: `conic-gradient(${col} ${r.averagePercent ?? 0}%, #e5e7eb 0)` }}>
                    <span>{r.averagePercent === null ? '—' : `${Math.round(r.averagePercent)}%`}</span>
                  </div>
                  <div className="grow">
                    <div className="cx-meta">
                      <span className="cx-chip">{r.students} students</span>
                      <span className="cx-chip">{r.sessions} classes held</span>
                      {r.belowLimit > 0 ? <span className="cx-chip bad">{r.belowLimit} below {minPercent}%</span> : r.sessions > 0 && <span className="cx-chip ok">All above {minPercent}%</span>}
                    </div>
                  </div>
                </div>
                {slot && <div className="small">🕘 Today <b>{slot.startTime} - {slot.endTime}</b> · Room {slot.room}</div>}
                <div>
                  {r.markedToday
                    ? <span className="cx-chip ok">✓ Today's attendance taken</span>
                    : <span className="cx-chip" style={{ background: '#fef3c7', color: '#92400e' }}>{slot ? 'Not taken yet today' : 'Not taken today'}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------- the chosen class ---------- */}
      {cls && (
        <div className="card mt no-print" style={{ borderTop: `5px solid ${colorAt(idx)['--c1']}` }}>
          <div className="row-between">
            <div>
              <h3 style={{ margin: 0 }}>{cls.course.code} · {cls.course.title}</h3>
              <div className="cx-muted">{cls.semester?.name} · Section {cls.course.section} · {cls.students} students</div>
            </div>
          </div>
          <Tabs tabs={[['take', 'Take attendance'], ['summary', 'Summary & reports'], ['history', `History (${sessions?.length ?? 0})`]]} active={tab} onChange={(t) => { if (tab === 'take' && !guard()) return; setTab(t); setSearch(''); }} />

          {/* ----- take ----- */}
          {tab === 'take' && (
            <>
              <div className="inline-form" style={{ marginBottom: '.75rem' }}>
                <div style={{ flex: 'none', minWidth: 0 }}>
                  <div className="actions">
                    <button className="btn btn-small" onClick={() => goDate(shift(date, -1))} aria-label="Previous day">‹ Previous</button>
                    <input type="date" style={{ width: 160 }} max={isoToday()} value={date} onChange={(e) => e.target.value && goDate(e.target.value)} />
                    <button className="btn btn-small" disabled={date >= isoToday()} onClick={() => goDate(shift(date, 1))}>Next ›</button>
                    {date !== isoToday() && <button className="btn btn-small btn-primary" onClick={() => goDate(isoToday())}>Today</button>}
                  </div>
                </div>
                <div className="grow"><b>{longDate(date)}</b></div>
              </div>

              {!sheet && <p className="muted">Loading class list...</p>}
              {sheet && (
                <>
                  {sheet.alreadyMarked && <div className="alert alert-info">Attendance for this day is already saved. Saving again replaces it.</div>}
                  <div className="cx-counter">
                    <span className="p">Present {counts.present || 0}</span>
                    <span className="a">Absent {counts.absent || 0}</span>
                    <span className="l">Leave {counts.leave || 0}</span>
                    {counts.none > 0 && <span>Not marked {counts.none}</span>}
                  </div>
                  <div className="actions" style={{ margin: '.5rem 0' }}>
                    <button className="btn btn-small btn-primary" onClick={() => markAll('present')}>✓ Everyone present</button>
                    <button className="btn btn-small" onClick={() => markAll('absent')}>Everyone absent</button>
                    {dirty && <button className="btn btn-small btn-ghost" onClick={reset}>Undo changes</button>}
                    <input style={{ maxWidth: 220, marginLeft: 'auto' }} placeholder="Find student or roll..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Only not marked</label>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Roll</th><th>Student</th><th>So far</th><th>Today</th></tr></thead>
                      <tbody>
                        {shown.map((s) => {
                          const info = pctOf.get(String(s.student));
                          return (
                            <tr key={s.student} className={s.status ? `cx-row-${s.status}` : ''}>
                              <td>{s.rollNumber}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                                  <span className="cx-av" style={{ ...colorFor(s.name), width: 30, height: 30, fontSize: '.7rem' }}>{initials(s.name)}</span>{s.name}
                                </div>
                              </td>
                              <td>
                                {info?.percent == null ? <span className="muted small">new</span> : (
                                  <b style={{ color: attendanceColor(info.percent, minPercent) }} title={`${info.present} present, ${info.absent} absent, ${info.leave} leave`}>
                                    {info.percent}%{info.belowLimit ? ' ⚠' : ''}
                                  </b>
                                )}
                              </td>
                              <td>
                                <div className="cx-seg">
                                  {STATUSES.map(([v, t, k]) => (
                                    <button key={v} type="button" className={`${k} ${s.status === v ? 'on' : ''}`} onClick={() => mark(s.student, v)}>{t}</button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!shown.length && <tr><td colSpan={4} className="muted">{sheet.students.length ? 'No student matches.' : 'No students are enrolled in this class.'}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="cx-savebar">
                    <button className="btn btn-primary inline" onClick={save} disabled={saving || !sheet.students.length}>{saving ? 'Saving...' : 'Save attendance'}</button>
                    <span className="cx-muted">{counts.none ? `${counts.none} student(s) still need a status.` : dirty ? 'Everyone is marked. Press Save.' : 'Everyone is marked.'}</span>
                  </div>
                </>
              )}
            </>
          )}

          {/* ----- summary ----- */}
          {tab === 'summary' && (
            <>
              {!summary && <p className="muted">Loading...</p>}
              {summary && (
                <>
                  <div className="cx-kpis">
                    <div className="cx-kpi" style={colorAt(0)}><b>{summary.rows.length}</b><span>Students</span></div>
                    <div className="cx-kpi" style={colorAt(2)}><b>{avg === null ? '—' : `${avg}%`}</b><span>Class average</span></div>
                    <div className="cx-kpi" style={colorAt(6)}><b>{summary.rows.filter((r) => r.belowLimit).length}</b><span>Below {summary.minPercent}%</span></div>
                    <div className="cx-kpi" style={colorAt(1)}><b>{summary.sessions}</b><span>Classes held</span></div>
                  </div>
                  <div className="actions" style={{ margin: '.75rem 0' }}>
                    <input style={{ maxWidth: 240 }} placeholder="Find student or roll..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Only below {summary.minPercent}%</label>
                    <span style={{ marginLeft: 'auto' }} className="actions">
                      <button className="btn btn-small" onClick={exportCsv}>⬇ Download CSV</button>
                      <button className="btn btn-small" onClick={() => window.print()}>🖨️ Print</button>
                    </span>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th style={{ minWidth: 190 }}>Attendance</th></tr></thead>
                      <tbody>
                        {sumRows.map((r) => (
                          <tr key={r.student} className={r.belowLimit ? 'cx-row-absent' : ''}>
                            <td>{r.rollNumber}</td><td>{r.name}</td>
                            <td><span className="cx-chip ok">{r.present}</span></td>
                            <td><span className="cx-chip bad" style={{ fontWeight: 400 }}>{r.absent}</span></td>
                            <td><span className="cx-chip">{r.leave}</span></td>
                            <td>
                              {r.percent === null ? <span className="muted">—</span> : (
                                <div className="row-between" style={{ gap: '.6rem', flexWrap: 'nowrap' }}>
                                  <div className="cx-bar" style={{ flex: 1 }}><i className={r.belowLimit ? 'low' : r.percent < summary.minPercent + 10 ? 'mid' : ''} style={{ width: `${Math.min(100, r.percent)}%` }} /></div>
                                  <b style={{ color: attendanceColor(r.percent, summary.minPercent), minWidth: 44, textAlign: 'right' }}>{r.percent}%</b>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                        {!sumRows.length && <tr><td colSpan={6} className="muted">{onlyLow ? `Nobody is below ${summary.minPercent}%.` : 'No students found.'}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ----- history ----- */}
          {tab === 'history' && (
            <>
              {!sessions && <p className="muted">Loading...</p>}
              {sessions && !sessions.length && <p className="muted">No attendance has been taken for this class yet.</p>}
              {sessions && sessions.length > 0 && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Day</th><th>Present</th><th>Absent</th><th>Leave</th><th>Present rate</th><th /></tr></thead>
                    <tbody>
                      {sessions.map((s) => {
                        const rate = s.total ? Math.round((s.present / s.total) * 100) : null;
                        const d = new Date(s.date).toISOString().slice(0, 10);
                        return (
                          <tr key={d}>
                            <td><b>{longDate(d)}</b></td>
                            <td><span className="cx-chip ok">{s.present}</span></td>
                            <td><span className="cx-chip bad" style={{ fontWeight: 400 }}>{s.absent}</span></td>
                            <td><span className="cx-chip">{s.leave}</span></td>
                            <td><b style={{ color: attendanceColor(rate, minPercent) }}>{rate === null ? '—' : `${rate}%`}</b></td>
                            <td><button className="btn btn-small" onClick={() => { setDate(d); setTab('take'); }}>Open / edit</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------- print sheet (only this prints) ---------- */}
      {cls && summary && (
        <div className="print-sheet">
          <div className="ps-head">
            <h1>{settings.universityName}</h1>
            <h2>Attendance report · {cls.course.code} {cls.course.title}</h2>
            <div className="ps-sub">{cls.semester?.name} · Section {cls.course.section} · {summary.sessions} classes held · minimum {summary.minPercent}% · printed {fmtDate(new Date())}</div>
          </div>
          <table className="ps-table">
            <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th>Attendance</th></tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.student}><td>{r.rollNumber}</td><td>{r.name}</td><td>{r.present}</td><td>{r.absent}</td><td>{r.leave}</td><td>{r.percent === null ? '—' : `${r.percent}%${r.belowLimit ? ' (below limit)' : ''}`}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="ps-foot"><div>Teacher: ____________________</div><div>HOD: ____________________</div></div>
        </div>
      )}
    </>
  );
}
