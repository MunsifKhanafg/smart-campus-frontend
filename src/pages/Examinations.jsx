import { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import { useFlash, Alert, Badge, Tabs, fmtDate, downloadSafe } from '../components/ui.jsx';

const EXAM_EMPTY = { semester: '', name: '', type: 'midterm', description: '', startDate: '', endDate: '' };
const PAPER_EMPTY = { course: '', date: '', startTime: '09:00', endTime: '12:00', room: '', maxMarks: 100, passingMarks: 40 };

// HOD: builds the date sheet, publishes it, calculates and publishes results.
// Head: read-only. Teacher: sees the papers of the courses they teach.
export default function Examinations() {
  const role = useSelector((s) => s.auth.user.role);
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [exams, setExams] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(EXAM_EMPTY);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('datesheet');
  const [paper, setPaper] = useState(PAPER_EMPTY);
  const [results, setResults] = useState(null);

  const load = useCallback(() => api.get('/examinations').then((r) => setExams(r.data.data)).catch(fail), [fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isHod) return;
    api.get('/semesters').then((r) => setSemesters(r.data.data.filter((s) => !['completed', 'archived'].includes(s.status)))).catch(() => {});
  }, [isHod]);

  const open = async (id) => {
    try {
      const { data } = await api.get(`/examinations/${id}`);
      setSelected(data.data);
      setTab('datesheet');
      setResults(null);
      setPaper(PAPER_EMPTY);
      api.get('/courses', { params: { semester: data.data.semester._id, status: 'active' } }).then((r) => setCourses(r.data.data)).catch(() => {});
    } catch (err) { fail(err); }
  };
  const refreshSelected = (exam) => { setSelected(exam); load(); };

  const createExam = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/examinations', form);
      ok('Examination created. Add papers to the date sheet');
      setShowNew(false);
      setForm(EXAM_EMPTY);
      load();
      open(data.data._id);
    } catch (err) { fail(err); }
  };

  const addPaper = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/examinations/${selected._id}/papers`, { ...paper, maxMarks: Number(paper.maxMarks), passingMarks: Number(paper.passingMarks) });
      refreshSelected(data.data);
      setPaper(PAPER_EMPTY);
      ok('Paper added');
    } catch (err) { fail(err); }
  };

  const removePaper = async (p) => {
    if (!window.confirm(`Remove ${p.course.code} from the date sheet?`)) return;
    try { refreshSelected((await api.delete(`/examinations/${selected._id}/papers/${p._id}`)).data.data); } catch (err) { fail(err); }
  };

  const setPublished = async (publish) => {
    try {
      const { data } = await api.post(`/examinations/${selected._id}/${publish ? 'publish' : 'unpublish'}`);
      ok(data.message);
      open(selected._id);
      load();
    } catch (err) { fail(err); }
  };

  const loadResults = async () => {
    try { setResults((await api.get(`/results/examination/${selected._id}`)).data.data); } catch (err) { fail(err); }
  };

  const compile = async () => {
    try {
      const { data } = await api.post(`/results/examination/${selected._id}/compile`);
      ok(`${data.message}. ${data.data.pass} passed, ${data.data.fail} failed`);
      loadResults();
    } catch (err) {
      const d = err.response?.data?.details;
      if (Array.isArray(d) && d[0]?.course) fail(`Marks are still missing: ${d.map((x) => `${x.course} (${x.submitted}/${x.enrolled} submitted)`).join(', ')}`);
      else fail(err);
    }
  };

  const publishResults = async () => {
    if (!window.confirm('Publish these results? Students will see them and DMCs will be issued. Marks will be locked.')) return;
    try { const { data } = await api.post(`/results/examination/${selected._id}/publish`); ok(data.message); loadResults(); } catch (err) { fail(err); }
  };

  const draftCount = results?.rows.filter((r) => r.status === 'draft').length || 0;

  return (
    <>
      <div className="row-between">
        <h1>Examinations</h1>
        {isHod && <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New examination</button>}
      </div>
      <Alert msg={msg} />

      {showNew && isHod && (
        <form className="card" onSubmit={createExam}>
          <h3>New examination session</h3>
          <div className="form-grid">
            <div>
              <label>Semester</label>
              <select required value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">Select...</option>
                {semesters.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
              </select>
            </div>
            <div><label>Name</label><input required placeholder="Midterm Spring 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="midterm">Midterm</option><option value="final">Final term</option><option value="other">Other</option>
              </select>
            </div>
            <div><label>Starts</label><input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label>Ends</label><input type="date" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <label>Notes</label>
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="actions"><button className="btn btn-primary">Create</button><button type="button" className="btn btn-ghost mt" onClick={() => setShowNew(false)}>Cancel</button></div>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Examination</th><th>Semester</th><th>Type</th><th>Period</th><th>Papers</th><th>Status</th><th /></tr></thead>
          <tbody>
            {exams.map((x) => (
              <tr key={x._id}>
                <td>{x.name}</td><td>{x.semester?.name}</td><td>{x.type}</td>
                <td>{fmtDate(x.startDate)} to {fmtDate(x.endDate)}</td>
                <td>{x.papers.length}</td>
                <td><Badge value={x.status} /></td>
                <td>{role !== 'teacher' ? <button className="btn btn-small" onClick={() => open(x._id)}>Open</button> : null}</td>
              </tr>
            ))}
            {!exams.length && <tr><td colSpan={7} className="muted">No examinations yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {role === 'teacher' && exams.map((x) => (
        <div className="card table-wrap" key={`t-${x._id}`}>
          <h3>{x.name} — your papers</h3>
          <table>
            <thead><tr><th>Course</th><th>Date</th><th>Time</th><th>Room</th><th>Max marks</th></tr></thead>
            <tbody>{x.papers.map((p) => <tr key={p._id}><td>{p.course.code} {p.course.title}</td><td>{fmtDate(p.date)}</td><td>{p.startTime}–{p.endTime}</td><td>{p.room}</td><td>{p.maxMarks}</td></tr>)}</tbody>
          </table>
          <p className="muted small">Enter marks from the course page, under the "Exam marks" tab.</p>
        </div>
      ))}

      {selected && role !== 'teacher' && (
        <div className="card">
          <div className="row-between">
            <h3>{selected.name} <Badge value={selected.status} /></h3>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
          </div>
          <Tabs tabs={[['datesheet', 'Date sheet'], ['results', 'Results and DMC']]} active={tab} onChange={(t) => { setTab(t); if (t === 'results') loadResults(); }} />

          {tab === 'datesheet' && (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Course</th><th>Date</th><th>Time</th><th>Room</th><th>Max</th><th>Pass</th>{isHod && <th />}</tr></thead>
                  <tbody>
                    {[...selected.papers].sort((a, b) => new Date(a.date) - new Date(b.date)).map((p) => (
                      <tr key={p._id}>
                        <td>{p.course.code} — {p.course.title}</td><td>{fmtDate(p.date)}</td><td>{p.startTime}–{p.endTime}</td><td>{p.room}</td><td>{p.maxMarks}</td><td>{p.passingMarks}</td>
                        {isHod && <td><button className="btn btn-small btn-danger" onClick={() => removePaper(p)}>Remove</button></td>}
                      </tr>
                    ))}
                    {!selected.papers.length && <tr><td colSpan={7} className="muted">No papers yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              {isHod && (
                <>
                  <form className="mt" onSubmit={addPaper}>
                    <h4>Add paper</h4>
                    <div className="form-grid">
                      <div>
                        <label>Course</label>
                        <select required value={paper.course} onChange={(e) => setPaper({ ...paper, course: e.target.value })}>
                          <option value="">Select...</option>
                          {courses.filter((c) => !selected.papers.some((p) => p.course._id === c._id)).map((c) => <option key={c._id} value={c._id}>{c.code} — {c.title}</option>)}
                        </select>
                      </div>
                      <div><label>Date</label><input type="date" required value={paper.date} onChange={(e) => setPaper({ ...paper, date: e.target.value })} /></div>
                      <div><label>Start</label><input type="time" required value={paper.startTime} onChange={(e) => setPaper({ ...paper, startTime: e.target.value })} /></div>
                      <div><label>End</label><input type="time" required value={paper.endTime} onChange={(e) => setPaper({ ...paper, endTime: e.target.value })} /></div>
                      <div><label>Room</label><input required value={paper.room} onChange={(e) => setPaper({ ...paper, room: e.target.value })} /></div>
                      <div><label>Maximum marks</label><input type="number" min={1} required value={paper.maxMarks} onChange={(e) => setPaper({ ...paper, maxMarks: e.target.value })} /></div>
                      <div><label>Passing marks</label><input type="number" min={0} required value={paper.passingMarks} onChange={(e) => setPaper({ ...paper, passingMarks: e.target.value })} /></div>
                    </div>
                    <button className="btn btn-primary">Add to date sheet</button>
                  </form>
                  <div className="actions mt">
                    {selected.status === 'draft' && <button className="btn btn-primary inline" onClick={() => setPublished(true)}>Publish date sheet</button>}
                    {selected.status === 'published' && <button className="btn inline" onClick={() => setPublished(false)}>Move back to draft</button>}
                  </div>
                  <p className="muted small">The server blocks clashes: the same room, teacher or student cannot have two overlapping papers.</p>
                </>
              )}
            </>
          )}

          {tab === 'results' && (
            <>
              {isHod && (
                <div className="actions">
                  <button className="btn btn-primary inline" onClick={compile}>Calculate results</button>
                  <button className="btn inline" onClick={publishResults} disabled={!draftCount}>Publish {draftCount || ''} results</button>
                </div>
              )}
              <p className="muted small">Results can be calculated only after every teacher has submitted marks. Totals, percentage, grade and pass/fail come from the university grading rules, never from AI.</p>
              {results && (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Roll</th><th>Student</th><th>Total</th><th>%</th><th>Grade</th><th>Outcome</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {results.rows.map((r) => (
                        <tr key={r._id}>
                          <td>{r.rollNumber}</td><td>{r.studentName}</td><td>{r.totalObtained} / {r.totalMax}</td><td>{r.percentage}</td><td>{r.grade}</td>
                          <td><Badge value={r.outcome} /></td><td><Badge value={r.status} /></td>
                          <td>{r.status === 'published' && <button className="btn btn-small" onClick={() => downloadSafe(`/results/${r._id}/dmc`, 'DMC.pdf', fail)}>DMC</button>}</td>
                        </tr>
                      ))}
                      {!results.rows.length && <tr><td colSpan={8} className="muted">No results calculated yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
