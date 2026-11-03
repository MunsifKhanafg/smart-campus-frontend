import { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios.js';
import { useFlash, Alert } from '../../components/ui.jsx';

// Students enrolled in one course. Teachers (own course) and the head can look. The HOD can also add and remove students.
export default function ClassList({ course, role }) {
  const isHod = role === 'hod';
  const [msg, ok, fail] = useFlash();
  const [data, setData] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState([]);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.get(`/enrollments/course/${course._id}`).then((r) => setData(r.data.data)).catch(fail);
  }, [course._id, fail]);
  useEffect(() => { load(); }, [load]);

  const openAdd = async () => {
    try {
      const semesterId = course.semester?._id || course.semester;
      const { data: res } = await api.get('/students', { params: { semester: semesterId, status: 'active' } });
      const enrolled = new Set(data.students.map((s) => s.studentId));
      setCandidates(res.data.filter((p) => !enrolled.has(p.user._id)));
      setPicked([]);
      setAdding(true);
    } catch (err) { fail(err); }
  };

  const enrol = async () => {
    try {
      await api.post(`/enrollments/course/${course._id}/enroll`, { students: picked });
      ok(`${picked.length} student(s) enrolled`);
      setAdding(false);
      load();
    } catch (err) { fail(err); }
  };

  const drop = async (s) => {
    if (!window.confirm(`Remove ${s.name} from this course? Their record is kept as history.`)) return;
    try { await api.post(`/enrollments/course/${course._id}/drop`, { students: [s.studentId] }); ok('Student removed'); load(); } catch (err) { fail(err); }
  };

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <Alert msg={msg} />
      {adding && isHod && (
        <div className="card">
          <h3>Add students to this course</h3>
          {!candidates.length && <p className="muted">Every student of this semester is already enrolled.</p>}
          {candidates.map((p) => (
            <label key={p._id} className="check">
              <input type="checkbox" checked={picked.includes(p.user._id)} onChange={() => toggle(p.user._id)} />
              {p.rollNumber} — {p.user.name} (Sec {p.section})
            </label>
          ))}
          <div className="actions">
            <button className="btn btn-primary" disabled={!picked.length} onClick={enrol}>Enrol {picked.length || ''}</button>
            <button className="btn btn-ghost mt" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="card table-wrap">
        <div className="row-between">
          <h3>Class list {data && <span className="muted small">({data.students.length} students)</span>}</h3>
          {isHod && !adding && data && <button className="btn btn-small" onClick={openAdd}>+ Add students</button>}
        </div>
        <table>
          <thead><tr><th>Roll</th><th>Name</th><th>Email</th><th>Sec</th>{isHod && <th />}</tr></thead>
          <tbody>
            {data?.students.map((s) => (
              <tr key={s.studentId}>
                <td>{s.rollNumber}</td><td>{s.name}</td><td>{s.email}</td><td>{s.section}</td>
                {isHod && <td><button className="btn btn-small btn-danger" onClick={() => drop(s)}>Remove</button></td>}
              </tr>
            ))}
            {data && !data.students.length && <tr><td colSpan={5} className="muted">No students are enrolled yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
