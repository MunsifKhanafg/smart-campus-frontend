import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios.js';
import StudentsPanel from '../components/StudentsPanel.jsx';

// Students hub for the University Head: department boxes, then semester boxes, then a searchable list.
export default function StudentsHub() {
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [students, setStudents] = useState([]);
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');

  useEffect(() => {
    Promise.all([api.get('/departments'), api.get('/semesters'), api.get('/students')])
      .then(([d, s, st]) => { setDepts(d.data.data); setSemesters(s.data.data); setStudents(st.data.data); })
      .catch(() => {});
  }, []);

  const deptCount = useMemo(() => {
    const c = {};
    students.forEach((p) => { const k = p.department?._id; c[k] = (c[k] || 0) + 1; });
    return c;
  }, [students]);
  const semCount = useMemo(() => {
    const c = {};
    students.forEach((p) => { const k = p.semester?._id; if (k) c[k] = (c[k] || 0) + 1; });
    return c;
  }, [students]);

  const sems = semesters.filter((s) => s.department?._id === department).sort((a, b) => a.number - b.number);

  return (
    <>
      <h1>Students</h1>
      <p className="muted">Pick a department, then a semester. Use the search box to find a student by name, email or roll number.</p>

      <div className="pick-grid">
        <button className={`pick ${department === '' ? 'on' : ''}`} onClick={() => { setDepartment(''); setSemester(''); }}>
          <b>{students.length}</b><span>All departments</span>
        </button>
        {depts.map((d) => (
          <button key={d._id} className={`pick ${department === d._id ? 'on' : ''}`} onClick={() => { setDepartment(d._id); setSemester(''); }}>
            <b>{deptCount[d._id] || 0}</b><span>{d.name}</span>
          </button>
        ))}
      </div>

      {department && (
        <div className="pick-grid">
          <button className={`pick ${semester === '' ? 'on' : ''}`} onClick={() => setSemester('')}>
            <b>{deptCount[department] || 0}</b><span>All semesters</span>
          </button>
          {sems.map((s) => (
            <button key={s._id} className={`pick ${semester === s._id ? 'on' : ''}`} onClick={() => setSemester(s._id)}>
              <b>{semCount[s._id] || 0}</b><span>{s.name}</span>
            </button>
          ))}
        </div>
      )}

      <StudentsPanel department={department} semester={semester} />
    </>
  );
}
