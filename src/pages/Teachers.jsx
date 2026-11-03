import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../api/axios.js';
import TeachersPanel from '../components/TeachersPanel.jsx';

// One place to see every teacher by department, with the classes they teach.
export default function Teachers() {
  const { user } = useSelector((s) => s.auth);
  const isHead = user.role === 'university_head';
  const [depts, setDepts] = useState([]);
  const [department, setDepartment] = useState('');

  useEffect(() => {
    api.get('/departments').then((r) => setDepts(r.data.data)).catch(() => {});
  }, []);

  return (
    <>
      <div className="row-between">
        <h1>Teachers</h1>
        <Link className="btn btn-ghost" to="/users">Add / deactivate teachers</Link>
      </div>
      {isHead && (
        <div className="card filters">
          <div>
            <label>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        </div>
      )}
      <TeachersPanel department={department} canDelete />
    </>
  );
}
