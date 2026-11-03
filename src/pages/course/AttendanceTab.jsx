import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../../components/ui.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const STATUSES = [['present', 'Present'], ['absent', 'Absent'], ['leave', 'Leave']];

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

  if (isStudent) {
    const row = mine?.rows?.[0];
    return (
      <>
        <Alert msg={msg} />
        {!row && <div className="card muted">No attendance has been recorded yet.</div>}
        {row && (
          <div className="card">
            <div className="grid">
              <div className="stat"><span>{row.percent ?? '—'}{row.percent !== null && '%'}</span>Attendance</div>
              <div className="stat"><span>{row.present}</span>Present</div>
              <div className="stat"><span>{row.absent}</span>Absent</div>
              <div className="stat"><span>{row.leave}</span>Leave</div>
            </div>
            {row.belowLimit && <div className="alert alert-error">Below the required {mine.minPercent}%. This can affect examination admission.</div>}
            <h4>History</h4>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Status</th></tr></thead>
                <tbody>{row.history.map((h) => <tr key={h.date}><td>{fmtDate(h.date)}</td><td><Badge value={h.status} /></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <Alert msg={msg} />
      {isTeacher && sheet && (
        <div className="card">
          <div className="row-between">
            <h3>Mark attendance</h3>
            <div style={{ maxWidth: 180 }}><input type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {sheet.alreadyMarked && <div className="alert alert-info">Attendance for this date is already saved. Saving again replaces it.</div>}
          <div className="actions">
            {STATUSES.map(([v, t]) => <button key={v} className="btn btn-small" onClick={() => markAll(v)}>All {t.toLowerCase()}</button>)}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Status</th></tr></thead>
              <tbody>
                {sheet.students.map((s) => (
                  <tr key={s.student}>
                    <td>{s.rollNumber}</td>
                    <td>{s.name}</td>
                    <td>
                      {STATUSES.map(([v, t]) => (
                        <label key={v} className="check" style={{ display: 'inline-flex', marginRight: '.8rem' }}>
                          <input type="radio" name={`att-${s.student}`} checked={s.status === v} onChange={() => mark(s.student, v)} />{t}
                        </label>
                      ))}
                    </td>
                  </tr>
                ))}
                {!sheet.students.length && <tr><td colSpan={3} className="muted">No students are enrolled in this course.</td></tr>}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={!sheet.students.length}>Save attendance</button>
        </div>
      )}

      {summary && (
        <div className="card table-wrap">
          <h3>Attendance summary <span className="muted small">({summary.sessions} sessions, minimum {summary.minPercent}%)</span></h3>
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Present</th><th>Absent</th><th>Leave</th><th>%</th></tr></thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.student}>
                  <td>{r.rollNumber}</td><td>{r.name}</td><td>{r.present}</td><td>{r.absent}</td><td>{r.leave}</td>
                  <td>{r.percent === null ? '—' : <Badge value={r.belowLimit ? 'high' : 'low'} text={`${r.percent}%`} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
