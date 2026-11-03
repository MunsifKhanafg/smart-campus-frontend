import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import AttendancePanel from '../components/AttendancePanel.jsx';

// One place to see attendance for any department and semester.
export default function Attendance() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const [depts, setDepts] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');

  useEffect(() => {
    api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
    api.get('/semesters').then((r) => setSemesters(r.data.data)).catch(() => {});
  }, []);

  const visibleSems = semesters.filter((s) => !department || s.department?._id === department);

  return (
    <>
      <h1>Attendance</h1>
      <p className="muted">Pick a department and semester to see class-wise attendance. Open a class to see every student.</p>
      <div className="card filters">
        {isHead && (
          <div>
            <label>Department</label>
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setSemester(''); }}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label>Semester</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="">All semesters</option>
            {visibleSems.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.academicYear})</option>)}
          </select>
        </div>
      </div>
      <AttendancePanel department={department} semester={semester} />
    </>
  );
}
