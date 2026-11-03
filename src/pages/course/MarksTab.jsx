import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert, Badge, fmtDate } from '../../components/ui.jsx';

// Examination marks for ONE course. The teacher enters them, the HOD can unlock them, the head can only look.
export default function MarksTab({ courseId, role }) {
  const isTeacher = role === 'teacher';
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [eligibility, setEligibility] = useState(null);

  useEffect(() => {
    api.get('/examinations').then((r) => {
      const mine = r.data.data.filter((e) => e.status === 'published' && e.papers.some((p) => String(p.course?._id || p.course) === courseId));
      setExams(mine);
      if (mine.length === 1) setExamId(mine[0]._id);
    }).catch(fail);
  }, [courseId, fail]);

  const load = useCallback(() => {
    if (!examId) { setData(null); return; }
    api.get(`/marks/course/${courseId}`, { params: { examination: examId } })
      .then((r) => { setData(r.data.data); setRows(r.data.data.rows); })
      .catch((e) => { setData(null); fail(e); });
  }, [courseId, examId, fail]);
  useEffect(() => { load(); setEligibility(null); }, [load]);

  const setRow = (id, patch) => setRows(rows.map((r) => (r.student === id ? { ...r, ...patch } : r)));

  const save = async (submit) => {
    if (submit && !window.confirm('Submit and lock these marks? Only your HOD can unlock them afterwards.')) return;
    const entries = rows.map((r) => ({ student: r.student, absent: r.absent, marks: r.absent || r.marks === '' || r.marks === null ? null : Number(r.marks) }));
    try {
      await api.put(`/marks/course/${courseId}`, { examination: examId, entries, submit });
      ok(submit ? 'Marks submitted and locked' : 'Draft saved');
      load();
    } catch (err) { fail(err); }
  };

  const unlock = async () => {
    if (!window.confirm('Unlock these marks so the teacher can correct them?')) return;
    try { await api.post('/marks/unlock', { examination: examId, course: courseId }); ok('Marks unlocked'); load(); } catch (err) { fail(err); }
  };

  const loadEligibility = async () => {
    try { setEligibility((await api.get(`/admissions/course/${courseId}`, { params: { examination: examId } })).data.data); } catch (err) { fail(err); }
  };

  const canEdit = isTeacher && data && !data.locked;

  return (
    <>
      <Alert msg={msg} />
      {!exams.length && <div className="card muted">No published examination has a paper for this course yet.</div>}
      {exams.length > 0 && (
        <div className="card">
          <label>Examination</label>
          <select value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select...</option>
            {exams.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
        </div>
      )}

      {data && (
        <div className="card">
          <div className="row-between">
            <h3>{data.examination.name}</h3>
            <div>{data.locked ? <Badge value="closed" text="submitted and locked" /> : <Badge value="draft" />}</div>
          </div>
          <p className="muted">Paper date {fmtDate(data.paper.date)} · maximum {data.paper.maxMarks} · passing {data.paper.passingMarks}</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Marks</th><th>Absent</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student}>
                    <td>{r.rollNumber}</td>
                    <td>{r.name}</td>
                    <td style={{ width: 120 }}>
                      <input type="number" min={0} max={data.paper.maxMarks} disabled={!canEdit || r.absent} value={r.absent ? '' : r.marks ?? ''} onChange={(e) => setRow(r.student, { marks: e.target.value })} />
                    </td>
                    <td><input type="checkbox" disabled={!canEdit} checked={r.absent} onChange={(e) => setRow(r.student, { absent: e.target.checked })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="actions mt">
            {canEdit && <button className="btn btn-primary inline" onClick={() => save(false)}>Save draft</button>}
            {canEdit && <button className="btn inline" onClick={() => save(true)}>Submit and lock</button>}
            {isHod && data.locked && <button className="btn btn-danger inline" onClick={unlock}>Unlock for correction</button>}
            <button className="btn btn-ghost inline" onClick={loadEligibility}>Show exam admission status</button>
          </div>
          <p className="muted small">AI never enters or changes marks. Totals, percentage, grade and pass/fail are calculated by the server from the university grading rules.</p>
        </div>
      )}

      {eligibility && (
        <div className="card table-wrap">
          <h3>Admission status: {eligibility.examination.name}</h3>
          <table>
            <thead><tr><th>Roll</th><th>Student</th><th>Admission</th></tr></thead>
            <tbody>{eligibility.rows.map((r) => <tr key={r.student}><td>{r.rollNumber}</td><td>{r.name}</td><td><Badge value={r.admission.replace(' ', '_')} text={r.admission} /></td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
