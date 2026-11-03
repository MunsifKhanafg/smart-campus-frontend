import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api/axios.js';
import { fmtDate } from './ui.jsx';

// HOD tool: when a semester is finished, move its students to the next semester (for example 1 -> 2).
// The HOD decides who moves, so students who failed or are held back can simply be unticked.
export default function PromotePanel({ semester, onDone, onCancel }) {
  const [targets, setTargets] = useState(null);
  const [students, setStudents] = useState(null);
  const [target, setTarget] = useState('');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const finished = semester.status === 'completed' || new Date(semester.endDate) <= new Date();

  useEffect(() => {
    Promise.all([api.get('/semesters'), api.get('/students', { params: { semester: semester._id } })])
      .then(([s, st]) => {
        const opts = s.data.data
          .filter((x) => x._id !== semester._id && ['upcoming', 'active'].includes(x.status) && x.number > semester.number)
          .sort((a, b) => a.number - b.number);
        setTargets(opts);
        setTarget((opts.find((x) => x.number === semester.number + 1) || opts[0])?._id || '');
        const active = st.data.data.filter((p) => p.status === 'active');
        setStudents(active);
        setSelected(active.map((p) => p._id));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [semester]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const promote = async () => {
    const to = targets.find((t) => t._id === target);
    if (!window.confirm(`Move ${selected.length} student(s) from ${semester.name} to ${to?.name}?`)) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/semesters/${semester._id}/promote`, { toSemester: target, students: selected });
      setResult(data.data);
      onDone?.(data.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card">
        <div className="alert alert-success">
          {result.promoted} student(s) moved to <b>{result.to.name}</b> and enrolled in {result.courses} course(s).
          {result.semesterCompleted ? ' The old semester is now marked completed.' : ` ${result.remaining} student(s) are still in the old semester, so it stays open.`}
        </div>
        <button className="btn btn-ghost" onClick={onCancel}>Close</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Promote students from {semester.name}</h3>
      {!finished && (
        <div className="alert alert-info">
          This semester ends on <b>{fmtDate(semester.endDate)}</b>. Students can be promoted once it has finished.
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {!targets || !students ? <p className="muted">Loading...</p> : (
        <>
          {!targets.length ? (
            <div className="alert alert-info">
              There is no next semester yet. <Link to="/semesters">Create the next semester</Link> (with a higher number) first, then come back here.
            </div>
          ) : (
            <>
              <label>Move students to</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={!finished}>
                {targets.map((t) => <option key={t._id} value={t._id}>{t.name} (semester {t.number}, {t.academicYear})</option>)}
              </select>

              <div className="row-between" style={{ marginTop: '1rem' }}>
                <strong>{selected.length} of {students.length} students will move</strong>
                <span className="actions">
                  <button type="button" className="btn btn-small" onClick={() => setSelected(students.map((p) => p._id))}>Select all</button>
                  <button type="button" className="btn btn-small" onClick={() => setSelected([])}>Select none</button>
                </span>
              </div>
              <p className="muted small">Untick students who failed or must repeat the semester. They stay in the current semester.</p>
              <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th /><th>Roll</th><th>Name</th><th>Section</th></tr></thead>
                  <tbody>
                    {students.map((p) => (
                      <tr key={p._id}>
                        <td><input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} /></td>
                        <td>{p.rollNumber}</td><td>{p.user?.name}</td><td>{p.section}</td>
                      </tr>
                    ))}
                    {!students.length && <tr><td colSpan={4} className="muted">No active students in this semester.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="actions">
            <button className="btn btn-primary" disabled={busy || !finished || !target || !selected.length} onClick={promote}>
              {busy ? 'Moving...' : 'Promote selected students'}
            </button>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
