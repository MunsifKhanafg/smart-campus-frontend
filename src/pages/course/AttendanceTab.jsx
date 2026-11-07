import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, fmtDate } from '../../components/ui.jsx';
import { colorAt, colorFor, initials, attendanceColor } from '../../components/palette.js';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = [['present', 'Present', 'p'], ['absent', 'Absent', 'a'], ['leave', 'Leave', 'l']];

// Teacher: mark attendance with one tap per student. Student: own percentage and history. HOD / head: summary.
export default function AttendanceTab({ courseId, role }) {
  const isTeacher = role === 'teacher';
  const isStudent = role === 'student';
  const [msg, ok, fail] = useFlash();
  const [date, setDate] = useState(today());
  const [sheet, setSheet] = useState(null);
  const [summary, setSummary] = useState(null);
  const [mine, setMine] = useState(null);

  const loadSheet = useCallback(() => {
    api.get(`/attendance/course/${courseId}/sheet`, { params: { date } }).then((r) => setSheet(r.data.data)).catch(fail);
  }, [courseId, date, fail]);

  const loadSummary = useCallback(() => {
    api.get(`/attendance/course/${courseId}/summary`).then((r) => setSummary(r.data.data)).catch(fail);
  }, [courseId, fail]);

  useEffect(() => {
    if (isStudent) api.get('/attendance/me', { params: { course: courseId } }).then((r) => setMine(r.data.data)).catch(fail);
    else loadSummary();
  }, [isStudent, courseId, loadSummary, fail]);
  useEffect(() => { if (!isStudent) loadSheet(); }, [isStudent, loadSheet]);

  const mark = (id, status) => setSheet({ ...sheet, students: sheet.students.map((s) => (s.student === id ? { ...s, status } : s)) });
  const markAll = (status) => setSheet({ ...sheet, students: sheet.students.map((s) => ({ ...s, status })) });

  const save = async () => {
    if (sheet.students.some((s) => !s.status)) return fail('Mark every student before saving');
    try {
      await api.put(`/attendance/course/${courseId}`, { date, records: sheet.students.map((s) => ({ student: s.student, status: s.status })) });
      ok('Attendance saved');
      loadSheet();
      loadSummary();
    } catch (err) { fail(err); }
  };

  // ---------------- student ----------------
  if (isStudent) {
    const row = mine?.rows?.[0];
    const min = mine?.minPercent ?? 75;
    const col = attendanceColor(row?.percent, min);
    return (
      <>
        <Alert msg={msg} />
        {!row && <div className="card muted">No attendance has been recorded yet.</div>}
        {row && (
          <div className="card">
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="cx-ring big" style={{ background: `conic-gradient(${col} ${row.percent ?? 0}%, #e5e7eb 0)` }}>
                <span>{row.percent === null ? '—' : `${row.percent}%`}</span>
              </div>
              <div className="grow">
                <div className="cx-kpis" style={{ margin: 0 }}>
                  <div className="cx-kpi" style={colorAt(2)}><b>{row.present}</b><span>Present</span></div>
                  <div className="cx-kpi" style={colorAt(6)}><b>{row.absent}</b><span>Absent</span></div>
                  <div className="cx-kpi" style={colorAt(3)}><b>{row.leave}</b><span>Leave</span></div>
                </div>
                <div className="cx-muted" style={{ marginTop: '.5rem' }}>Required: at least {min}% for examination admission.</div>
              </div>
            </div>
            {row.belowLimit && <div className="alert alert-error mt">Your attendance is below the required {min}%. This can affect examination admission.</div>}
            <h4>History</h4>
            <div className="cx-days">
              {row.history.map((h) => <span key={h.date} className={`cx-day ${h.status}`}>{fmtDate(h.date)} · {h.status}</span>)}
              {!row.history.length && <span className="muted">No classes recorded yet.</span>}
            </div>
          </div>
        )}
      </>
    );
  }

  // ---------------- teacher / HOD / head ----------------
  const counts = (sheet?.students || []).reduce((n, s) => { n[s.status || 'none'] = (n[s.status || 'none'] || 0) + 1; return n; }, {});

  return (
    <>
      <Alert msg={msg} />
      {isTeacher && sheet && (
        <div className="card">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>Mark attendance</h3>
            <div style={{ maxWidth: 180 }}><input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {sheet.alreadyMarked && <div className="alert alert-info mt">Attendance for this date is already saved. Saving again replaces it.</div>}

          <div className="cx-counter">
            <span className="p">Present {counts.present || 0}</span>
            <span className="a">Absent {counts.absent || 0}</span>
            <span className="l">Leave {counts.leave || 0}</span>
            {counts.none > 0 && <span>Not marked {counts.none}</span>}
          </div>
          <div className="actions">
            <button className="btn btn-small" onClick={() => markAll('present')}>✓ Everyone present</button>
            <button className="btn btn-small" onClick={() => markAll('absent')}>Everyone absent</button>
          </div>

          <div className="table-wrap mt">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Status</th></tr></thead>
              <tbody>
                {sheet.students.map((s) => (
                  <tr key={s.student} className={s.status ? `cx-row-${s.status}` : ''}>
                    <td>{s.rollNumber}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                        <span className="cx-av" style={{ ...colorFor(s.name), width: 30, height: 30, fontSize: '.7rem' }}>{initials(s.name)}</span>{s.name}
                      </div>
                    </td>
                    <td>
                      <div className="cx-seg">
                        {STATUSES.map(([v, t, k]) => (
                          <button key={v} type="button" className={`${k} ${s.status === v ? 'on' : ''}`} onClick={() => mark(s.student, v)}>{t}</button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!sheet.students.length && <tr><td colSpan={3} className="muted">No students are enrolled in this course.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="cx-savebar">
            <button className="btn btn-primary inline" onClick={save} disabled={!sheet.students.length}>Save attendance</button>
            <span className="cx-muted">{counts.none ? `${counts.none} student(s) still need a status.` : 'Everyone is marked.'}</span>
          </div>
        </div>
      )}

      {summary && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Attendance summary <span className="cx-muted">({summary.sessions} sessions, minimum {summary.minPercent}%)</span></h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th style={{ minWidth: 180 }}>Attendance</th></tr></thead>
              <tbody>
                {summary.rows.map((r) => (
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
                {!summary.rows.length && <tr><td colSpan={6} className="muted">No students are enrolled in this course.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
